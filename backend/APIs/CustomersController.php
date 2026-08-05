<?php
/**
 * REST routes for guests.
 *
 * GET /booking-suite/v1/customers                 list, with stats
 * GET /booking-suite/v1/customers/<id>            read
 * GET /booking-suite/v1/customers/<id>/bookings   that guest's stays, newest first
 *
 * Guests are created by the booking flow, so there is nothing to write here.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\CustomersRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class CustomersController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'customers';

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
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<id>\d+)/bookings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'bookings' ),
					'permission_callback' => array( self::class, 'can_manage' ),
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
				'customers' => CustomersRepository::all(
					(string) $request->get_param( 'search' )
				),
				'stats'     => CustomersRepository::stats(),
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $request ) {
		$customer = CustomersRepository::find( (int) $request['id'] );

		if ( null === $customer ) {
			return self::not_found();
		}

		return new WP_REST_Response( $customer, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bookings( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === CustomersRepository::find( $id ) ) {
			return self::not_found();
		}

		return new WP_REST_Response(
			array( 'bookings' => CustomersRepository::bookings_for( $id ) ),
			200
		);
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_customer_not_found',
			__( 'That guest no longer exists.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
