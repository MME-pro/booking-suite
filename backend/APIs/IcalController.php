<?php
/**
 * REST routes for calendar import and synchronisation.
 *
 * GET    /booking-suite/v1/ical                  subscriptions and what they need
 * POST   /booking-suite/v1/ical/import           read an uploaded .ics file
 * POST   /booking-suite/v1/ical/feeds            subscribe to a calendar URL
 * PUT    /booking-suite/v1/ical/feeds/<id>       change a subscription
 * DELETE /booking-suite/v1/ical/feeds/<id>       unsubscribe
 * POST   /booking-suite/v1/ical/feeds/<id>/sync  pull one now
 * POST   /booking-suite/v1/ical/sync             pull every switched-on feed
 *
 * The upload route takes the file as text in a JSON body rather than as a
 * multipart upload. An .ics export is a few kilobytes of plain text that is
 * read once and never stored as a file, so putting it through the media
 * library — with its upload directory, its permitted mime types and its
 * attachment row to clean up afterwards — would be machinery in exchange for
 * nothing. The browser reads the file and posts its contents.
 *
 * Import is previewed by asking for the same thing with `dryRun`, which runs
 * the entire comparison and writes nothing. What the operator is shown is
 * therefore produced by the code that will do the work, not by a description
 * of it.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use BookingSuite\Backend\Support\IcalFeed;
use BookingSuite\Backend\Support\IcalImporter;
use BookingSuite\Backend\Support\IcalParser;
use BookingSuite\Backend\Support\IcalSync;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class IcalController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'ical';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/** Largest .ics body accepted, in bytes. A listing export is a few KB. */
	private const MAX_SIZE = 2097152;

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
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/import',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'import' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'apartmentId'   => array(
							'type'     => 'integer',
							'required' => true,
						),
						'content'       => array(
							'type'     => 'string',
							'required' => false,
						),
						// Either the file's text, or an address to read it from.
						'url'           => array(
							'type'     => 'string',
							'required' => false,
						),
						'source'        => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => IcalParser::SOURCES,
						),
						'removeMissing' => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => false,
						),
						'skipPast'      => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => true,
						),
						'dryRun'        => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => true,
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/feeds',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'create_feed' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => self::feed_args( true ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/feeds/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update_feed' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => self::feed_args( false ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( self::class, 'delete_feed' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'removeBlocks' => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => false,
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/feeds/(?P<id>\d+)/sync',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'sync_feed' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'dryRun' => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => false,
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/sync',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'sync_all' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);

		/*
		 * Minting the export link is a POST rather than part of the GET above,
		 * because asking for the link is what creates the token — and creating
		 * a live public URL is a change, not a read.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/export/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'export_link' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'regenerate' => array(
							'type'     => 'boolean',
							'required' => false,
							'default'  => false,
						),
					),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	/**
	 * The argument schema a feed is written with.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private static function feed_args( bool $creating ): array {
		return array(
			'apartmentId' => array(
				'type'     => 'integer',
				'required' => $creating,
			),
			'name'        => array(
				'type'              => 'string',
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'url'         => array(
				'type'     => 'string',
				'required' => $creating,
			),
			'source'      => array(
				'type'     => 'string',
				'required' => false,
				'enum'     => IcalParser::SOURCES,
			),
			'active'      => array(
				'type'     => 'boolean',
				'required' => false,
			),
		);
	}

	public static function index(): WP_REST_Response {
		$next = wp_next_scheduled( IcalSync::HOOK );

		return new WP_REST_Response(
			array(
				'feeds'      => IcalFeedsRepository::all(),
				'apartments' => array_map(
					static function ( array $a ): array {
						/*
						 * Read, never mint: an apartment whose calendar has
						 * never been published stays unpublished just because
						 * somebody opened this screen. The token arrives when
						 * the operator presses the button.
						 */
						$token = ApartmentsRepository::token( (int) $a['id'] );

						return array(
							'id'          => (int) $a['id'],
							'name'        => (string) $a['name'],
							'colour'      => (string) $a['colour'],
							'exportUrl'   => IcalFeed::url_from_token( $token ),
							'fallbackUrl' => IcalFeed::fallback_from_token( $token ),
						);
					},
					ApartmentsRepository::all()
				),
				'sources'    => array_map(
					static fn( string $source ): array => array(
						'value' => $source,
						'label' => IcalParser::source_label( $source ),
					),
					IcalParser::SOURCES
				),
				// So the screen can say when the next automatic pull is due,
				// rather than leaving the operator to trust that one happens.
				'schedule'   => array(
					'hook'    => IcalSync::HOOK,
					'nextRun' => $next ? gmdate( 'Y-m-d H:i:s', (int) $next ) : '',
				),
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function import( WP_REST_Request $request ) {
		$content = (string) $request->get_param( 'content' );
		$url     = trim( (string) $request->get_param( 'url' ) );

		if ( '' === $content && '' !== $url ) {
			$content = IcalImporter::fetch( $url );

			if ( is_wp_error( $content ) ) {
				return $content;
			}
		}

		if ( '' === trim( $content ) ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Choose a calendar file to import.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'content',
				)
			);
		}

		if ( strlen( $content ) > self::MAX_SIZE ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'That file is too large to be a calendar export.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'content',
				)
			);
		}

		$report = IcalImporter::import(
			(int) $request->get_param( 'apartmentId' ),
			$content,
			array(
				'source'        => (string) $request->get_param( 'source' ),
				'removeMissing' => (bool) $request->get_param( 'removeMissing' ),
				'skipPast'      => (bool) $request->get_param( 'skipPast' ),
				'dryRun'        => (bool) $request->get_param( 'dryRun' ),
			)
		);

		if ( is_wp_error( $report ) ) {
			return $report;
		}

		return new WP_REST_Response( array( 'report' => $report ), 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_feed( WP_REST_Request $request ) {
		$apartment_id = (int) $request->get_param( 'apartmentId' );
		$url          = self::clean_url( (string) $request->get_param( 'url' ) );

		$invalid = self::validate_feed( $apartment_id, $url, 0 );

		if ( null !== $invalid ) {
			return $invalid;
		}

		$source = (string) $request->get_param( 'source' );
		$name   = (string) $request->get_param( 'name' );

		$id = IcalFeedsRepository::create(
			array(
				'room_id' => $apartment_id,
				'name'    => '' !== $name ? $name : self::default_name( $source, $url ),
				'url'     => $url,
				'source'  => in_array( $source, IcalParser::SOURCES, true ) ? $source : 'other',
				'active'  => null === $request->get_param( 'active' )
					? true
					: (bool) $request->get_param( 'active' ),
			)
		);

		if ( null === $id ) {
			return new WP_Error(
				'booking_suite_feed_failed',
				__( 'The calendar subscription could not be saved.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( array( 'feed' => IcalFeedsRepository::find( $id ) ), 201 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_feed( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$feed = IcalFeedsRepository::find( $id );

		if ( null === $feed ) {
			return self::not_found();
		}

		$values       = array();
		$apartment_id = null === $request->get_param( 'apartmentId' )
			? (int) $feed['apartmentId']
			: (int) $request->get_param( 'apartmentId' );

		$url = null === $request->get_param( 'url' )
			? (string) $feed['url']
			: self::clean_url( (string) $request->get_param( 'url' ) );

		$invalid = self::validate_feed( $apartment_id, $url, $id );

		if ( null !== $invalid ) {
			return $invalid;
		}

		$values['room_id'] = $apartment_id;
		$values['url']     = $url;

		if ( null !== $request->get_param( 'name' ) ) {
			$values['name'] = (string) $request->get_param( 'name' );
		}

		if ( null !== $request->get_param( 'source' ) ) {
			$values['source'] = (string) $request->get_param( 'source' );
		}

		if ( null !== $request->get_param( 'active' ) ) {
			$values['active'] = (bool) $request->get_param( 'active' );
		}

		IcalFeedsRepository::update( $id, $values );

		return new WP_REST_Response( array( 'feed' => IcalFeedsRepository::find( $id ) ), 200 );
	}

	/**
	 * Unsubscribe.
	 *
	 * The locks the feed brought in are kept unless `removeBlocks` says
	 * otherwise: dates a portal has sold are still sold after the subscription
	 * is removed, and dropping them silently would put a booked apartment back
	 * on sale. Removing them is offered, not assumed.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_feed( WP_REST_Request $request ) {
		$id   = (int) $request['id'];
		$feed = IcalFeedsRepository::find( $id );

		if ( null === $feed ) {
			return self::not_found();
		}

		$removed = 0;

		if ( $request->get_param( 'removeBlocks' ) ) {
			$removed = IcalSync::release_feed_locks(
				(int) $feed['apartmentId'],
				(string) $feed['source']
			);
		}

		IcalFeedsRepository::delete( $id );

		return new WP_REST_Response(
			array(
				'deleted'       => true,
				'id'            => $id,
				'removedBlocks' => $removed,
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function sync_feed( WP_REST_Request $request ) {
		$report = IcalImporter::sync_feed(
			(int) $request['id'],
			(bool) $request->get_param( 'dryRun' )
		);

		if ( is_wp_error( $report ) ) {
			// The feed row still carries the failure, so hand it back with the
			// error: the screen can show why and when in the same place.
			$report->add_data(
				array( 'feed' => IcalFeedsRepository::find( (int) $request['id'] ) ),
				$report->get_error_code()
			);

			return $report;
		}

		return new WP_REST_Response(
			array(
				'report' => $report,
				'feed'   => IcalFeedsRepository::find( (int) $request['id'] ),
			),
			200
		);
	}

	/**
	 * Publish an apartment's calendar, or replace the link it already has.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function export_link( WP_REST_Request $request ) {
		$apartment_id = (int) $request['id'];

		if ( null === ApartmentsRepository::find( $apartment_id ) ) {
			return new WP_Error(
				'booking_suite_apartment_not_found',
				__( 'That apartment no longer exists.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		$token = $request->get_param( 'regenerate' )
			? ApartmentsRepository::reset_token( $apartment_id )
			: ApartmentsRepository::ensure_token( $apartment_id );

		return new WP_REST_Response(
			array(
				'apartmentId' => $apartment_id,
				'exportUrl'   => IcalFeed::url_from_token( $token ),
				'fallbackUrl' => IcalFeed::fallback_from_token( $token ),
			),
			200
		);
	}

	public static function sync_all(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'results' => IcalImporter::sync_all(),
				'feeds'   => IcalFeedsRepository::all(),
			),
			200
		);
	}

	/**
	 * Shared checks for creating and updating a subscription.
	 */
	private static function validate_feed( int $apartment_id, string $url, int $ignore_id ): ?WP_Error {
		if ( null === ApartmentsRepository::find( $apartment_id ) ) {
			return self::invalid(
				__( 'Choose which apartment this calendar belongs to.', 'booking-suite' ),
				'apartmentId'
			);
		}

		if ( ! wp_http_validate_url( $url ) ) {
			return self::invalid(
				__( 'Paste the calendar link the portal gave you — it should start with https://', 'booking-suite' ),
				'url'
			);
		}

		if ( IcalFeedsRepository::exists( $apartment_id, $url, $ignore_id ) ) {
			return self::invalid(
				__( 'This apartment already subscribes to that calendar.', 'booking-suite' ),
				'url'
			);
		}

		return null;
	}

	/**
	 * Portals hand out webcal:// links; they are https once fetched, and
	 * storing them that way keeps the check above from having to know it.
	 */
	private static function clean_url( string $url ): string {
		$url = trim( $url );

		if ( str_starts_with( strtolower( $url ), 'webcal://' ) ) {
			$url = 'https://' . substr( $url, 9 );
		}

		return esc_url_raw( $url );
	}

	/**
	 * A name for a subscription the operator did not name, so the list never
	 * shows a blank row.
	 */
	private static function default_name( string $source, string $url ): string {
		if ( in_array( $source, IcalParser::SOURCES, true ) && 'other' !== $source ) {
			return IcalParser::source_label( $source );
		}

		$host = (string) wp_parse_url( $url, PHP_URL_HOST );

		return '' !== $host ? $host : __( 'Calendar', 'booking-suite' );
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_feed_not_found',
			__( 'That calendar subscription no longer exists.', 'booking-suite' ),
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
