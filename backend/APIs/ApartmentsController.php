<?php
/**
 * REST routes for apartments.
 *
 * GET    /booking-suite/v1/apartments        list
 * POST   /booking-suite/v1/apartments        create
 * GET    /booking-suite/v1/apartments/<id>   read
 * PUT    /booking-suite/v1/apartments/<id>   update
 * DELETE /booking-suite/v1/apartments/<id>   delete
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Schemas\RoomsTable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class ApartmentsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'apartments';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	private const MAX_LENGTH = 191;

	private const MIN_CAPACITY = 1;

	private const MAX_CAPACITY = 65535;

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
						'active' => array(
							'type'     => 'boolean',
							'required' => false,
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'create' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<id>\d+)',
			array(
				'args' => array(
					'id' => array(
						'type'     => 'integer',
						'required' => true,
					),
				),
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'show' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update' ),
					'permission_callback' => array( self::class, 'can_manage' ),
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
		$apartments = ApartmentsRepository::all(
			array(
				'search'  => (string) $request->get_param( 'search' ),
				'active'  => null !== $request->get_param( 'active' )
					? (bool) $request->get_param( 'active' )
					: null,
				'orderby' => (string) $request->get_param( 'orderby' ),
				'order'   => (string) $request->get_param( 'order' ),
			)
		);

		return new WP_REST_Response(
			array_map( array( self::class, 'with_images' ), $apartments ),
			200
		);
	}

	/**
	 * Attachment ids alone cannot be rendered, so each row carries resolved
	 * thumbnails alongside the raw `images` column.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<string, mixed>
	 */
	private static function with_images( array $apartment ): array {
		$resolved = array();

		foreach ( (array) $apartment['images'] as $attachment_id ) {
			$attachment_id = (int) $attachment_id;
			$url           = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );

			if ( ! $url ) {
				continue;
			}

			$resolved[] = array(
				'id'   => $attachment_id,
				'url'  => $url,
				'full' => wp_get_attachment_image_url( $attachment_id, 'large' ) ?: $url,
				'alt'  => (string) get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ),
			);
		}

		$apartment['images_data'] = $resolved;

		return $apartment;
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function show( WP_REST_Request $request ) {
		$apartment = ApartmentsRepository::find( (int) $request['id'] );

		if ( null === $apartment ) {
			return self::not_found();
		}

		return new WP_REST_Response( self::with_images( $apartment ), 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $request ) {
		$data = self::sanitize( $request, true );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$conflict = self::check_short_links( $data, null );

		if ( is_wp_error( $conflict ) ) {
			return $conflict;
		}

		$id = ApartmentsRepository::create( $data );

		if ( null === $id ) {
			return new WP_Error(
				'booking_suite_create_failed',
				__( 'The apartment could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( self::with_images( ApartmentsRepository::find( $id ) ), 201 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === ApartmentsRepository::find( $id ) ) {
			return self::not_found();
		}

		$data = self::sanitize( $request, false );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$conflict = self::check_short_links( $data, $id );

		if ( is_wp_error( $conflict ) ) {
			return $conflict;
		}

		if ( ! ApartmentsRepository::update( $id, $data ) ) {
			return new WP_Error(
				'booking_suite_update_failed',
				__( 'The apartment could not be updated.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( self::with_images( ApartmentsRepository::find( $id ) ), 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function destroy( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === ApartmentsRepository::find( $id ) ) {
			return self::not_found();
		}

		if ( ! ApartmentsRepository::delete( $id ) ) {
			return new WP_Error(
				'booking_suite_delete_failed',
				__( 'The apartment could not be deleted.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id ), 200 );
	}

	/**
	 * Validate and sanitize the writable columns.
	 *
	 * On create every required column must be present; on update only the
	 * columns actually sent are touched.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function sanitize( WP_REST_Request $request, bool $is_create ) {
		$data = array();

		$has = static fn( string $key ): bool => null !== $request->get_param( $key );

		if ( $is_create || $has( 'name' ) ) {
			$name = trim( sanitize_text_field( (string) $request->get_param( 'name' ) ) );

			if ( '' === $name ) {
				return self::invalid( __( 'A name is required.', 'booking-suite' ), 'name' );
			}

			$data['name'] = mb_substr( $name, 0, self::MAX_LENGTH );
		}

		if ( $is_create || $has( 'capacity' ) ) {
			$capacity = (int) $request->get_param( 'capacity' );

			if ( $capacity < self::MIN_CAPACITY || $capacity > self::MAX_CAPACITY ) {
				return self::invalid(
					__( 'Guests must be between 1 and 65535.', 'booking-suite' ),
					'capacity'
				);
			}

			$data['capacity'] = $capacity;
		}

		if ( $is_create || $has( 'colour' ) ) {
			$colour = sanitize_hex_color( (string) $request->get_param( 'colour' ) );

			if ( null === $colour || '' === $colour ) {
				return self::invalid(
					__( 'The colour must be a hex value such as #3858e9.', 'booking-suite' ),
					'colour'
				);
			}

			$data['colour'] = $colour;
		}

		if ( $is_create || $has( 'cleaning_min' ) ) {
			$cleaning = (int) $request->get_param( 'cleaning_min' );

			if ( ! in_array( $cleaning, RoomsTable::CLEANING_MINUTES, true ) ) {
				return self::invalid(
					sprintf(
						/* translators: %s: comma-separated list of allowed minutes. */
						__( 'Cleaning time must be one of: %s.', 'booking-suite' ),
						implode( ', ', RoomsTable::CLEANING_MINUTES )
					),
					'cleaning_min'
				);
			}

			$data['cleaning_min'] = $cleaning;
		}

		foreach ( array( 'weekday_rate', 'weekend_rate' ) as $rate ) {
			if ( ! $has( $rate ) ) {
				continue;
			}

			$value = (float) $request->get_param( $rate );

			if ( $value < 0 ) {
				return self::invalid( __( 'Rates cannot be negative.', 'booking-suite' ), $rate );
			}

			$data[ $rate ] = round( $value, 2 );
		}

		if ( $has( 'description' ) ) {
			$data['description'] = wp_kses_post( (string) $request->get_param( 'description' ) );
		}

		if ( $has( 'images' ) ) {
			$data['images'] = array_map( 'absint', (array) $request->get_param( 'images' ) );
		}

		foreach ( array( 'internal_short_link', 'booking_short_link' ) as $column ) {
			if ( ! $has( $column ) ) {
				continue;
			}

			$link = sanitize_title( (string) $request->get_param( $column ) );

			$data[ $column ] = mb_substr( $link, 0, self::MAX_LENGTH );
		}

		if ( $has( 'holiday_hesse' ) ) {
			$data['holiday_hesse'] = rest_sanitize_boolean( $request->get_param( 'holiday_hesse' ) ) ? 1 : 0;
		}

		if ( $has( 'active' ) ) {
			$data['active'] = rest_sanitize_boolean( $request->get_param( 'active' ) ) ? 1 : 0;
		}

		return $data;
	}

	/**
	 * Both short links carry a UNIQUE key; report the clash as 409 rather than
	 * letting the insert fail with a database error.
	 *
	 * @param array<string, mixed> $data
	 *
	 * @return true|WP_Error
	 */
	private static function check_short_links( array $data, ?int $ignore_id ) {
		foreach ( array( 'internal_short_link', 'booking_short_link' ) as $column ) {
			$value = $data[ $column ] ?? '';

			if ( '' === $value ) {
				continue;
			}

			if ( ApartmentsRepository::short_link_taken( $column, (string) $value, $ignore_id ) ) {
				return new WP_Error(
					'booking_suite_short_link_taken',
					__( 'That short link is already used by another apartment.', 'booking-suite' ),
					array(
						'status' => 409,
						'field'  => $column,
					)
				);
			}
		}

		return true;
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

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_not_found',
			__( 'Apartment not found.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
