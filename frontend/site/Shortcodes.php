<?php
/**
 * Guest-facing shortcodes.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Site;

use BookingSuite\Backend\PostTypes\ApartmentPostType;

defined( 'ABSPATH' ) || exit;

final class Shortcodes {

	/** [booking_suite_apartments] */
	public const APARTMENTS = 'booking_suite_apartments';

	/** [booking_suite_book_now] */
	public const BOOK_NOW = 'booking_suite_book_now';

	public static function register(): void {
		add_shortcode( self::APARTMENTS, array( self::class, 'render_apartments' ) );
		add_shortcode( self::BOOK_NOW, array( self::class, 'render_book_now' ) );
	}

	/**
	 * "Book now" button. The modal itself is mounted by the site bundle when
	 * the button is clicked, so a page with ten buttons still loads one modal.
	 *
	 * Attributes:
	 *   id       Apartment to book. Defaults to the apartment being rendered,
	 *            which is what makes it work unchanged inside an Elementor loop
	 *            or on a single-apartment template.
	 *   label    Button text.
	 *   variant  solid | outline | text
	 *   size     sm | md | lg
	 *   full     yes to stretch to the container width.
	 *
	 * @param array<string, string>|string $atts
	 */
	public static function render_book_now( $atts = array() ): string {
		$atts = shortcode_atts(
			array(
				'id'      => '',
				'label'   => '',
				'variant' => 'solid',
				'size'    => 'md',
				'full'    => 'no',
			),
			(array) $atts,
			self::BOOK_NOW
		);

		$apartment_id = absint( $atts['id'] ) ?: self::current_apartment_id();

		if ( ! $apartment_id ) {
			// Nothing to book: better to render nothing than a dead button.
			return '';
		}

		Assets::enqueue_app();

		$variant = in_array( $atts['variant'], array( 'solid', 'outline', 'text' ), true )
			? $atts['variant']
			: 'solid';

		$size = in_array( $atts['size'], array( 'sm', 'md', 'lg' ), true ) ? $atts['size'] : 'md';

		$classes = array(
			'bks-site-root',
			'bks-book-now',
			'bks-book-now--' . $variant,
			'bks-book-now--' . $size,
		);

		if ( 'yes' === $atts['full'] ) {
			$classes[] = 'bks-book-now--full';
		}

		$label = '' !== $atts['label']
			? $atts['label']
			: __( 'Book now', 'booking-suite' );

		return sprintf(
			'<button type="button" class="%1$s" data-booking-suite-book="%2$d">%3$s</button>',
			esc_attr( implode( ' ', $classes ) ),
			$apartment_id,
			esc_html( $label )
		);
	}

	/**
	 * The apartment currently being rendered, if any.
	 */
	private static function current_apartment_id(): int {
		$post_id = get_the_ID();

		if ( ! $post_id || ApartmentPostType::POST_TYPE !== get_post_type( $post_id ) ) {
			return 0;
		}

		return (int) $post_id;
	}

	/**
	 * Mount point for the guest apartment list.
	 *
	 * Attributes:
	 *   columns  Preferred column count on wide screens (1-4, default 3).
	 *   guests   Pre-fill the guest filter.
	 *   search   Whether to show the date/guest search bar (yes|no).
	 *   heading  Optional heading rendered above the list.
	 *
	 * @param array<string, string>|string $atts
	 */
	public static function render_apartments( $atts = array() ): string {
		$atts = shortcode_atts(
			array(
				'columns' => '3',
				'guests'  => '',
				'search'  => 'yes',
				'heading' => '',
			),
			(array) $atts,
			self::APARTMENTS
		);

		// Only load the bundle on pages that actually use the shortcode.
		Assets::enqueue_app();

		$columns = min( 4, max( 1, absint( $atts['columns'] ) ?: 3 ) );

		return sprintf(
			'<div class="bks-site-root" data-booking-suite-apartments data-columns="%1$s" data-guests="%2$s" data-search="%3$s" data-heading="%4$s"></div>',
			esc_attr( (string) $columns ),
			esc_attr( (string) absint( $atts['guests'] ) ),
			esc_attr( 'no' === $atts['search'] ? 'no' : 'yes' ),
			esc_attr( (string) $atts['heading'] )
		);
	}
}
