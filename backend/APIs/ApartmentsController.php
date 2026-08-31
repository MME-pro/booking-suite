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
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use BookingSuite\Backend\Schemas\RoomsTable;
use BookingSuite\Backend\Support\IcalFeed;
use BookingSuite\Backend\Support\IcalParser;
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
	 * The calendar sync data rides along for the same reason: none of it is a
	 * column on the apartment — the subscriptions are rows in their own table,
	 * the export link is derived from a token — but the apartment form owns
	 * all of it, and making it fetch them separately would mean two more round
	 * trips for every apartment listed.
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

		$id = (int) $apartment['id'];

		$apartment['ical_feeds'] = IcalFeedsRepository::for_apartment( $id );

		/*
		 * Read, never mint. Listing apartments must not quietly publish a live
		 * public calendar for every one of them — the token arrives when the
		 * operator presses the button.
		 */
		$token = ApartmentsRepository::token( $id );

		$apartment['ical_export_url']   = IcalFeed::url_from_token( $token );
		$apartment['ical_fallback_url'] = IcalFeed::fallback_from_token( $token );

		// The same link under each scope, so the form can offer the feed for a
		// portal without a second request once the token exists.
		$apartment['ical_exports'] = IcalFeed::exports( $id, $token );

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

		// Checked before the apartment is written: a subscription that will be
		// refused must not leave a half-saved apartment behind.
		$feeds = self::feeds_param( $request );

		if ( is_wp_error( $feeds ) ) {
			return $feeds;
		}

		$id = ApartmentsRepository::create( $data );

		if ( null === $id ) {
			return new WP_Error(
				'booking_suite_create_failed',
				__( 'The apartment could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		if ( null !== $feeds ) {
			self::save_feeds( $id, $feeds );
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

		$feeds = self::feeds_param( $request );

		if ( is_wp_error( $feeds ) ) {
			return $feeds;
		}

		if ( ! ApartmentsRepository::update( $id, $data ) ) {
			return new WP_Error(
				'booking_suite_update_failed',
				__( 'The apartment could not be updated.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		if ( null !== $feeds ) {
			self::save_feeds( $id, $feeds );
		}

		return new WP_REST_Response( self::with_images( ApartmentsRepository::find( $id ) ), 200 );
	}

	/**
	 * The subscriptions the form posted, cleaned and checked.
	 *
	 * Answers null when the field was not sent at all, which is not the same
	 * as sending an empty list: a screen that knows nothing about calendars —
	 * a toggle of `active` from somewhere else, say — must not unsubscribe
	 * every portal by omission, whereas an operator who removed the last row
	 * genuinely means it.
	 *
	 * Every row is checked before any of them is written, so a save either
	 * takes the whole list or leaves it exactly as it was.
	 *
	 * @return array<int, array<string, mixed>>|WP_Error|null
	 */
	private static function feeds_param( WP_REST_Request $request ) {
		$raw = $request->get_param( 'ical_feeds' );

		if ( null === $raw ) {
			return null;
		}

		$rows = array();
		$seen = array();

		foreach ( (array) $raw as $row ) {
			$row = (array) $row;
			$url = IcalController::clean_url( (string) ( $row['url'] ?? '' ) );

			/*
			 * A row with no link is one the operator opened and did not fill
			 * in. Dropping it beats refusing the save: pressing "Add
			 * subscription" and changing your mind should not stand between
			 * you and saving a rate.
			 */
			if ( '' === $url ) {
				continue;
			}

			if ( ! wp_http_validate_url( $url ) ) {
				return self::invalid(
					__( 'Paste the calendar link the portal gave you — it should start with https://', 'booking-suite' ),
					'ical_feeds'
				);
			}

			/*
			 * Two subscriptions to one URL would fight over the same locks on
			 * every sync, each undoing the other. Compared case-insensitively
			 * because a host is case-insensitive and this is nearly always a
			 * link pasted twice by accident.
			 */
			$key = strtolower( $url );

			if ( isset( $seen[ $key ] ) ) {
				return self::invalid(
					__( 'That calendar is listed twice. Each subscription needs its own link.', 'booking-suite' ),
					'ical_feeds'
				);
			}

			$seen[ $key ] = true;

			// An unrecognised portal is read off the link rather than refused:
			// the choice is only a label until the first sync, after which the
			// file itself says who wrote it.
			$source = (string) ( $row['source'] ?? '' );

			if ( ! in_array( $source, IcalParser::SOURCES, true ) ) {
				$source = IcalParser::detect_source( $url );
			}

			/*
			 * A subscription is a link and the portal it came from. The name is
			 * still a column because other screens read it, but it is the
			 * portal's own label rather than something typed in; and a
			 * subscription always syncs, since one that should not is one whose
			 * link should be cleared instead. Both are settled here rather than
			 * taken from the request, so the REST route and the meta box cannot
			 * disagree about what a row means.
			 */
			$rows[] = array(
				'id'     => absint( $row['id'] ?? 0 ),
				'name'   => IcalParser::source_label( $source ),
				'url'    => $url,
				'source' => $source,
				'active' => true,
			);
		}

		return $rows;
	}

	/**
	 * Make this apartment's subscriptions match the list it was sent.
	 *
	 * The form owns the whole list, so this is a reconciliation rather than a
	 * series of edits: rows carrying an id are updated, rows without one are
	 * added, and anything the list no longer mentions is removed.
	 *
	 * Nothing is pulled here. Saving an apartment should not sit waiting on a
	 * portal's server, and a new subscription is picked up by the next
	 * scheduled sync anyway.
	 *
	 * @param array<int, array<string, mixed>> $rows From feeds_param().
	 */
	private static function save_feeds( int $apartment_id, array $rows ): void {
		$existing = array();

		foreach ( IcalFeedsRepository::for_apartment( $apartment_id ) as $feed ) {
			$existing[ (int) $feed['id'] ] = $feed;
		}

		$kept = array();

		foreach ( $rows as $row ) {
			$id = (int) $row['id'];

			/*
			 * An id is only honoured if it is one of this apartment's own. A
			 * number from anywhere else — another apartment's subscription, or
			 * one deleted in a second tab — is treated as a new row rather
			 * than allowed to overwrite something it does not belong to.
			 */
			if ( $id && isset( $existing[ $id ] ) ) {
				IcalFeedsRepository::update(
					$id,
					array(
						'name'   => $row['name'],
						'url'    => $row['url'],
						'source' => $row['source'],
						'active' => $row['active'],
					)
				);

				$kept[ $id ] = true;

				continue;
			}

			IcalFeedsRepository::create(
				array(
					'room_id' => $apartment_id,
					'name'    => $row['name'],
					'url'     => $row['url'],
					'source'  => $row['source'],
					'active'  => $row['active'],
				)
			);
		}

		/*
		 * Removed rows unsubscribe, but the locks they already brought in
		 * stay. Dates a portal has sold are still sold after the subscription
		 * goes, and dropping them here would silently put a booked apartment
		 * back on sale.
		 */
		foreach ( array_keys( $existing ) as $id ) {
			if ( ! isset( $kept[ $id ] ) ) {
				IcalFeedsRepository::delete( (int) $id );
			}
		}
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

		// The two surcharges validate exactly as the rates do — a negative one
		// would pay the guest to bring a friend.
		$rates = array( 'weekday_rate', 'weekend_rate', 'surcharge_hour', 'surcharge_guest' );

		foreach ( $rates as $rate ) {
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
