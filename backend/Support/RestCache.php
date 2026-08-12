<?php
/**
 * Keeps the plugin's REST responses out of caches.
 *
 * Booking data is live operational data: a list of bookings, an availability
 * check, a price quote. Serving a stored copy of any of them is not a
 * performance win but a wrong answer — a booking taken a minute ago missing
 * from the list, or a slot offered that has already gone.
 *
 * Page caches do not always agree. LiteSpeed ships with REST caching on and a
 * seven-day lifetime, which is reasonable for a read-only content API and quite
 * wrong for this one. Rather than ask every site owner to find that setting,
 * the responses say plainly that they must not be stored.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use WP_HTTP_Response;
use WP_REST_Request;

defined( 'ABSPATH' ) || exit;

final class RestCache {

	/** Everything under this namespace is live data. */
	private const NAMESPACE = 'booking-suite/v1';

	public static function register(): void {
		add_filter( 'rest_post_dispatch', array( self::class, 'no_store' ), 10, 3 );
	}

	/**
	 * @param WP_HTTP_Response $response
	 * @param mixed            $server
	 * @param WP_REST_Request  $request
	 *
	 * @return WP_HTTP_Response
	 */
	public static function no_store( $response, $server, $request ) {
		if ( ! $response instanceof WP_HTTP_Response || ! $request instanceof WP_REST_Request ) {
			return $response;
		}

		if ( 0 !== strpos( ltrim( (string) $request->get_route(), '/' ), self::NAMESPACE ) ) {
			return $response;
		}

		// For browsers and any proxy in between.
		$response->header( 'Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'Expires', '0' );

		/*
		 * And for LiteSpeed, which reads its own signal rather than the header.
		 * A no-op when the plugin is not installed.
		 */
		do_action( 'litespeed_control_set_nocache', 'Booking Suite serves live booking data' );

		return $response;
	}
}
