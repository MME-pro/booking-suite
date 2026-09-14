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
use BookingSuite\Backend\Support\Invoice;
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
			'/' . self::ROUTE,
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'store' ),
				'permission_callback' => array( self::class, 'can_manage' ),
				'args'                => array(
					'bookingId' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'amount'    => array(
						'type'     => 'number',
						'required' => true,
					),
					'method'    => array(
						'type'     => 'string',
						'required' => false,
						'enum'     => PaymentsTable::METHODS,
					),
					'paidAt'    => array(
						'type'     => 'string',
						'required' => false,
					),
					'notes'     => array(
						'type'     => 'string',
						'required' => false,
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
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( self::class, 'destroy' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);
	}

	/**
	 * Remove a payment, and put the booking's status back where it belongs.
	 *
	 * The repository does the recalculating: a booking marked paid for money
	 * no longer recorded anywhere is the one state nobody can reconcile
	 * against a bank statement.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function destroy( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === PaymentsRepository::find( $id ) ) {
			return new WP_Error(
				'booking_suite_not_found',
				__( 'That payment no longer exists.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		PaymentsRepository::delete( $id );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id ), 200 );
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
	/**
	 * Write down money that has arrived.
	 *
	 * The missing half of this screen. Everything else here could only move a
	 * payment the booking flow had already created, for the amount that flow
	 * decided — so a guest who transferred part of what they owed could not be
	 * recorded at all, and "partially paid" was a state the software could
	 * describe but nobody could reach.
	 *
	 * Recorded as settled, because that is what it is: this is the operator
	 * saying the money is in the account. A negative amount is a refund, which
	 * is how refunds are already stored.
	 *
	 * No email and no invoice. Those follow marking a payment off in the
	 * ledger, where the decision to tell the guest is made deliberately — a
	 * part payment being written down is bookkeeping, and a guest who has paid
	 * half does not want a receipt saying so.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function store( WP_REST_Request $request ) {
		$booking_id = (int) $request->get_param( 'bookingId' );
		$booking    = BookingsRepository::find( $booking_id );

		if ( null === $booking ) {
			return new WP_Error(
				'booking_suite_not_found',
				__( 'That booking no longer exists.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		$amount = round( (float) $request->get_param( 'amount' ), 2 );

		if ( abs( $amount ) < 0.005 ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Enter how much was received.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'amount',
				)
			);
		}

		/*
		 * A date the operator typed, kept as the site's wall clock like every
		 * other timestamp here. Anything unreadable falls back to now rather
		 * than being stored as a zero date nobody can sort by.
		 */
		$paid_at = trim( (string) $request->get_param( 'paidAt' ) );
		$stamp   = '' !== $paid_at ? strtotime( $paid_at ) : false;

		$created = PaymentsRepository::create(
			array(
				'booking_id' => $booking_id,
				'method'     => (string) ( $request->get_param( 'method' ) ?: 'transfer' ),
				'status'     => 'paid',
				'amount'     => $amount,
				'reference'  => (string) ( $booking['reference'] ?? '' ),
				'paid_at'    => false !== $stamp ? gmdate( 'Y-m-d H:i:s', $stamp ) : current_time( 'mysql' ),
				'notes'      => (string) $request->get_param( 'notes' ),
			)
		);

		if ( null === $created ) {
			return new WP_Error(
				'booking_suite_create_failed',
				__( 'The payment could not be recorded.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		$state = PaymentsRepository::resync_booking( $booking_id );

		return new WP_REST_Response(
			array(
				'payment'       => PaymentsRepository::find( $created ),
				'paymentStatus' => $state,
			),
			201
		);
	}

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
			$attachment = Invoice::attachment( $id );

			// Re-read so the screen sees the invoice number without reloading.
			$payment = PaymentsRepository::find( $id ) ?? $payment;

			BookingEmails::send(
				EmailTemplatesRepository::PAYMENT_RECEIVED,
				(int) $payment['bookingId'],
				$attachment
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

		/*
		 * Settling a payment is the one case where the answer is arithmetic
		 * rather than a mapping: what the booking now reads depends on every
		 * other payment against it, not on this one. Refunded and failed keep
		 * their mapping, because those say something the sum cannot.
		 */
		if ( 'paid' === $status ) {
			PaymentsRepository::resync_booking( $booking_id );

			return;
		}

		$next = self::BOOKING_STATUS[ $status ];

		$wpdb->update(
			BookingsTable::table(),
			array(
				'payment_status' => $next,
				'updated_at'     => current_time( 'mysql' ),
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
