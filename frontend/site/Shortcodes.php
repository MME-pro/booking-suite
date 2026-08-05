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

	/**
	 * What the shortcodes are and what they take.
	 *
	 * Kept beside the implementations on purpose: attributes are declared in
	 * shortcode_atts() calls and cannot be read back at runtime, so this is the
	 * one part of the developer guide that has to be written by hand. Changing
	 * an attribute below without changing it above is the failure mode to watch
	 * for.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function documentation(): array {
		return array(
			array(
				'tag'         => self::BOOK_NOW,
				'title'       => __( 'Book now button', 'booking-suite' ),
				'description' => __(
					'A button that opens the booking modal. Added to every apartment page automatically, so you only need this to place it somewhere specific instead.',
					'booking-suite'
				),
				'example'     => '[' . self::BOOK_NOW . ' variant="outline" size="lg" full="yes"]',
				'attributes'  => array(
					array(
						'name'        => 'id',
						'default'     => '',
						'description' => __(
							'Apartment to book. Defaults to the apartment being rendered, which is what makes it work unchanged inside an Elementor loop.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'label',
						'default'     => __( 'Book now', 'booking-suite' ),
						'description' => __( 'Button text.', 'booking-suite' ),
					),
					array(
						'name'        => 'variant',
						'default'     => 'solid',
						'options'     => array( 'solid', 'outline', 'text' ),
						'description' => __( 'Visual weight of the button.', 'booking-suite' ),
					),
					array(
						'name'        => 'size',
						'default'     => 'md',
						'options'     => array( 'sm', 'md', 'lg' ),
						'description' => __( 'Button size.', 'booking-suite' ),
					),
					array(
						'name'        => 'full',
						'default'     => 'no',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Stretch to the width of its container.',
							'booking-suite'
						),
					),
				),
			),
			array(
				'tag'         => self::APARTMENTS,
				'title'       => __( 'Apartment list', 'booking-suite' ),
				'description' => __(
					'The guest-facing apartment grid, with an optional date and guest search bar above it.',
					'booking-suite'
				),
				'example'     => '[' . self::APARTMENTS . ' columns="2" search="no" heading="Our apartments"]',
				'attributes'  => array(
					array(
						'name'        => 'columns',
						'default'     => '3',
						'options'     => array( '1', '2', '3', '4' ),
						'description' => __(
							'Preferred column count on wide screens.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'guests',
						'default'     => '',
						'description' => __(
							'Pre-fill the guest filter with a party size.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'search',
						'default'     => 'yes',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Show the date and guest search bar.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'heading',
						'default'     => '',
						'description' => __(
							'Optional heading rendered above the list.',
							'booking-suite'
						),
					),
				),
			),
		);
	}

	public static function register(): void {
		add_shortcode( self::APARTMENTS, array( self::class, 'render_apartments' ) );
		add_shortcode( self::BOOK_NOW, array( self::class, 'render_book_now' ) );

		// Priority 20: after wpautop, so the button is not wrapped in a stray
		// paragraph by the formatter.
		add_filter( 'the_content', array( self::class, 'append_book_now' ), 20 );
	}

	/**
	 * Puts the booking button on every apartment page.
	 *
	 * Each apartment would otherwise need the shortcode pasted into it by hand,
	 * which is easy to forget on the next apartment added — so the default is
	 * that an apartment page is bookable, and the shortcode stays available for
	 * placing the button somewhere specific instead.
	 *
	 * Switch it off entirely, or per apartment, with:
	 *
	 *   add_filter( 'booking_suite_auto_book_now', '__return_false' );
	 *
	 * @param string $content The post content being rendered.
	 */
	public static function append_book_now( string $content ): string {
		if (
			! is_singular( ApartmentPostType::POST_TYPE )
			|| ! in_the_loop()
			|| ! is_main_query()
		) {
			return $content;
		}

		$apartment_id = self::current_apartment_id();

		if ( ! $apartment_id ) {
			return $content;
		}

		/*
		 * Already placed by hand — either as a shortcode in the editor, or as
		 * rendered markup from an Elementor widget, which reaches this filter
		 * already expanded. Adding a second button would be worse than adding
		 * none.
		 */
		if (
			has_shortcode( $content, self::BOOK_NOW )
			|| false !== strpos( $content, 'data-booking-suite-book' )
		) {
			return $content;
		}

		/**
		 * Whether to append the booking button to this apartment page.
		 *
		 * @param bool $enabled      Defaults to true.
		 * @param int  $apartment_id The apartment being rendered.
		 */
		if ( ! apply_filters( 'booking_suite_auto_book_now', true, $apartment_id ) ) {
			return $content;
		}

		return $content . self::render_book_now(
			array(
				'id'   => (string) $apartment_id,
				'size' => 'lg',
			)
		);
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
