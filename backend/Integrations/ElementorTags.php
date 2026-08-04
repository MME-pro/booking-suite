<?php
/**
 * Registers the Booking Suite dynamic tag group with Elementor.
 *
 * Everything here is a no-op when Elementor is not active.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Integrations;

defined( 'ABSPATH' ) || exit;

final class ElementorTags {

	private const GROUP = 'booking-suite';

	/**
	 * Tag classes, in the order they should appear in Elementor's list.
	 */
	private const TAGS = array(
		'NameTag',
		'DescriptionTag',
		'GuestsTag',
		'CleaningTag',
		'ColourTag',
		'PriceFromTag',
		'BookingLinkTag',
	);

	public static function register(): void {
		add_action( 'elementor/dynamic_tags/register', array( self::class, 'register_tags' ) );
	}

	/**
	 * @param object $dynamic_tags Elementor's dynamic tags manager.
	 */
	public static function register_tags( $dynamic_tags ): void {
		require_once __DIR__ . '/Elementor/Tags.php';

		$dynamic_tags->register_group(
			self::GROUP,
			array( 'title' => __( 'Booking Suite', 'booking-suite' ) )
		);

		foreach ( self::TAGS as $tag ) {
			$class = __NAMESPACE__ . '\\Elementor\\' . $tag;

			if ( ! class_exists( $class ) ) {
				continue;
			}

			// Elementor renamed register_tag() to register() in 3.5.
			if ( method_exists( $dynamic_tags, 'register' ) ) {
				$dynamic_tags->register( new $class() );
			} else {
				$dynamic_tags->register_tag( $class );
			}
		}
	}
}
