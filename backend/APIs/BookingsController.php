<?php
/**
 * Admin REST routes for bookings.
 *
 * GET    /booking-suite/v1/bookings         list, with filters
 * POST   /booking-suite/v1/bookings/create  take a booking on the guest's behalf
 * GET    /booking-suite/v1/bookings/<id>    one booking, with its extras
 * PUT    /booking-suite/v1/bookings/<id>    move it along, or edit the stay
 * DELETE /booking-suite/v1/bookings/<id>    erase it, and everything on it
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Pricing\SlotGenerator;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BookingEventsRepository;
use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\CustomersRepository;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Support\BookingEmails;
use BookingSuite\Backend\Support\Invoice;
use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
use DateTimeImmutable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class BookingsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'bookings';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'index' ),
				'permission_callback' => array( self::class, 'can_manage' ),
				'args'                => array(
					'search' => array(
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'status' => array(
						'type'     => 'string',
						'required' => false,
						'enum'     => BookingsTable::STATUSES,
					),
				),
			)
		);

		/*
		 * The admin's own slots and quote. They exist rather than reusing the
		 * public ones because an operator is not a guest: times that have
		 * already passed are offered, so a walk-in can be recorded after the
		 * fact, and the booking being edited is excluded from availability so
		 * its own window does not read as taken.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/slots',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'slots' ),
				'permission_callback' => array( self::class, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/quote',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'quote' ),
				'permission_callback' => array( self::class, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/create',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'create' ),
				'permission_callback' => array( self::class, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'show' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'status'         => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => BookingsTable::STATUSES,
						),
						'payment_status' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => BookingsTable::PAYMENT_STATUSES,
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( self::class, 'destroy' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	public static function index( WP_REST_Request $request ): WP_REST_Response {
		$bookings = BookingsRepository::all(
			array(
				'search'         => (string) $request->get_param( 'search' ),
				'status'         => (string) $request->get_param( 'status' ),
				'payment_status' => (string) $request->get_param( 'payment_status' ),
			)
		);

		return new WP_REST_Response(
			array(
				'bookings' => $bookings,
				'counts'   => BookingsRepository::counts(),
				'statuses' => BookingsTable::STATUSES,
				'payments' => BookingsTable::PAYMENT_STATUSES,
			),
			200
		);
	}

	/**
	 * Take a booking on the guest's behalf — over the phone, at the door.
	 *
	 * Unlike the public route this trusts the operator: past dates are allowed,
	 * the status can be set straight away, and the total may be overridden for
	 * an agreed price.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $request ) {
		$stay = self::parse_stay( $request );

		if ( is_wp_error( $stay ) ) {
			return $stay;
		}

		$status = self::status_param( $request, 'status', BookingsTable::STATUSES, 'confirmed' );

		if ( BookingsRepository::status_blocks( $status )
			&& ! BookingsRepository::is_available( $stay['room_id'], $stay['starts_at'], $stay['ends_at'] ) ) {
			return self::conflict();
		}

		$customer_id = self::save_customer( $request );

		$booking_id = BookingsRepository::create(
			array(
				'room_id'        => $stay['room_id'],
				'customer_id'    => $customer_id,
				'guests'         => $stay['guests'],
				'starts_at'      => $stay['starts_at'],
				'ends_at'        => $stay['ends_at'],
				'total_amount'   => self::total_for( $request, $stay ),
				'status'         => $status,
				'payment_status' => self::status_param( $request, 'payment_status', BookingsTable::PAYMENT_STATUSES, 'unpaid' ),
				'source'         => 'admin',
				'notes'          => (string) $request->get_param( 'notes' ),
			)
		);

		if ( null === $booking_id ) {
			return new WP_Error(
				'booking_suite_create_failed',
				__( 'The booking could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( BookingsRepository::find( $booking_id ), 201 );
	}

	/**
	 * Move a booking along: approve it, mark it paid, complete it, cancel it.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$booking = BookingsRepository::find( $id );

		if ( null === $booking ) {
			return self::not_found();
		}

		$status  = (string) $request->get_param( 'status' );
		$payment = (string) $request->get_param( 'payment_status' );

		/*
		 * Pending requests do not hold their dates, so two guests can be
		 * waiting on the same slot. Taking one off the board has to check that
		 * nobody else already has it.
		 */
		if ( '' !== $status && BookingsRepository::status_blocks( $status ) ) {
			$free = BookingsRepository::is_available(
				(int) $booking['apartmentId'],
				(string) $booking['startsAt'],
				(string) $booking['endsAt'],
				$id
			);

			if ( ! $free ) {
				return new WP_Error(
					'booking_suite_unavailable',
					__( 'Another booking already holds those dates. Cancel that one first.', 'booking-suite' ),
					array(
						'status' => 409,
						'field'  => 'status',
					)
				);
			}
		}

		if ( '' === $status && '' === $payment ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Nothing to change.', 'booking-suite' ),
				array( 'status' => 400 )
			);
		}

		$changes = array(
			'status'         => $status,
			'payment_status' => $payment,
			'notes'          => (string) $request->get_param( 'notes' ),
		);

		// A full edit also moves the stay itself.
		if ( null !== $request->get_param( 'apartmentId' ) ) {
			$stay = self::parse_stay( $request );

			if ( is_wp_error( $stay ) ) {
				return $stay;
			}

			$blocking = BookingsRepository::status_blocks( $status ?: (string) $booking['status'] );

			if ( $blocking
				&& ! BookingsRepository::is_available( $stay['room_id'], $stay['starts_at'], $stay['ends_at'], $id ) ) {
				return self::conflict();
			}

			$changes['room_id']      = $stay['room_id'];
			$changes['guests']       = $stay['guests'];
			$changes['starts_at']    = $stay['starts_at'];
			$changes['ends_at']      = $stay['ends_at'];
			$changes['total_amount'] = self::total_for( $request, $stay );

			$customer_id = self::save_customer( $request );

			if ( $customer_id ) {
				$changes['customer_id'] = $customer_id;
			}
		}

		$updated = BookingsRepository::update( $id, $changes );

		if ( ! $updated ) {
			return new WP_Error(
				'booking_suite_update_failed',
				__( 'The booking could not be updated.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		/*
		 * Guest mail follows the transition, not the value: re-saving a booking
		 * that was already confirmed must not send a second confirmation.
		 */
		if ( 'confirmed' === $status && 'confirmed' !== $booking['status'] ) {
			BookingEmails::send( EmailTemplatesRepository::BOOKING_APPROVED, $id );
		}

		/*
		 * Settling from here carries the invoice too, exactly as settling an
		 * individual payment on the Payments screen does — and it now records
		 * the payment as well. Marking a booking paid used to change a column
		 * and nothing else: no payment row, so no invoice number, so nothing to
		 * invoice and nothing to re-issue when the booking was later amended.
		 */
		$settled_now = 'paid' === $payment && 'paid' !== $booking['paymentStatus'];

		if ( $settled_now ) {
			$payment_id = self::record_settlement( $id, $changes, $booking );

			BookingEmails::send(
				EmailTemplatesRepository::PAYMENT_RECEIVED,
				$id,
				$payment_id
					? Invoice::attachment( $payment_id )
					: Invoice::attachment_for_booking( $id )
			);
		}

		// Only one email per save: settling already sent one.
		if ( ! $settled_now ) {
			self::settle_balance(
				$id,
				(float) $booking['total'],
				(string) $booking['paymentStatus'],
				$changes
			);
		}

		$booking             = BookingsRepository::find( $id );
		$booking['extras']   = BookingsRepository::extras_for( $id );
		$booking['payments'] = PaymentsRepository::for_booking( $id );
		$booking['history']  = BookingEventsRepository::for_booking( $id );

		return new WP_REST_Response( $booking, 200 );
	}

	/**
	 * Make sure a booking marked paid actually has a payment behind it.
	 *
	 * "Paid" on the Bookings screen used to be a column and nothing more. That
	 * left a booking that claimed to be settled with no payment record, no
	 * invoice number, and therefore nothing to send the guest — and no way to
	 * work out later what had been paid when the booking was amended.
	 *
	 * So the shortfall between what is recorded and what is owed is written
	 * down as a settled payment. Where a request was already waiting — a
	 * balance raised by an earlier edit — that row is marked paid rather than a
	 * second one created beside it, so it keeps its invoice number.
	 *
	 * @param array<string, mixed> $changes What the update wrote.
	 * @param array<string, mixed> $booking The booking as it was before.
	 *
	 * @return int The payment carrying the invoice, or 0 if none was needed.
	 */
	private static function record_settlement( int $id, array $changes, array $booking ): int {
		$total   = (float) ( $changes['total_amount'] ?? $booking['total'] ?? 0 );
		$settled = PaymentsRepository::settled_for( $id );
		$due     = round( $total - $settled, 2 );

		if ( $due <= 0.005 ) {
			// Already covered; invoice whichever payment carries the number.
			$pending = PaymentsRepository::pending_for( $id );

			return null === $pending ? 0 : (int) $pending['id'];
		}

		$pending = PaymentsRepository::pending_for( $id );

		if ( null === $pending ) {
			$payment_id = (int) PaymentsRepository::create(
				array(
					'booking_id' => $id,
					'method'     => 'transfer',
					'status'     => 'paid',
					'amount'     => $due,
					'paid_at'    => current_time( 'mysql', true ),
					'notes'      => __( 'Recorded when the booking was marked paid.', 'booking-suite' ),
				)
			);
		} else {
			$payment_id = (int) $pending['id'];

			PaymentsRepository::set_amount( $payment_id, $due );
			PaymentsRepository::set_status( $payment_id, 'paid' );
		}

		if ( $payment_id ) {
			PaymentsRepository::assign_invoice_number( $payment_id );
		}

		return $payment_id;
	}

	/**
	 * Settle up after the total changes on a booking that was already invoiced.
	 *
	 * This is the guest who books three hours, pays, and then asks at the desk
	 * to make it twelve. What they have paid is now short of what they owe, and
	 * three things are wrong until this runs: the booking still reads as paid,
	 * there is no record of what is outstanding, and the invoice they hold is a
	 * statement of the wrong amount.
	 *
	 * So the difference is raised as its own payment — a real row, with its own
	 * invoice number, that the Payments screen shows as owed and that can be
	 * marked paid when the money lands. The booking's payment status is set
	 * from what has actually been settled rather than from whatever the form
	 * posted, and the guest is sent the new invoice showing the total, what
	 * they have already paid, and the balance.
	 *
	 * Where the total falls below what has been paid, no new charge is raised:
	 * a refund is a decision for the operator, not something to invoice
	 * automatically. The booking is simply marked paid and a corrected invoice
	 * goes out.
	 *
	 * Nothing happens at all unless an invoice was issued and the total has
	 * actually moved — editing a telephone number must not mail anyone.
	 *
	 * @param float                $was        The total before the update.
	 * @param string               $was_status The payment status before it.
	 * @param array<string, mixed> $changes    What the update wrote.
	 */
	private static function settle_balance( int $id, float $was, string $was_status, array $changes ): void {
		if ( ! array_key_exists( 'total_amount', $changes ) ) {
			return;
		}

		$total = (float) $changes['total_amount'];

		// A cent of drift is rounding, not a change of price.
		if ( abs( $total - $was ) < 0.005 ) {
			return;
		}

		self::backfill_settlement( $id, $was, $was_status );

		if ( ! self::has_invoice( $id ) ) {
			return;
		}

		$paid       = PaymentsRepository::settled_for( $id );
		$due        = round( $total - $paid, 2 );
		$payment_id = 0;

		if ( $due > 0.005 ) {
			/*
			 * One outstanding request at a time: if the price changes again
			 * before the guest has paid, the existing one is amended rather
			 * than a second raised beside it. Its invoice number is kept, so
			 * the guest is not handed a new number for the same debt.
			 */
			$pending = PaymentsRepository::pending_for( $id );

			if ( null === $pending ) {
				$payment_id = (int) PaymentsRepository::create(
					array(
						'booking_id' => $id,
						'method'     => 'transfer',
						'status'     => 'pending',
						'amount'     => $due,
						'notes'      => __( 'Balance after the booking was changed.', 'booking-suite' ),
					)
				);
			} else {
				$payment_id = (int) $pending['id'];

				PaymentsRepository::set_amount( $payment_id, $due );
			}

			if ( $payment_id ) {
				PaymentsRepository::assign_invoice_number( $payment_id );
			}
		}

		self::sync_payment_status( $id, $total, $paid );

		// The invoice sent is the one asking for money, where there is one.
		$attachment = $payment_id
			? Invoice::attachment( $payment_id )
			: Invoice::attachment_for_booking( $id );

		BookingEmails::send(
			$due > 0.005
				? EmailTemplatesRepository::BALANCE_DUE
				: EmailTemplatesRepository::PAYMENT_RECEIVED,
			$id,
			$attachment
		);
	}

	/**
	 * Give a booking that was already paid something to show for it.
	 *
	 * Bookings settled before payments were recorded — and any settled by an
	 * older version of this plugin — say "paid" with no payment row behind it.
	 * Amend one of those and there is nothing to work the balance out from, so
	 * the guest gets no invoice and the arithmetic silently starts from zero.
	 *
	 * The booking's own status is the evidence: it said paid, so the total at
	 * the time was settled. That is written down as a payment, and from then on
	 * the booking behaves like any other.
	 *
	 * @param float  $was        The total that was settled.
	 * @param string $was_status The payment status before this update.
	 */
	private static function backfill_settlement( int $id, float $was, string $was_status ): void {
		if ( 'paid' !== $was_status || $was <= 0.005 ) {
			return;
		}

		// Anything already recorded means the booking is not one of these.
		if ( PaymentsRepository::settled_for( $id ) > 0.005 ) {
			return;
		}

		$pending = PaymentsRepository::pending_for( $id );

		if ( null === $pending ) {
			$payment_id = (int) PaymentsRepository::create(
				array(
					'booking_id' => $id,
					'method'     => 'transfer',
					'status'     => 'paid',
					'amount'     => $was,
					'paid_at'    => current_time( 'mysql', true ),
					'notes'      => __( 'Recorded from the booking, which was already marked paid.', 'booking-suite' ),
				)
			);
		} else {
			// A request was waiting and the booking says it was met.
			$payment_id = (int) $pending['id'];

			PaymentsRepository::set_amount( $payment_id, $was );
			PaymentsRepository::set_status( $payment_id, 'paid' );
		}

		if ( $payment_id ) {
			PaymentsRepository::assign_invoice_number( $payment_id );
		}
	}

	/** Whether any payment on this booking has been invoiced. */
	private static function has_invoice( int $id ): bool {
		foreach ( PaymentsRepository::for_booking( $id ) as $row ) {
			$payment = PaymentsRepository::find( (int) $row['id'] );

			if ( null !== $payment && '' !== (string) $payment['invoiceNo'] ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Set the booking's payment status from what has actually been settled.
	 *
	 * Runs after the update above rather than as part of it, because it has to
	 * beat the value the form posted: a screen that opened on a settled booking
	 * sends 'paid', and after the price rises that is simply untrue.
	 *
	 * It goes through the repository rather than writing the column itself.
	 * That used to be a direct $wpdb->update, which made it the one change to a
	 * booking that left no trace — a booking could go from paid to unpaid with
	 * nothing anywhere saying when, or why.
	 */
	private static function sync_payment_status( int $id, float $total, float $paid ): void {
		if ( $paid + 0.005 >= $total ) {
			$status = 'paid';
		} elseif ( $paid > 0.005 ) {
			$status = 'partial';
		} else {
			$status = 'unpaid';
		}

		BookingsRepository::update( $id, array( 'payment_status' => $status ) );
	}

	/**
	 * Erase a booking for good.
	 *
	 * Nothing here is a soft delete: the row goes, and its extras and payments
	 * with it. The screen asks first, and says what will be lost, because this
	 * is the one action on a booking that cannot be walked back.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function destroy( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$booking = BookingsRepository::find( $id );

		if ( null === $booking ) {
			return self::not_found();
		}

		if ( ! BookingsRepository::delete( $id ) ) {
			return new WP_Error(
				'booking_suite_delete_failed',
				__( 'The booking could not be deleted.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response(
			array(
				'deleted'   => true,
				'id'        => $id,
				'reference' => (string) $booking['reference'],
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$booking = BookingsRepository::find( $id );

		if ( null === $booking ) {
			return self::not_found();
		}

		$booking['extras']   = BookingsRepository::extras_for( $id );
		$booking['payments'] = PaymentsRepository::for_booking( $id );
		$booking['history']  = BookingEventsRepository::for_booking( $id );

		return new WP_REST_Response( $booking, 200 );
	}

	/**
	 * Work out the window being booked from either shape of input.
	 *
	 * @return array{room_id: int, guests: int, starts_at: string, ends_at: string, apartment: array<string, mixed>}|WP_Error
	 */
	private static function parse_stay( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( absint( $request->get_param( 'apartmentId' ) ) );

		if ( null === $apartment ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Choose an apartment.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'apartmentId',
				)
			);
		}

		$guests = max( 1, absint( $request->get_param( 'guests' ) ) );

		if ( 'hourly' === $request->get_param( 'mode' ) ) {
			$date  = (string) $request->get_param( 'date' );
			$time  = (string) $request->get_param( 'startTime' );
			$hours = (float) $request->get_param( 'hours' );

			if ( ! self::is_date( $date ) || ! preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $time ) || $hours <= 0 ) {
				return new WP_Error(
					'booking_suite_invalid_field',
					__( 'Give a date, a start time and a length.', 'booking-suite' ),
					array(
						'status' => 400,
						'field'  => 'date',
					)
				);
			}

			$starts = new DateTimeImmutable( $date . ' ' . $time . ':00' );
			$ends   = $starts->modify( '+' . (int) round( $hours * 60 ) . ' minutes' );
		} else {
			$check_in  = (string) $request->get_param( 'checkIn' );
			$check_out = (string) $request->get_param( 'checkOut' );

			if ( ! self::is_date( $check_in ) || ! self::is_date( $check_out ) || $check_out <= $check_in ) {
				return new WP_Error(
					'booking_suite_invalid_field',
					__( 'Give an arrival and a departure date.', 'booking-suite' ),
					array(
						'status' => 400,
						'field'  => 'checkIn',
					)
				);
			}

			$window = RateCalculator::overnight_window( $check_in );

			$starts = new DateTimeImmutable( $window['starts_at'] );
			$ends   = new DateTimeImmutable(
				$check_out . ' ' . SettingsRepository::get( SettingsRepository::OVERNIGHT_END )
			);
		}

		return array(
			'room_id'   => (int) $apartment['id'],
			'apartment' => $apartment,
			'guests'    => $guests,
			'starts_at' => $starts->format( 'Y-m-d H:i:s' ),
			'ends_at'   => $ends->format( 'Y-m-d H:i:s' ),
		);
	}

	/**
	 * Start times for a date, the same picker the guest sees.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function slots( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( absint( $request->get_param( 'apartmentId' ) ) );

		if ( null === $apartment ) {
			return new WP_Error(
				'booking_suite_not_found',
				__( 'That apartment does not exist.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		$date = (string) $request->get_param( 'date' );

		if ( ! self::is_date( $date ) ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Give a date.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'date',
				)
			);
		}

		$guests  = max( 1, absint( $request->get_param( 'guests' ) ) );
		$hours   = (float) $request->get_param( 'hours' );
		$hours   = $hours > 0 ? $hours : (float) SettingsRepository::number( SettingsRepository::BASE_HOURS );
		$exclude = absint( $request->get_param( 'excludeId' ) );

		return new WP_REST_Response(
			array(
				'date'      => $date,
				'hours'     => $hours,
				'durations' => SlotGenerator::duration_options( $apartment, $date, $guests ),
				'slots'     => SlotGenerator::for_date(
					$apartment,
					$date,
					$hours,
					$guests,
					array(
						'includePast'     => true,
						'ignoreBookingId' => $exclude ?: null,
					)
				),
				'currency'  => SettingsRepository::currency(),
			),
			200
		);
	}

	/**
	 * What a stay costs, itemised, before it is saved.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function quote( WP_REST_Request $request ) {
		$stay = self::parse_stay( $request );

		if ( is_wp_error( $stay ) ) {
			return $stay;
		}

		$exclude = absint( $request->get_param( 'excludeId' ) );

		return new WP_REST_Response( self::breakdown( $stay, $exclude ?: null ), 200 );
	}

	/**
	 * The itemised price of a stay.
	 *
	 * @param array<string, mixed> $stay
	 *
	 * @return array<string, mixed>
	 */
	private static function breakdown( array $stay, ?int $exclude = null ): array {
		$quote = RateCalculator::quote(
			$stay['apartment'],
			$stay['starts_at'],
			$stay['ends_at'],
			$stay['guests']
		);

		return array(
			'available'      => BookingsRepository::is_available(
				$stay['room_id'],
				$stay['starts_at'],
				$stay['ends_at'],
				$exclude
			),
			'mode'           => $quote['mode'],
			'startsAt'       => $stay['starts_at'],
			'endsAt'         => $stay['ends_at'],
			'nights'         => $quote['nights'],
			'nightBreakdown' => $quote['nightBreakdown'],
			'duration'       => $quote['duration'],
			'accommodation'  => $quote['accommodation'],
			'guestCharge'    => $quote['guestCharge'],
			'total'          => $quote['subtotal'],
			'currency'       => SettingsRepository::currency(),
			'priced'         => $quote['priced'],
		);
	}

	/**
	 * The agreed total: whatever the operator typed, or the calculated price.
	 *
	 * @param array<string, mixed> $stay
	 */
	private static function total_for( WP_REST_Request $request, array $stay ): float {
		$override = $request->get_param( 'total' );

		/*
		 * The mode is explicit rather than inferred from whether a total was
		 * sent. Inferring it meant a screen that always posted the figure it was
		 * displaying could never get a recalculated price back: every save
		 * looked like an override, so changing the dates left the old total in
		 * place. On 'auto' the figure is recalculated and anything sent with it
		 * is ignored.
		 */
		$manual = 'manual' === (string) $request->get_param( 'priceMode' );

		if ( $manual && null !== $override && '' !== $override ) {
			return max( 0, round( (float) $override, 2 ) );
		}

		$quote = RateCalculator::quote(
			$stay['apartment'],
			$stay['starts_at'],
			$stay['ends_at'],
			$stay['guests']
		);

		return (float) $quote['subtotal'];
	}

	/**
	 * Store the guest, if enough was given to identify one.
	 */
	private static function save_customer( WP_REST_Request $request ): ?int {
		$first = sanitize_text_field( (string) $request->get_param( 'firstName' ) );
		$last  = sanitize_text_field( (string) $request->get_param( 'lastName' ) );
		$email = sanitize_email( (string) $request->get_param( 'email' ) );

		if ( '' === $first && '' === $last && '' === $email ) {
			return null;
		}

		return CustomersRepository::find_or_create(
			array(
				'first_name' => $first,
				'last_name'  => $last,
				'email'      => $email,
				'phone'      => sanitize_text_field( (string) $request->get_param( 'phone' ) ),
			)
		);
	}

	/**
	 * @param string[] $allowed
	 */
	private static function status_param( WP_REST_Request $request, string $key, array $allowed, string $fallback ): string {
		$value = (string) $request->get_param( $key );

		return in_array( $value, $allowed, true ) ? $value : $fallback;
	}

	private static function is_date( string $value ): bool {
		return (bool) preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value );
	}

	private static function conflict(): WP_Error {
		return new WP_Error(
			'booking_suite_unavailable',
			__( 'Another booking already holds those dates.', 'booking-suite' ),
			array(
				'status' => 409,
				'field'  => 'status',
			)
		);
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_not_found',
			__( 'Booking not found.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
