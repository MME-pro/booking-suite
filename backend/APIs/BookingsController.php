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

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
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
				(int) $booking['room_id'],
				(string) $booking['starts_at'],
				(string) $booking['ends_at'],
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

		$updated = BookingsRepository::update_state(
			$id,
			array(
				'status'         => $status,
				'payment_status' => $payment,
			)
		);

		if ( ! $updated ) {
			return new WP_Error(
				'booking_suite_update_failed',
				__( 'The booking could not be updated.', 'booking-suite' ),
				array( 'status' => 500 )
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

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_not_found',
			__( 'Booking not found.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
