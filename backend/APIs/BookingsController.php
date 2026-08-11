<?php
/**
 * Admin REST routes for bookings.
 *
 * GET /booking-suite/v1/bookings       list, with filters
 * GET /booking-suite/v1/bookings/<id>  one booking, with its extras
 *
 * Read-only for now: creating, editing and cancelling from the admin comes
 * later.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
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

		// Settling from here carries the invoice too, exactly as settling an
		// individual payment on the Payments screen does.
		if ( 'paid' === $payment && 'paid' !== $booking['paymentStatus'] ) {
			BookingEmails::send(
				EmailTemplatesRepository::PAYMENT_RECEIVED,
				$id,
				Invoice::attachment_for_booking( $id )
			);
		}

		$booking             = BookingsRepository::find( $id );
		$booking['extras']   = BookingsRepository::extras_for( $id );
		$booking['payments'] = PaymentsRepository::for_booking( $id );

		return new WP_REST_Response( $booking, 200 );
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
	 * The agreed total: whatever the operator typed, or the calculated price.
	 *
	 * @param array<string, mixed> $stay
	 */
	private static function total_for( WP_REST_Request $request, array $stay ): float {
		$override = $request->get_param( 'total' );

		if ( null !== $override && '' !== $override ) {
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
