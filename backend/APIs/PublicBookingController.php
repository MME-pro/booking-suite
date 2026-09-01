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
use BookingSuite\Backend\Support\EmailVerification;
use BookingSuite\Backend\Support\ProofUpload;
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
		$hours  = $hours > 0 ? $hours : (float) SettingsRepository::number( SettingsRepository::BASE_HOURS );

		$slots = SlotGenerator::for_date( $apartment, $date, $hours, $guests );

		$has_free = (bool) array_filter(
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
		 * Proof of payment is required, and required here — before a booking, a
		 * customer or an extras hold exists. Checked on the server rather than
		 * trusting the modal's disabled button: the endpoint is public, and a
		 * request that skips the form would otherwise take the dates off the
		 * board with nothing to reconcile against.
		 */
		if ( '' === trim( (string) $request->get_param( 'paymentProof' ) ) ) {
			return self::error(
				'booking_suite_payment_proof_required',
				__(
					'Please upload a screenshot or receipt of your payment to complete the booking.',
					'booking-suite'
				),
				400,
				'payment'
			);
		}

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

		$booking_id = BookingsRepository::create(
			array(
				'room_id'      => $parsed['apartment']['id'],
				'customer_id'  => $customer_id,
				'guests'       => $parsed['guests'],
				'starts_at'    => $parsed['starts_at'],
				'ends_at'      => $parsed['ends_at'],
				'total_amount' => $quote['total'],
				'notes'        => (string) $request->get_param( 'notes' ),
			)
		);

		if ( null === $booking_id ) {
			return self::error( 'booking_suite_create_failed', __( 'The booking could not be saved.', 'booking-suite' ), 500 );
		}

		BookingsRepository::attach_extras( $booking_id, $quote['extraLines'] );

		$booking = BookingsRepository::find( $booking_id );

		self::record_payment( $booking_id, (string) ( $booking['reference'] ?? '' ), $quote['total'], $request );

		if ( $customer_id ) {
			CustomersRepository::record_booking( $customer_id, $quote['total'], $parsed['starts_at'] );
		}

		/*
		 * Last, and deliberately not checked: the booking is already saved, and
		 * an unreachable mail server must not turn a taken booking into an
		 * error for the guest.
		 */
		BookingEmails::send( EmailTemplatesRepository::BOOKING_REQUEST, $booking_id );

		return new WP_REST_Response(
			array(
				'id'        => $booking_id,
				'reference' => $booking['reference'] ?? '',
				'status'    => 'pending',
				'total'     => $quote['total'],
				'currency'  => SettingsRepository::currency(),
				'nights'    => $quote['nights'],
				'message'   => __( 'Thank you — your booking request has been received. We will confirm it by email with payment details.', 'booking-suite' ),
			),
			201
		);
	}

	/**
	 * Record what the guest told us about paying, including any receipt they
	 * uploaded. A booking is still valid without one.
	 */
	private static function record_payment( int $booking_id, string $reference, float $amount, WP_REST_Request $request ): void {
		$proof_data = (string) $request->get_param( 'paymentProof' );
		$paid_on    = self::date( (string) $request->get_param( 'paymentDate' ) );

		$attachment_id = '' === $proof_data
			? null
			: ProofUpload::save( $proof_data, $reference );

		/*
		 * Nothing at all to record. Proof is required before a booking is
		 * created, so in practice this only catches an upload that failed to
		 * save — and in that case the row is still written, with no attachment,
		 * rather than leaving a booking with no payment against it for the owner
		 * to chase.
		 */
		if ( '' === $proof_data && null === $paid_on ) {
			return;
		}

		PaymentsRepository::create(
			array(
				'booking_id'          => $booking_id,
				'method'              => 'transfer',
				'status'              => 'pending',
				'amount'              => $amount,
				'proof_attachment_id' => $attachment_id,
				'paid_at'             => $paid_on ? $paid_on . ' 00:00:00' : null,
				'reference'           => $reference,
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
			'total'          => round( $stay['subtotal'] + $extra_sum, 2 ),
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
		 * The shortest booking a guest may make.
		 *
		 * This endpoint used to take any positive length, on the grounds that
		 * the setting only shaped the picker's suggestions — but the picker is
		 * not the only way in, and a typed or posted 1 went straight through.
		 *
		 * Guests only. An admin booking is made through BookingsController,
		 * which deliberately has no minimum: the owner takes a one-hour visit
		 * or a favour for a regular whenever they choose.
		 */
		$minimum = max( 1, (int) SettingsRepository::number( SettingsRepository::MIN_HOURS ) );

		if ( $hours < $minimum ) {
			return self::error(
				'booking_suite_invalid_field',
				sprintf(
					/* translators: %d: the shortest bookable length, in hours. */
					_n(
						'Bookings start at %d hour.',
						'Bookings start at %d hours.',
						$minimum,
						'booking-suite'
					),
					$minimum
				),
				400,
				'hours'
			);
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
