<?php
/**
 * Public REST route for the guest-facing apartment list.
 *
 * GET /booking-suite/v1/public/apartments
 *
 * Unauthenticated by design — this is what the site shortcode reads. Only
 * active apartments are returned, and only the fields a guest may see: the
 * internal short link, cleaning turnaround and timestamps never leave here.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\PriceRulesRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class PublicApartmentsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'public/apartments';

	/** Image size requested for the card gallery. */
	private const IMAGE_SIZE = 'large';

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
				'permission_callback' => '__return_true',
				'args'                => array(
					'guests' => array(
						'type'     => 'integer',
						'required' => false,
					),
				),
			)
		);
	}

	public static function index( WP_REST_Request $request ): WP_REST_Response {
		$apartments = ApartmentsRepository::all( array( 'active' => true ) );

		$guests = absint( $request->get_param( 'guests' ) );

		if ( $guests > 0 ) {
			$apartments = array_values(
				array_filter(
					$apartments,
					static fn( array $apartment ): bool => $apartment['capacity'] >= $guests
				)
			);
		}

		$prices = PriceRulesRepository::lowest_public_price(
			wp_list_pluck( $apartments, 'id' )
		);

		$payload = array_map(
			static fn( array $apartment ): array => self::present( $apartment, $prices ),
			$apartments
		);

		$response = new WP_REST_Response( $payload, 200 );

		// Safe to cache: nothing here varies per visitor.
		$response->header( 'Cache-Control', 'public, max-age=300' );

		return $response;
	}

	/**
	 * Reshape one row into the guest-facing representation.
	 *
	 * @param array<string, mixed> $apartment
	 * @param array<int, float>    $prices
	 *
	 * @return array<string, mixed>
	 */
	private static function present( array $apartment, array $prices ): array {
		$id = (int) $apartment['id'];

		return array(
			'id'          => $id,
			'name'        => $apartment['name'],
			'description' => wp_strip_all_tags( (string) $apartment['description'] ),
			'excerpt'     => wp_trim_words( wp_strip_all_tags( (string) $apartment['description'] ), 28 ),
			'capacity'    => (int) $apartment['capacity'],
			'colour'      => $apartment['colour'],
			'images'      => self::images( ApartmentsRepository::image_ids( $apartment ) ),
			'permalink'   => (string) ( $apartment['permalink'] ?? '' ),

			// The short link wins when one is set; otherwise the card links to
			// the apartment's own page.
			'bookingLink' => self::booking_url( (string) $apartment['booking_short_link'] )
				?: (string) ( $apartment['permalink'] ?? '' ),
			// The apartment's own rates win; price rules remain the fallback.
			'priceFrom'   => RateCalculator::lowest_rate( $apartment ) ?? $prices[ $id ] ?? null,
			'currency'    => SettingsRepository::currency(),
		);
	}

	/**
	 * Resolve attachment ids to renderable image data.
	 *
	 * @param int[] $ids
	 *
	 * @return array<int, array{url: string, alt: string}>
	 */
	private static function images( array $ids ): array {
		$images = array();

		foreach ( $ids as $attachment_id ) {
			$url = wp_get_attachment_image_url( (int) $attachment_id, self::IMAGE_SIZE );

			if ( ! $url ) {
				continue;
			}

			$images[] = array(
				'url' => $url,
				'alt' => (string) get_post_meta( (int) $attachment_id, '_wp_attachment_image_alt', true ),
			);
		}

		return $images;
	}

	/**
	 * The booking short link is a slug relative to the site root; an empty one
	 * means the apartment has no dedicated booking page yet.
	 */
	private static function booking_url( string $short_link ): string {
		return '' === $short_link ? '' : home_url( '/' . ltrim( $short_link, '/' ) );
	}
}
