<?php
/**
 * REST routes for availability locks.
 *
 * GET    /booking-suite/v1/blocks?from=&to=   locks overlapping a window
 * POST   /booking-suite/v1/blocks             lock apartments, or everything
 * DELETE /booking-suite/v1/blocks/<id>        release one lock
 *
 * Locking one apartment writes one row. A Master Lock writes a single row with
 * no room_id, which is how the schema expresses "the whole property" — one row
 * to release later rather than one per apartment that could drift apart.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BlocksRepository;
use BookingSuite\Backend\Repositories\ExtrasRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class BlocksController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'blocks';

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
						'from'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'to'    => array(
							'type'     => 'string',
							'required' => false,
						),
						'scope' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => array(
								BlocksRepository::SCOPE_APARTMENT,
								BlocksRepository::SCOPE_EXTRA,
							),
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'create' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'apartmentIds' => array(
							'type'     => 'array',
							'required' => false,
							'items'    => array( 'type' => 'integer' ),
						),
						'extraIds'     => array(
							'type'     => 'array',
							'required' => false,
							'items'    => array( 'type' => 'integer' ),
						),
						'scope'        => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => array(
								BlocksRepository::SCOPE_APARTMENT,
								BlocksRepository::SCOPE_EXTRA,
							),
						),
						'master'       => array(
							'type'     => 'boolean',
							'required' => false,
						),
						'startsAt'     => array(
							'type'     => 'string',
							'required' => true,
						),
						'endsAt'       => array(
							'type'     => 'string',
							'required' => true,
						),
						'reason'       => array(
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
		$from  = self::datetime( (string) $request->get_param( 'from' ), '00:00:00' );
		$to    = self::datetime( (string) $request->get_param( 'to' ), '23:59:59' );
		$scope = (string) $request->get_param( 'scope' )
			?: BlocksRepository::SCOPE_APARTMENT;

		$blocks = ( $from && $to )
			? BlocksRepository::in_window( $from, $to, $scope )
			: BlocksRepository::all( $scope );

		return new WP_REST_Response(
			array(
				'blocks'     => $blocks,
				'apartments' => array_map(
					static fn( array $a ): array => array(
						'id'     => (int) $a['id'],
						'name'   => (string) $a['name'],
						'colour' => (string) $a['colour'],
					),
					ApartmentsRepository::all()
				),
				// Both lists travel together so the dialog can offer either.
				'extras'     => array_map(
					static fn( array $e ): array => array(
						'id'     => (int) $e['id'],
						'name'   => (string) $e['name'],
						'colour' => '#64748b',
					),
					ExtrasRepository::all()
				),
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create( WP_REST_Request $request ) {
		$starts_at = self::datetime( (string) $request->get_param( 'startsAt' ) );
		$ends_at   = self::datetime( (string) $request->get_param( 'endsAt' ) );

		if ( null === $starts_at || null === $ends_at ) {
			return self::invalid(
				__( 'Give a start and an end for the lock.', 'booking-suite' ),
				'startsAt'
			);
		}

		if ( $ends_at <= $starts_at ) {
			return self::invalid(
				__( 'The lock must end after it starts.', 'booking-suite' ),
				'endsAt'
			);
		}

		$reason = (string) $request->get_param( 'reason' );
		$master = (bool) $request->get_param( 'master' );
		$scope  = (string) $request->get_param( 'scope' )
			?: BlocksRepository::SCOPE_APARTMENT;

		$is_extra = BlocksRepository::SCOPE_EXTRA === $scope;

		$ids = array_values(
			array_unique(
				array_filter(
					array_map(
						'absint',
						(array) $request->get_param(
							$is_extra ? 'extraIds' : 'apartmentIds'
						)
					)
				)
			)
		);

		if ( $master ) {
			/*
			 * An apartment master lock is a single row with no apartment. For
			 * extras there is no such row — both columns NULL already means the
			 * apartment-wide lock — so it fans out to one row per extra.
			 */
			$ids = $is_extra
				? array_map(
					static fn( array $e ): int => (int) $e['id'],
					ExtrasRepository::all()
				)
				: array( null );
		}

		if ( ! $ids ) {
			return self::invalid(
				$is_extra
					? __( 'Choose at least one extra to lock.', 'booking-suite' )
					: __( 'Choose at least one apartment to lock.', 'booking-suite' ),
				$is_extra ? 'extraIds' : 'apartmentIds'
			);
		}

		$created = array();

		foreach ( $ids as $target ) {
			$id = BlocksRepository::create(
				$is_extra ? null : $target,
				$starts_at,
				$ends_at,
				$reason,
				$is_extra ? $target : null
			);

			if ( $id ) {
				$created[] = BlocksRepository::find( $id );
			}
		}

		if ( ! $created ) {
			return new WP_Error(
				'booking_suite_lock_failed',
				__( 'The lock could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response(
			array(
				'blocks' => $created,
				/*
				 * Locking stops NEW bookings; it does not cancel anything
				 * already taken. Handing these back lets the screen say so
				 * instead of leaving it to be discovered later.
				 *
				 * Only for apartments: an extra being unavailable does not put
				 * a stay in question, so listing the stays would be noise.
				 */
				'affected' => $is_extra
					? array()
					: BlocksRepository::bookings_inside(
						$master ? null : ( $ids[0] ?? null ),
						$starts_at,
						$ends_at
					),
			),
			201
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function destroy( WP_REST_Request $request ) {
		$id = (int) $request['id'];

		if ( null === BlocksRepository::find( $id ) ) {
			return new WP_Error(
				'booking_suite_block_not_found',
				__( 'That lock no longer exists.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		BlocksRepository::delete( $id );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id ), 200 );
	}

	/**
	 * Accepts 'Y-m-d H:i' or 'Y-m-d', filling in the time when absent.
	 */
	private static function datetime( string $value, string $fallback_time = '00:00:00' ): ?string {
		$value = trim( str_replace( 'T', ' ', $value ) );

		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return $value . ' ' . $fallback_time;
		}

		if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $value ) ) {
			return $value . ':00';
		}

		if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $value ) ) {
			return $value;
		}

		return null;
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
