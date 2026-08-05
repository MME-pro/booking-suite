<?php
/**
 * REST routes for payments.
 *
 * GET /booking-suite/v1/payments        list, with stats
 * GET /booking-suite/v1/payments/<id>   read
 * PUT /booking-suite/v1/payments/<id>   move the payment along
 *
 * Payments are created by the booking flow, not here — this is the settling
 * side of the ledger.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Support\BookingEmails;
use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\PaymentsTable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class PaymentsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'payments';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/**
	 * Settling a payment moves the booking's own payment status with it, so
	 * the two never disagree on the bookings screen.
	 */
	private const BOOKING_STATUS = array(
		'paid'     => 'paid',
		'refunded' => 'refunded',
		'pending'  => 'unpaid',
		'failed'   => 'unpaid',
	);

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'index' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'status' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => PaymentsTable::STATUSES,
						),
					),
				),
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
						'status' => array(
							'type'     => 'string',
							'required' => true,
							'enum'     => PaymentsTable::STATUSES,
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
		return new WP_REST_Response(
			array(
				'payments' => PaymentsRepository::all(
					(string) $request->get_param( 'status' )
				),
				'stats'    => PaymentsRepository::stats(),
				'statuses' => PaymentsTable::STATUSES,
				'methods'  => PaymentsTable::METHODS,
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $request ) {
		$payment = PaymentsRepository::find( (int) $request['id'] );

		if ( null === $payment ) {
			return self::not_found();
		}

		return new WP_REST_Response( $payment, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $request ) {
		$id       = (int) $request['id'];
		$status   = (string) $request->get_param( 'status' );
		$previous = PaymentsRepository::find( $id );
		$payment  = PaymentsRepository::set_status( $id, $status );

		if ( null === $payment ) {
			return self::not_found();
		}

		self::sync_booking( $payment, $status );

		// On the transition only, so re-saving a settled payment stays quiet.
		if ( 'paid' === $status && 'paid' !== ( $previous['status'] ?? '' ) ) {
			BookingEmails::send(
				EmailTemplatesRepository::PAYMENT_RECEIVED,
				(int) $payment['bookingId']
			);
		}

		return new WP_REST_Response( $payment, 200 );
	}

	/**
	 * Keeps the booking's payment status in step with its payments.
	 *
	 * A booking can carry more than one payment, so it only counts as paid
	 * once nothing is left outstanding; anything short of that is 'partial'.
	 *
	 * @param array<string, mixed> $payment
	 */
	private static function sync_booking( array $payment, string $status ): void {
		global $wpdb;

		$booking_id = (int) ( $payment['bookingId'] ?? 0 );

		if ( ! $booking_id || ! isset( self::BOOKING_STATUS[ $status ] ) ) {
			return;
		}

		$booking = BookingsRepository::find( $booking_id );

		if ( null === $booking ) {
			return;
		}

		$next = self::BOOKING_STATUS[ $status ];

		if ( 'paid' === $status ) {
			$settled = 0.0;

			foreach ( PaymentsRepository::for_booking( $booking_id ) as $row ) {
				if ( 'paid' === $row['status'] ) {
					$settled += (float) $row['amount'];
				}
			}

			// A rounding tolerance, so cents cannot leave a booking "partial".
			$next = $settled + 0.01 >= (float) $booking['total'] ? 'paid' : 'partial';
		}

		$wpdb->update(
			BookingsTable::table(),
			array(
				'payment_status' => $next,
				'updated_at'     => current_time( 'mysql', true ),
			),
			array( 'id' => $booking_id )
		);
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_payment_not_found',
			__( 'That payment no longer exists.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
