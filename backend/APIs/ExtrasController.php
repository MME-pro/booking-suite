<?php
/**
 * REST routes for extras.
 *
 * GET    /booking-suite/v1/extras        list
 * POST   /booking-suite/v1/extras        create
 * GET    /booking-suite/v1/extras/<id>   read
 * PUT    /booking-suite/v1/extras/<id>   update
 * DELETE /booking-suite/v1/extras/<id>   delete
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ExtrasRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class ExtrasController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'extras';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	private const MAX_LENGTH = 191;

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
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'create' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => self::args( true ),
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
					'args'                => self::args( false ),
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

	/**
	 * @param bool $creating Name is only required when creating.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private static function args( bool $creating ): array {
		return array(
			'name'        => array(
				'type'              => 'string',
				'required'          => $creating,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'description' => array(
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'wp_kses_post',
			),
			'price'       => array(
				'type'     => 'number',
				'required' => false,
			),
			// null is a legal value: it is what "unlimited" means.
			'stock'       => array(
				'required' => false,
			),
			'image_url'   => array(
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'esc_url_raw',
			),
			'sort_order'  => array(
				'type'     => 'integer',
				'required' => false,
			),
			'room_ids'    => array(
				'type'     => 'array',
				'required' => false,
				'items'    => array( 'type' => 'integer' ),
			),
			'active'      => array(
				'type'     => 'boolean',
				'required' => false,
			),
		);
	}

	public static function index(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'extras' => ExtrasRepository::all(),
				'booked' => (object) ExtrasRepository::booked_quantities(),
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $request ) {
		$extra = ExtrasRepository::find( (int) $request['id'] );

		if ( null === $extra ) {
			return self::not_found();
		}

		return new WP_REST_Response( $extra, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $request ) {
		$data = self::payload( $request, true );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$extra = ExtrasRepository::create( $data );

		if ( null === $extra ) {
			return new WP_Error(
				'booking_suite_extra_not_created',
				__( 'The extra could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( $extra, 201 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $request ) {
		$data = self::payload( $request, false );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$extra = ExtrasRepository::update( (int) $request['id'], $data );

		if ( null === $extra ) {
			return self::not_found();
		}

		return new WP_REST_Response( $extra, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function destroy( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === ExtrasRepository::find( $id ) ) {
			return self::not_found();
		}

		ExtrasRepository::delete( $id );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id ), 200 );
	}

	/**
	 * Validates and shapes the incoming values.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function payload( WP_REST_Request $request, bool $creating ) {
		$data = array();

		if ( $creating || null !== $request->get_param( 'name' ) ) {
			$name = trim( (string) $request->get_param( 'name' ) );

			if ( '' === $name ) {
				return self::invalid(
					__( 'The extra needs a name.', 'booking-suite' ),
					'name'
				);
			}

			$data['name'] = mb_substr( $name, 0, self::MAX_LENGTH );
		}

		if ( null !== $request->get_param( 'description' ) ) {
			$data['description'] = (string) $request->get_param( 'description' );
		}

		if ( null !== $request->get_param( 'price' ) ) {
			$price = (float) $request->get_param( 'price' );

			if ( $price < 0 ) {
				return self::invalid(
					__( 'The price cannot be negative.', 'booking-suite' ),
					'price'
				);
			}

			$data['price'] = $price;
		}

		/*
		 * Stock arrives as null when the operator has stock management off,
		 * which is stored as NULL and read back as "unlimited".
		 */
		if ( $request->has_param( 'stock' ) ) {
			$stock = $request->get_param( 'stock' );

			if ( null === $stock || '' === $stock ) {
				$data['stock'] = null;
			} else {
				$stock = (int) $stock;

				if ( $stock < 0 ) {
					return self::invalid(
						__( 'The stock quantity cannot be negative.', 'booking-suite' ),
						'stock'
					);
				}

				$data['stock'] = $stock;
			}
		}

		foreach ( array( 'image_url', 'sort_order', 'room_ids', 'active' ) as $key ) {
			if ( null !== $request->get_param( $key ) ) {
				$data[ $key ] = $request->get_param( $key );
			}
		}

		return $data;
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_extra_not_found',
			__( 'That extra no longer exists.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}

	private static function invalid( string $message, string $field ): WP_Error {
		return new WP_Error(
			'booking_suite_invalid_field',
			$message,
			array(
				'status' => 400,
				'field'  => $field,
			)
		);
	}
}
