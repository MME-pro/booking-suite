<?php
/**
 * Public REST routes for the booking modal.
 *
 * GET  /booking-suite/v1/public/booking-context/<id>  apartment + extras
 * POST /booking-suite/v1/public/quote                 price a stay
 * POST /booking-suite/v1/public/bookings              place a booking
 *
 * Unauthenticated: these are what a guest uses. Every price is recalculated
 * here — anything the browser sends about money is ignored.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\CustomersRepository;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Repositories\ExtrasRepository;
use BookingSuite\Backend\Support\BookingEmails;
use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Pricing\SlotGenerator;
use BookingSuite\Backend\Repositories\PriceRulesRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Support\EmailVerification;
use BookingSuite\Backend\Support\EpcQr;
use BookingSuite\Backend\Support\PaymentLink;
use BookingSuite\Backend\Support\PaymentPage;
use DateTimeImmutable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class PublicBookingController {

	public const NAMESPACE = 'booking-suite/v1';

	private const MAX_NIGHTS = 90;

	/** The fixed overnight window, from settings. */
	private static function check_in_time(): string {
		return SettingsRepository::get( SettingsRepository::OVERNIGHT_START ) . ':00';
	}

	private static function check_out_time(): string {
		return SettingsRepository::get( SettingsRepository::OVERNIGHT_END ) . ':00';
	}

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/public/booking-context/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'context' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/public/nights',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'nights' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/public/slots',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'slots' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/public/quote',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'quote' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/public/bookings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'create' ),
				'permission_callback' => '__return_true',
			)
		);

		/*
		 * The payment page, reachable by anyone holding the link and by nobody
		 * else. The token IS the permission — see PaymentLink — so the callback
		 * is open and the check happens on the token inside.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/public/payment/(?P<token>[A-Za-z0-9.]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'payment_page' ),
				'permission_callback' => '__return_true',
			)
		);

		/*
		 * "I have sent it."
		 *
		 * A note to the owner and nothing more: no money has been seen and the
		 * booking was already binding, so this moves a status and a timestamp
		 * and touches nothing else.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/public/payment/(?P<token>[A-Za-z0-9.]+)/declared',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'declare_transfer' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Everything the payment page shows, for one booking.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function payment_page( WP_REST_Request $request ) {
		$booking = self::booking_from_token( (string) $request['token'] );

		if ( $booking instanceof WP_Error ) {
			return $booking;
		}

		return new WP_REST_Response( self::payment_payload( $booking ), 200 );
	}

	/**
	 * Record that the guest says the transfer is on its way.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function declare_transfer( WP_REST_Request $request ) {
		$booking = self::booking_from_token( (string) $request['token'] );

		if ( $booking instanceof WP_Error ) {
			return $booking;
		}

		$id = (int) $booking['id'];

		/*
		 * Only from the one status this can follow. A booking already confirmed
		 * by the owner, or cancelled when its deadline passed, must not be
		 * dragged back to "the guest says they paid" by someone reopening an
		 * old link — the owner's word is the later and better one.
		 */
		if ( 'awaiting_transfer' === ( $booking['status'] ?? '' ) ) {
			BookingsRepository::update(
				$id,
				array(
					'status'                => 'transfer_declared',
					'transfer_confirmed_at' => current_time( 'mysql' ),
				)
			);

			$booking = BookingsRepository::find( $id );
		}

		return new WP_REST_Response( self::payment_payload( $booking ), 200 );
	}

	/**
	 * The booking a payment token names, or the reason it names none.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function booking_from_token( string $token ) {
		$id = PaymentLink::booking_id( $token );

		if ( null === $id ) {
			return self::error(
				'booking_suite_bad_link',
				__( 'This payment link is not valid any more. Please use the link in your booking email, or get in touch.', 'booking-suite' ),
				404
			);
		}

		$booking = BookingsRepository::find( $id );

		if ( null === $booking ) {
			return self::error(
				'booking_suite_not_found',
				__( 'This booking could not be found.', 'booking-suite' ),
				404
			);
		}

		return $booking;
	}

	/**
	 * What the payment page and the thank-you page both draw from.
	 *
	 * The bank details are repeated here rather than left to the bootstrap: the
	 * page has to work from a link in an email, opened on a phone, on a page
	 * that never loaded the booking form.
	 *
	 * @param array<string, mixed> $booking
	 * @return array<string, mixed>
	 */
	private static function payment_payload( array $booking ): array {
		$total = (float) ( $booking['total'] ?? 0 );
		$iban  = SettingsRepository::get( SettingsRepository::BANK_IBAN );

		return array(
			'reference'     => (string) ( $booking['reference'] ?? '' ),
			'status'        => (string) ( $booking['status'] ?? '' ),
			'bookingType'   => (string) ( $booking['bookingType'] ?? '' ),
			'startsAt'      => (string) ( $booking['startsAt'] ?? '' ),
			'endsAt'        => (string) ( $booking['endsAt'] ?? '' ),
			'total'         => $total,
			'currency'      => SettingsRepository::currency(),
			'deadline'      => $booking['paymentDeadline'] ?? null,
			'declaredAt'    => $booking['transferConfirmedAt'] ?? null,
			'bank'          => array(
				'holder' => SettingsRepository::get( SettingsRepository::BANK_HOLDER ),
				'name'   => SettingsRepository::get( SettingsRepository::BANK_NAME ),
				'iban'   => SettingsRepository::format_iban( $iban ),
				'bic'    => SettingsRepository::get( SettingsRepository::BANK_BIC ),
			),
			/*
			 * The GiroCode's payload, built server-side. The page draws it as a
			 * QR; deciding what goes IN it is a banking question, not a
			 * rendering one, and belongs where the IBAN already lives.
			 */
			'giroCode'      => EpcQr::payload(
				SettingsRepository::get( SettingsRepository::BANK_HOLDER ),
				$iban,
				SettingsRepository::get( SettingsRepository::BANK_BIC ),
				$total,
				(string) ( $booking['reference'] ?? '' )
			),
			'reservationHours' => SettingsRepository::reservation_hours(),

			/*
			 * The confirmation as a file. A fresh link rather than the one in
			 * the address bar: the page may have been reached by the plain
			 * query-string form, and building it here keeps the download
			 * working either way.
			 */
			'confirmationUrl'  => add_query_arg(
				PaymentPage::DOCUMENT_VAR,
				'confirmation',
				PaymentLink::url( (int) ( $booking['id'] ?? 0 ) )
			),
		);
	}

	/**
	 * Everything the modal needs to open: the apartment and its extras.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function context( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( (int) $request['id'] );

		if ( null === $apartment || ! $apartment['active'] ) {
			return self::error( 'booking_suite_not_bookable', __( 'This apartment cannot be booked.', 'booking-suite' ), 404 );
		}

		$id     = (int) $apartment['id'];
		$prices = PriceRulesRepository::lowest_public_price( array( $id ) );

		return new WP_REST_Response(
			array(
				'apartment' => array(
					'id'        => $id,
					'name'      => $apartment['name'],
					'capacity'  => (int) $apartment['capacity'],
					'colour'    => $apartment['colour'],
					'image'     => ApartmentsRepository::image( $apartment ),
					'priceFrom' => RateCalculator::lowest_rate( $apartment ) ?? $prices[ $id ] ?? null,
					'permalink' => $apartment['permalink'],
				),
				'extras'    => ExtrasRepository::active( $id ),
				'currency'  => SettingsRepository::currency(),
				// Where the money goes. The payment step shows it, because a
				// guest asked to prove a transfer needs somewhere to transfer to.
				'bank'      => SettingsRepository::bank_details(),
				'checkIn'   => self::check_in_time(),
				'checkOut'  => self::check_out_time(),
				/*
				 * Whether the modal should ask the guest to prove their
				 * address. Answered here rather than assumed, so turning the
				 * verification email off takes the step off the form too
				 * instead of leaving a wall nobody can get past.
				 */
				'verifyEmail' => EmailVerification::is_enabled(),
			),
			200
		);
	}

	/**
	 * The nights this apartment cannot be booked for.
	 *
	 * Feeds the guest's date picker, which otherwise offers every day in the
	 * calendar and finds out what is taken only after one has been chosen. An
	 * owner who locks a week expects that week to be unpickable, not pickable
	 * and then refused.
	 *
	 * Says nothing about WHY a night is closed — a booking, a lock, a portal
	 * import are all the same "not available" to a guest, and naming them
	 * would publish the property's occupancy to anyone who asked.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function nights( WP_REST_Request $request ) {
		$id        = absint( $request->get_param( 'apartmentId' ) );
		$apartment = ApartmentsRepository::find( $id );

		if ( null === $apartment || ! $apartment['active'] ) {
			return self::error( 'booking_suite_not_bookable', __( 'This apartment cannot be booked.', 'booking-suite' ), 404 );
		}

		$from = self::date( (string) $request->get_param( 'from' ) );
		$to   = self::date( (string) $request->get_param( 'to' ) );

		if ( null === $from || null === $to ) {
			return self::error(
				'booking_suite_invalid_field',
				__( 'Give a start and an end date.', 'booking-suite' ),
				400,
				'from'
			);
		}

		/*
		 * Capped rather than rejected. A picker asking for two years gets the
		 * year it can actually use, and the nights beyond it stay selectable —
		 * the quote still refuses them, so the guest is never told something
		 * untrue, only something incomplete.
		 */
		$limit = gmdate( 'Y-m-d', strtotime( $from . ' 00:00:00' ) + 400 * DAY_IN_SECONDS );

		if ( $to > $limit ) {
			$to = $limit;
		}

		return new WP_REST_Response(
			array(
				'from'  => $from,
				'to'    => $to,
				'taken' => BookingsRepository::taken_nights(
					$id,
					$from,
					$to,
					self::check_in_time(),
					self::check_out_time()
				),
			),
			200
		);
	}

	/**
	 * Start times available on a date for a chosen duration.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function slots( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( absint( $request->get_param( 'apartmentId' ) ) );

		if ( null === $apartment || ! $apartment['active'] ) {
			return self::error( 'booking_suite_not_bookable', __( 'This apartment cannot be booked.', 'booking-suite' ), 404 );
		}

		$date = self::date( (string) $request->get_param( 'date' ) );

		if ( null === $date ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please choose a date.', 'booking-suite' ), 400, 'date' );
		}

		$guests = max( 1, absint( $request->get_param( 'guests' ) ) );
		$hours  = (float) $request->get_param( 'hours' );

		/*
		 * The shortest bookable length, not the base rate's span. BASE_HOURS
		 * answers a pricing question — how long the base rate covers before
		 * the hourly surcharge starts — and standing it in here only worked
		 * while the two numbers happened to agree. They no longer do, and a
		 * grid built for three hours would be a grid of times this endpoint
		 * refuses.
		 */
		$hours  = $hours > 0 ? $hours : (float) SettingsRepository::number( SettingsRepository::MIN_HOURS );

		$daytime = SlotGenerator::daytime_slot( $apartment, $date, $guests );

		/*
		 * A fixed-block day has no free-form starts. Offering the usual grid
		 * beside the block would show forty-eight times that the endpoint below
		 * refuses, which is a worse experience than showing one that works.
		 */
		$slots = SlotGenerator::is_fixed_block_day( $date )
			? array()
			: SlotGenerator::for_date( $apartment, $date, $hours, $guests );

		$has_free = ( null !== $daytime && $daytime['available'] ) || (bool) array_filter(
			$slots,
			static fn( array $slot ): bool => (bool) $slot['available']
		);

		/*
		 * Only looked for when the day came up empty. Searching a fortnight
		 * ahead across every apartment on a day that already has room is work
		 * nobody asked for, and the panel would not show it anyway.
		 */
		$alternatives = $has_free
			? array(
				'sameApartment'   => null,
				'otherApartments' => array(),
			)
			: SlotGenerator::alternatives( $apartment, $date, $hours, $guests );

		return new WP_REST_Response(
			array(
				'date'         => $date,
				'hours'        => $hours,
				'durations'    => SlotGenerator::duration_options( $apartment, $date, $guests ),
				'slots'        => $slots,
				/*
				 * The fixed daytime block, on the days it runs. Sent alongside
				 * the grid rather than mixed into it: it is one offer to accept
				 * or not, and folding it in among forty-eight start times would
				 * bury the thing the guest is meant to notice.
				 */
				'daytimeSlot'  => $daytime,
				'alternatives' => $alternatives,
				'currency'     => SettingsRepository::currency(),
			),
			200
		);
	}

	/**
	 * Price a stay and report whether the window is free.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function quote( WP_REST_Request $request ) {
		$parsed = self::parse( $request );

		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		return new WP_REST_Response( self::price( $parsed ), 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $request ) {
		$parsed = self::parse( $request );

		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}

		$first = sanitize_text_field( (string) $request->get_param( 'firstName' ) );
		$last  = sanitize_text_field( (string) $request->get_param( 'lastName' ) );
		$email = sanitize_email( (string) $request->get_param( 'email' ) );

		if ( '' === $first || '' === $last ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please give your first and last name.', 'booking-suite' ), 400, 'firstName' );
		}

		if ( ! is_email( $email ) ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please give a valid email address.', 'booking-suite' ), 400, 'email' );
		}

		/*
		 * The address has to have been proved. Checked HERE and not only in
		 * the modal, because the modal is JavaScript on the guest's machine
		 * and this endpoint is open to anyone: a form that asks for a code but
		 * an API that does not want one is not verification, it is a delay.
		 *
		 * The token is signed and carries its own expiry, so nothing has to be
		 * remembered between the two requests.
		 */
		if ( EmailVerification::is_enabled() ) {
			$token = (string) $request->get_param( 'verificationToken' );

			if ( ! EmailVerification::is_verified( $email, $token ) ) {
				return self::error(
					'booking_suite_unverified',
					__( 'Please confirm your email address before booking.', 'booking-suite' ),
					403,
					'email'
				);
			}
		}

		$quote = self::price( $parsed );

		if ( ! $quote['available'] ) {
			return self::error( 'booking_suite_unavailable', __( 'Those dates have just been taken. Please choose another window.', 'booking-suite' ), 409, 'checkIn' );
		}

		/*
		 * The quote capped anything oversubscribed rather than failing, which
		 * is right while the guest is still choosing. At the point of booking
		 * it has to be an error instead: charging for fewer than were asked for
		 * without saying so would be the worse outcome.
		 */
		if ( $quote['extrasShortfall'] ) {
			$first_short = $quote['extrasShortfall'][0];

			return self::error(
				'booking_suite_extra_unavailable',
				sprintf(
					/* translators: %s: name of the extra. */
					__(
						'%s is no longer available for these dates. Please adjust it and try again.',
						'booking-suite'
					),
					$first_short['name']
				),
				409,
				'extras'
			);
		}

		/*
		 * An apartment nobody has priced cannot take a booking.
		 *
		 * Without this the stay is quoted at nothing, the booking is taken
		 * for nothing, and the guest lands on a payment page asking them to
		 * transfer zero euro — with no GiroCode, because a code that opens an
		 * empty transfer is worse than no code. The dates come off the board
		 * and the owner is owed nothing and can never be paid.
		 *
		 * Checked on the total rather than only on the apartment's rates, so
		 * any other route to zero is caught by the same guard.
		 */
		if ( $quote['total'] <= 0 ) {
			return self::error(
				'booking_suite_not_priced',
				__(
					'This apartment cannot be booked online yet — no price has been set for it. Please get in touch and we will arrange it with you.',
					'booking-suite'
				),
				409,
				'apartment'
			);
		}

		/*
		 * There is nothing to decide here any more.
		 *
		 * One way to pay — advance bank transfer — so no choice is offered and
		 * none is read from the request. No proof is asked for either: the
		 * guest cannot prove a transfer has cleared, only claim it, and the
		 * only thing that settles a booking is the owner seeing the money in
		 * the bank and saying so.
		 */

		$customer_id = CustomersRepository::find_or_create(
			array(
				'first_name' => $first,
				'last_name'  => $last,
				'email'      => $email,
				'phone'      => sanitize_text_field( (string) $request->get_param( 'phone' ) ),
				'address'    => sanitize_text_field( (string) $request->get_param( 'address' ) ),
				'postcode'   => sanitize_text_field( (string) $request->get_param( 'postcode' ) ),
				'city'       => sanitize_text_field( (string) $request->get_param( 'city' ) ),
				'country'    => sanitize_text_field( (string) $request->get_param( 'country' ) ),
			)
		);

		/*
		 * The contract is concluded the moment the order button is pressed
		 * (§ 312j Abs. 3 BGB), so the booking exists owing money and the dates
		 * come off the board straight away. Waiting for the transfer to clear
		 * would leave the same night on sale to somebody else for a day.
		 *
		 * The hold is not open-ended: payment_deadline is what the sweep in
		 * BookingLifecycle measures against, and what the guest is promised on
		 * the checkout and the payment page.
		 */
		$status = 'awaiting_transfer';

		$deadline = ( new DateTimeImmutable( current_time( 'mysql' ) ) )
			->modify( '+' . SettingsRepository::reservation_hours() . ' hours' )
			->format( 'Y-m-d H:i:s' );

		$booking_id = BookingsRepository::create(
			array(
				'room_id'      => $parsed['apartment']['id'],
				'customer_id'  => $customer_id,
				'guests'       => $parsed['guests'],
				'starts_at'    => $parsed['starts_at'],
				'ends_at'      => $parsed['ends_at'],
				'status'       => $status,
				/*
				 * Written now, never worked out again. It decides the VAT on
				 * the invoice, and a rate a guest was charged under must not
				 * move because the dates were edited afterwards.
				 */
				'booking_type'     => BookingsTable::type_for( $parsed['starts_at'], $parsed['ends_at'] ),
				'payment_deadline' => $deadline,
				'total_amount' => $quote['total'],
				'notes'        => (string) $request->get_param( 'notes' ),
			)
		);

		if ( null === $booking_id ) {
			return self::error( 'booking_suite_create_failed', __( 'The booking could not be saved.', 'booking-suite' ), 500 );
		}

		BookingsRepository::attach_extras( $booking_id, $quote['extraLines'] );

		$booking = BookingsRepository::find( $booking_id );

		self::record_payment( $booking_id, (string) ( $booking['reference'] ?? '' ), $quote['total'] );

		if ( $customer_id ) {
			CustomersRepository::record_booking( $customer_id, $quote['total'], $parsed['starts_at'] );
		}

		/*
		 * Last, and deliberately not checked: the booking is already saved, and
		 * an unreachable mail server must not turn a taken booking into an
		 * error for the guest.
		 */
		BookingEmails::send( EmailTemplatesRepository::BOOKING_REQUEST, $booking_id );

		/*
		 * Everything the payment page needs comes back with the booking, so the
		 * guest lands on it without a second request — and `token` is what lets
		 * them return to it later from the email, on a device that has never
		 * seen this form.
		 */
		return new WP_REST_Response(
			array(
				'id'        => $booking_id,
				'reference' => $booking['reference'] ?? '',
				'status'    => $status,
				'total'     => $quote['total'],
				'currency'  => SettingsRepository::currency(),
				'nights'    => $quote['nights'],
				'token'     => PaymentLink::token( $booking_id ),
				'paymentUrl' => PaymentLink::url( $booking_id ),
				'payment'   => self::payment_payload( $booking ),
			),
			201
		);
	}

	/**
	 * Open the booking's account: one transfer, expected, not yet seen.
	 *
	 * Written when the booking is, rather than when money turns up, because it
	 * is what the owner reconciles against. Without it a booking owing 300 €
	 * and a booking owing nothing look identical on the payments screen, and
	 * there is nothing for a part-payment to be part OF — which is what makes
	 * "partially paid, 120 € outstanding" expressible at all.
	 *
	 * `reference` is the booking number, because that is the transfer purpose
	 * the guest is told to use; matching a bank line to a booking is the whole
	 * job this row exists to make possible.
	 *
	 * Status 'pending' means exactly what it says here: claimed by nobody,
	 * seen by nobody. Only the owner marking it paid moves it on.
	 *
	 * @param int    $booking_id The booking it belongs to.
	 * @param string $reference  The booking number.
	 * @param float  $amount     The gross total owed.
	 */
	private static function record_payment( int $booking_id, string $reference, float $amount ): void {
		PaymentsRepository::create(
			array(
				'booking_id' => $booking_id,
				'method'     => 'transfer',
				'status'     => 'pending',
				'amount'     => $amount,
				'paid_at'    => null,
				'reference'  => $reference,
			)
		);
	}

	/**
	 * Validate the shared fields of a quote or a booking.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function parse( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( absint( $request->get_param( 'apartmentId' ) ) );

		if ( null === $apartment || ! $apartment['active'] ) {
			return self::error( 'booking_suite_not_bookable', __( 'This apartment cannot be booked.', 'booking-suite' ), 404 );
		}

		/*
		 * Capacity is a limit, and this is where it is enforced.
		 *
		 * The number input in the modal carries a max, but that only binds the
		 * spinner — a typed or pasted figure sails past it, and anything
		 * posting to this endpoint directly ignores it entirely. The apartment
		 * sleeps what it sleeps, so a party larger than that is refused here
		 * rather than quietly priced and confirmed.
		 */
		$guests   = max( 1, absint( $request->get_param( 'guests' ) ) );
		$capacity = max( 0, (int) ( $apartment['capacity'] ?? 0 ) );

		if ( $capacity > 0 && $guests > $capacity ) {
			return self::error(
				'booking_suite_over_capacity',
				sprintf(
					/* translators: %d: the largest party the apartment takes. */
					_n(
						'This apartment takes at most %d guest.',
						'This apartment takes at most %d guests.',
						$capacity,
						'booking-suite'
					),
					$capacity
				),
				400,
				'guests'
			);
		}

		if ( 'hourly' === $request->get_param( 'mode' ) ) {
			return self::parse_hourly( $request, $apartment, $guests );
		}

		$check_in  = self::date( (string) $request->get_param( 'checkIn' ) );
		$check_out = self::date( (string) $request->get_param( 'checkOut' ) );

		if ( null === $check_in || null === $check_out ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please choose both dates.', 'booking-suite' ), 400, 'checkIn' );
		}

		$nights = (int) round( ( strtotime( $check_out ) - strtotime( $check_in ) ) / DAY_IN_SECONDS );

		if ( $nights < 1 ) {
			return self::error( 'booking_suite_invalid_field', __( 'Check-out must be after check-in.', 'booking-suite' ), 400, 'checkOut' );
		}

		if ( $nights > self::MAX_NIGHTS ) {
			return self::error(
				'booking_suite_invalid_field',
				sprintf(
					/* translators: %d: maximum number of nights. */
					__( 'Stays are limited to %d nights.', 'booking-suite' ),
					self::MAX_NIGHTS
				),
				400,
				'checkOut'
			);
		}

		if ( strtotime( $check_in ) < strtotime( gmdate( 'Y-m-d' ) ) ) {
			return self::error( 'booking_suite_invalid_field', __( 'Check-in cannot be in the past.', 'booking-suite' ), 400, 'checkIn' );
		}

		return array(
			'apartment' => $apartment,
			'guests'    => $guests,
			'nights'    => $nights,
			'starts_at' => $check_in . ' ' . self::check_in_time(),
			'ends_at'   => $check_out . ' ' . self::check_out_time(),
			'extras'    => (array) $request->get_param( 'extras' ),
		);
	}

	/**
	 * Work out the price.
	 *
	 * Provisional: it multiplies the lowest public rate by the number of
	 * nights and adds extras. The real engine — weekday rates, holiday logic,
	 * hourly stays, guest surcharges — is not built yet, so this deliberately
	 * does not pretend to be authoritative.
	 *
	 * @param array<string, mixed> $parsed
	 *
	 * @return array<string, mixed>
	 */
	private static function price( array $parsed ): array {
		$apartment = $parsed['apartment'];
		$id        = (int) $apartment['id'];

		$stay = RateCalculator::quote(
			$apartment,
			$parsed['starts_at'],
			$parsed['ends_at'],
			(int) $parsed['guests']
		);

		// Apartments with no rates set still fall back to the price rules.
		if ( ! $stay['priced'] ) {
			$rates   = PriceRulesRepository::lowest_public_price( array( $id ) );
			$nightly = $rates[ $id ] ?? null;

			$stay['accommodation'] = null === $nightly
				? 0.0
				: round( $nightly * $stay['nights'], 2 );

			$stay['subtotal'] = round( $stay['accommodation'] + $stay['guestCharge']['total'], 2 );
		} else {
			$nightly = RateCalculator::lowest_rate( $apartment );
		}

		$extra_sum = 0.0;
		$lines     = array();
		$shortfall = array();

		/*
		 * What is free for THIS window, rather than a running total: an extra
		 * held by an overlapping booking is unavailable now and free again once
		 * that stay ends.
		 */
		$availability = ExtrasRepository::availability(
			$parsed['starts_at'],
			$parsed['ends_at']
		);

		foreach ( $parsed['extras'] as $chosen ) {
			$extra_id = absint( $chosen['id'] ?? 0 );
			$quantity = max( 1, absint( $chosen['quantity'] ?? 1 ) );

			$extra = ExtrasRepository::find( $extra_id );

			if ( null === $extra || ! $extra['active'] ) {
				continue;
			}

			$free = $availability[ $extra_id ] ?? null;

			// null is unlimited; anything else caps what can be taken.
			if ( null !== $free && $quantity > $free ) {
				$shortfall[] = array(
					'id'        => $extra['id'],
					'name'      => $extra['name'],
					'requested' => $quantity,
					'available' => $free,
				);

				$quantity = $free;
			}

			if ( $quantity < 1 ) {
				continue;
			}

			$extra_sum += $extra['price'] * $quantity;

			$lines[] = array(
				'id'       => $extra['id'],
				'name'     => $extra['name'],
				'quantity' => $quantity,
				'price'    => $extra['price'],
				'subtotal' => $extra['price'] * $quantity,
			);
		}

		/*
		 * The discount for paying in advance.
		 *
		 * Taken off the whole gross — stay, guests and extras — because it is
		 * a discount on the bill rather than on the room. At the default of
		 * zero every figure below is what it was, and the checkout has no
		 * discount line to draw.
		 *
		 * `gross` is kept alongside `total` so the checkout can show what was
		 * struck through; `total` stays the one number that means "what the
		 * guest owes", which is what every caller already reads it as.
		 */
		$gross    = round( $stay['subtotal'] + $extra_sum, 2 );
		$fraction = SettingsRepository::prepay_fraction();
		$discount = round( $gross * $fraction, 2 );

		return array(
			'available'      => BookingsRepository::is_available( $id, $parsed['starts_at'], $parsed['ends_at'] ),
			'mode'           => $stay['mode'],
			'nights'         => $stay['nights'],
			'nightlyRate'    => $nightly,
			'nightBreakdown' => $stay['nightBreakdown'],
			'duration'       => $stay['duration'],
			'accommodation'  => $stay['accommodation'],
			'guestCharge'    => $stay['guestCharge'],
			'extraLines'     => $lines,
			// What the modal needs to grey out the extras it cannot offer.
			'extrasAvailable' => (object) $availability,
			'extrasShortfall' => $shortfall,
			'extrasTotal'    => round( $extra_sum, 2 ),
			/*
			 * Whether this apartment has a rate at all. The server refuses an
			 * unpriced booking either way; this lets the form say so before
			 * the guest has filled it in rather than at the last click.
			 */
			'priced'         => RateCalculator::is_priced( $parsed['apartment'] ),
			'gross'          => $gross,
			'prepayPercent'  => round( $fraction * 100, 2 ),
			'prepayDiscount' => $discount,
			'total'          => round( $gross - $discount, 2 ),
			'currency'       => SettingsRepository::currency(),
			'provisional'    => null === $nightly,
		);
	}

	/**
	 * An hourly booking: one date, a start time and a duration.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function parse_hourly( WP_REST_Request $request, array $apartment, int $guests ) {
		$date = self::date( (string) $request->get_param( 'date' ) );

		if ( null === $date ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please choose a date.', 'booking-suite' ), 400, 'date' );
		}

		$start_time = (string) $request->get_param( 'startTime' );

		if ( ! preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $start_time ) ) {
			return self::error( 'booking_suite_invalid_field', __( 'Please choose a start time.', 'booking-suite' ), 400, 'startTime' );
		}

		$hours = (float) $request->get_param( 'hours' );

		if ( $hours <= 0 ) {
			return self::error(
				'booking_suite_invalid_field',
				__( 'Please choose how long you need.', 'booking-suite' ),
				400,
				'hours'
			);
		}

		/*
		 * The rules, asked of the one place that states them.
		 *
		 * They apply here and in the admin alike. This endpoint is public, so
		 * the check has to live on the server whatever the modal does — the
		 * picker is not the only way in, and a posted length went straight
		 * through before there was a check here at all.
		 */
		$refusal = SlotGenerator::rule_violation( $date, $start_time, $hours );

		if ( null !== $refusal ) {
			return self::error( 'booking_suite_invalid_field', $refusal, 400, 'hours' );
		}

		$starts = new \DateTimeImmutable( $date . ' ' . $start_time . ':00' );
		$ends   = $starts->modify( '+' . (int) round( $hours * 60 ) . ' minutes' );

		if ( $starts <= new \DateTimeImmutable( current_time( 'mysql' ) ) ) {
			return self::error( 'booking_suite_invalid_field', __( 'That time has already passed.', 'booking-suite' ), 400, 'startTime' );
		}

		return array(
			'apartment' => $apartment,
			'guests'    => $guests,
			'nights'    => 0,
			'starts_at' => $starts->format( 'Y-m-d H:i:s' ),
			'ends_at'   => $ends->format( 'Y-m-d H:i:s' ),
			'extras'    => (array) $request->get_param( 'extras' ),
		);
	}

	private static function date( string $value ): ?string {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}

		[ $year, $month, $day ] = array_map( 'intval', explode( '-', $value ) );

		return checkdate( $month, $day, $year ) ? $value : null;
	}

	private static function error( string $code, string $message, int $status, string $field = '' ): WP_Error {
		return new WP_Error(
			$code,
			$message,
			array(
				'status' => $status,
				'field'  => $field,
			)
		);
	}
}
