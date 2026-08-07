<?php
/**
 * Guest-facing shortcodes.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Site;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\PriceRulesRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;

defined( 'ABSPATH' ) || exit;

final class Shortcodes {

	/** [booking_suite_apartments] */
	public const APARTMENTS = 'booking_suite_apartments';

	/** [booking_suite_book_now] */
	public const BOOK_NOW = 'booking_suite_book_now';

	/** [booking_suite_apartment_showcase] */
	public const SHOWCASE = 'booking_suite_apartment_showcase';

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
					array(
						'name'        => 'date',
						'default'     => '',
						'description' => __(
							'Open the booking window on this date, as YYYY-MM-DD, instead of on today.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'hours',
						'default'     => '',
						'description' => __(
							'Open the booking window on an hourly visit of this length. Takes precedence over nights.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'nights',
						'default'     => '',
						'description' => __(
							'Open the booking window on an overnight stay of this many nights.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'guests',
						'default'     => '',
						'description' => __(
							'Pre-fill the party size in the booking window.',
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
			array(
				'tag'         => self::SHOWCASE,
				'title'       => __( 'Apartment showcase', 'booking-suite' ),
				'description' => __(
					'A photo grid of the apartments with a "Book now" button on each card, for the homepage. Rendered by the server, so it is visible to search engines and needs no search bar. Use the apartment list instead when guests should filter by date first.',
					'booking-suite'
				),
				'example'     => '[' . self::SHOWCASE . ' columns="3" limit="3" heading="Our apartments"]',
				'attributes'  => array(
					array(
						'name'        => 'ids',
						'default'     => '',
						'description' => __(
							'Comma-separated apartment IDs to show, in the order given. Defaults to every active apartment.',
							'booking-suite'
						),
					),
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
						'name'        => 'limit',
						'default'     => '0',
						'description' => __(
							'Maximum number of apartments to show. 0 shows them all.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'guests',
						'default'     => '',
						'description' => __(
							'Only show apartments that sleep at least this many guests.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'orderby',
						'default'     => 'name',
						'options'     => array( 'name', 'capacity', 'created_at' ),
						'description' => __( 'How the apartments are sorted.', 'booking-suite' ),
					),
					array(
						'name'        => 'order',
						'default'     => 'asc',
						'options'     => array( 'asc', 'desc' ),
						'description' => __( 'Sort direction.', 'booking-suite' ),
					),
					array(
						'name'        => 'heading',
						'default'     => '',
						'description' => __(
							'Optional heading rendered above the grid.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'subheading',
						'default'     => '',
						'description' => __(
							'Optional line of text below the heading.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'label',
						'default'     => __( 'Book now', 'booking-suite' ),
						'description' => __(
							'Text of the booking button on each card.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'price',
						'default'     => 'yes',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Show the nightly "from" price.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'excerpt',
						'default'     => 'yes',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Show a two-line description under the name.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'link',
						'default'     => 'yes',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Link the apartment name to its own page.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'search',
						'default'     => 'yes',
						'options'     => array( 'yes', 'no' ),
						'description' => __(
							'Show the search bar: arrival date, duration and guests. Searching filters the grid by party size and opens the booking modal on the dates chosen.',
							'booking-suite'
						),
					),
					array(
						'name'        => 'hours',
						'default'     => '',
						'description' => __(
							'Duration the search bar starts on, in hours. Defaults to the shortest bookable length from Settings, and is limited to the range between the shortest and longest booking.',
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
		add_shortcode( self::SHOWCASE, array( self::class, 'render_showcase' ) );

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
				// Opens the modal on a stay the guest has already described.
				'date'    => '',
				'time'    => '',
				'hours'   => '',
				'nights'  => '',
				'guests'  => '',
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

		/*
		 * A stay the guest has already described — from the showcase search bar
		 * — travels to the modal on the button, so it opens on those dates
		 * instead of on today. Absent attributes are simply omitted, which is
		 * what keeps every existing button unchanged.
		 */
		return sprintf(
			'<button type="button" class="%1$s" data-booking-suite-book="%2$d"%3$s>%4$s</button>',
			esc_attr( implode( ' ', $classes ) ),
			$apartment_id,
			self::stay_attributes( $atts ),
			esc_html( $label )
		);
	}

	/**
	 * The `data-bks-*` attributes carrying a pre-chosen stay, or '' for none.
	 *
	 * @param array<string, string> $atts
	 */
	private static function stay_attributes( array $atts ): string {
		$date = self::valid_date( (string) $atts['date'] );

		$hours  = min( 24, absint( $atts['hours'] ) );
		$nights = min( 60, absint( $atts['nights'] ) );
		$guests = min( 99, absint( $atts['guests'] ) );

		$attributes = '';

		if ( '' !== $date ) {
			$attributes .= ' data-bks-date="' . esc_attr( $date ) . '"';
		}

		// A start time only means something alongside a date.
		if ( '' !== $date && preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', (string) $atts['time'] ) ) {
			$attributes .= ' data-bks-time="' . esc_attr( (string) $atts['time'] ) . '"';
		}

		/*
		 * Hours and nights are the two shapes a stay comes in — hourly and
		 * overnight — and the modal has to resolve to exactly one. Hours are
		 * the more specific statement, so a button carrying both means hourly.
		 */
		if ( $hours > 0 ) {
			$attributes .= ' data-bks-hours="' . esc_attr( (string) $hours ) . '"';
		} elseif ( $nights > 0 ) {
			$attributes .= ' data-bks-nights="' . esc_attr( (string) $nights ) . '"';
		}

		if ( $guests > 0 ) {
			$attributes .= ' data-bks-guests="' . esc_attr( (string) $guests ) . '"';
		}

		return $attributes;
	}

	/**
	 * A Y-m-d date, or '' when the value is not one.
	 *
	 * Checked rather than trusted: the date reaches this from the query string,
	 * and it is handed on to the booking modal as a real date.
	 */
	private static function valid_date( string $value ): string {
		$date = \DateTimeImmutable::createFromFormat( '!Y-m-d', $value );

		return $date && $date->format( 'Y-m-d' ) === $value ? $value : '';
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

	/**
	 * The apartment showcase: a photo grid with a booking button on every card.
	 *
	 * Built for the homepage, which is why it is rendered here rather than by the
	 * guest app. The page it sits on is the one a visitor lands on and the one
	 * search engines read, so the apartments are in the HTML from the first byte
	 * — no bundle to download, no request to wait on, nothing that shifts once it
	 * arrives. The guest app still loads, but only to carry the modal, and only
	 * because a button is present.
	 *
	 * The button itself is render_book_now(), not a copy of it: the showcase
	 * decides the layout and nothing else, so the two can never drift.
	 *
	 * Attributes:
	 *   ids         Comma-separated apartment ids, in the order given.
	 *   columns     Preferred column count on wide screens (1-4, default 3).
	 *   limit       Maximum apartments to show; 0 for all.
	 *   guests      Only apartments sleeping at least this many.
	 *   orderby     name | capacity | created_at
	 *   order       asc | desc
	 *   heading     Optional heading above the grid.
	 *   subheading  Optional line below the heading.
	 *   label       Booking button text.
	 *   price       yes|no — show the nightly "from" price.
	 *   excerpt     yes|no — show a two-line description.
	 *   link        yes|no — link the name to the apartment page.
	 *
	 * @param array<string, string>|string $atts
	 */
	public static function render_showcase( $atts = array() ): string {
		$atts = shortcode_atts(
			array(
				'ids'        => '',
				'columns'    => '3',
				'limit'      => '0',
				'guests'     => '',
				'orderby'    => 'name',
				'order'      => 'asc',
				'heading'    => '',
				'subheading' => '',
				'label'      => '',
				'price'      => 'yes',
				'excerpt'    => 'yes',
				'link'       => 'yes',
				'search'     => 'yes',
				'hours'      => '',
				'time'       => '',
			),
			(array) $atts,
			self::SHOWCASE
		);

		$search = self::showcase_search_values( $atts );

		// A party size typed into the search bar is a stronger statement of
		// intent than the one written into the shortcode, so it wins.
		if ( $search['guests'] > 0 ) {
			$atts['guests'] = (string) $search['guests'];
		}

		$apartments = self::showcase_apartments( $atts );

		/*
		 * Once a date is named the grid answers a different question: not "which
		 * apartments exist" but "which can actually be booked then". With a time
		 * as well that is one window; with "any time" it is the whole day, and
		 * an apartment only survives if some start on that day still fits.
		 */
		$apartments = self::showcase_available( $apartments, $search );

		// Only load the bundle on pages that actually use the shortcode.
		Assets::enqueue_app();
		Assets::enqueue_showcase();

		$columns = min( 4, max( 1, absint( $atts['columns'] ) ?: 3 ) );

		$header = self::showcase_header( $atts )
			. ( 'no' === $atts['search'] ? '' : self::showcase_search_bar( $search ) );

		if ( ! $apartments ) {
			/*
			 * "Nothing matches what you asked for" and "nothing is set up yet"
			 * are different problems, and only one of them the guest can act on.
			 */
			$message = $search['guests'] > 0
				? sprintf(
					/* translators: %d: number of guests searched for. */
					_n(
						'No apartment sleeps %d guest. Try a smaller party.',
						'No apartment sleeps %d guests. Try a smaller party.',
						$search['guests'],
						'booking-suite'
					),
					$search['guests']
				)
				: __( 'No apartments are available just now.', 'booking-suite' );

			return '<div class="bks-site-root bks-showcase">'
				. $header
				. '<p class="bks-showcase__empty">'
				. esc_html( $message )
				. '</p></div>';
		}

		/*
		 * One query for the whole grid rather than one per card: the fallback
		 * price comes from the rules table, and asking for it per apartment
		 * inside the loop is how a three-card homepage grows a dozen queries.
		 */
		$prices = 'no' === $atts['price']
			? array()
			: PriceRulesRepository::lowest_public_price( wp_list_pluck( $apartments, 'id' ) );

		$currency = SettingsRepository::currency();

		$cards = '';

		foreach ( $apartments as $apartment ) {
			$cards .= self::showcase_card( $apartment, $atts, $prices, $currency, $search );
		}

		/*
		 * Below the desktop breakpoint the grid reflows on its own, and the
		 * narrowest card it will accept is what keeps that reflow honest to the
		 * column count asked for — otherwise a two-column showcase would still
		 * find room for three on a wide tablet.
		 */
		$minimum = array( 1 => '100%', 2 => '22rem', 3 => '17rem', 4 => '15rem' );

		return sprintf(
			'<div class="bks-site-root bks-showcase">%1$s<ul class="bks-showcase__grid" style="--bks-showcase-columns:%2$d;--bks-showcase-min:%3$s">%4$s</ul></div>',
			$header,
			$columns,
			esc_attr( $minimum[ $columns ] ),
			$cards
		);
	}

	/**
	 * The apartments the showcase should show, already filtered and ordered.
	 *
	 * @param array<string, string> $atts
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function showcase_apartments( array $atts ): array {
		// Inactive apartments are not bookable, so a card for one would be a
		// button that always fails.
		$apartments = ApartmentsRepository::all(
			array(
				'active'  => true,
				'orderby' => (string) $atts['orderby'],
				'order'   => (string) $atts['order'],
			)
		);

		$guests = absint( $atts['guests'] );

		if ( $guests > 0 ) {
			$apartments = array_filter(
				$apartments,
				static fn( array $apartment ): bool => $apartment['capacity'] >= $guests
			);
		}

		$ids = array_filter( array_map( 'absint', explode( ',', (string) $atts['ids'] ) ) );

		if ( $ids ) {
			$by_id = array_column( $apartments, null, 'id' );

			// Rebuilt from the attribute rather than filtered, so the order the
			// owner wrote is the order shown.
			$apartments = array_values(
				array_filter(
					array_map(
						static fn( int $id ): ?array => $by_id[ $id ] ?? null,
						$ids
					)
				)
			);
		} else {
			$apartments = array_values( $apartments );
		}

		$limit = absint( $atts['limit'] );

		return $limit > 0 ? array_slice( $apartments, 0, $limit ) : $apartments;
	}

	/** Query arguments the search bar reads and writes. */
	private const SEARCH_ARGS = array(
		'date'   => 'bks_from',
		'time'   => 'bks_time',
		'hours'  => 'bks_hours',
		'guests' => 'bks_guests',
	);

	/**
	 * The start times the search bar offers on a date.
	 *
	 * Generated from the same three settings the booking slot picker uses —
	 * opening time, closing time and step — so the filter can never suggest a
	 * start the booking flow would refuse.
	 *
	 * @return array<string, string> 'H:i' => the label to show.
	 */
	private static function showcase_times(): array {
		$step = max( 15, (int) SettingsRepository::number( SettingsRepository::SLOT_STEP ) );

		$open  = SettingsRepository::get( SettingsRepository::DAY_START );
		$close = SettingsRepository::get( SettingsRepository::DAY_END );

		/*
		 * Built in the site's own timezone, which wp_date() then formats back
		 * into. Constructing these in PHP's default zone instead makes the
		 * label disagree with the value it submits — an 08:00 option showing as
		 * 09:00 on a UTC+1 site — because wp_date() shifts the timestamp it is
		 * handed and the key was never shifted with it.
		 */
		try {
			$zone  = wp_timezone();
			$start = new \DateTimeImmutable( '2000-01-01 ' . $open, $zone );
			$end   = new \DateTimeImmutable( '2000-01-01 ' . $close, $zone );
		} catch ( \Exception $e ) {
			return array();
		}

		$format = (string) get_option( 'time_format', 'H:i' );
		$times  = array();

		for ( $slot = $start; $slot <= $end; $slot = $slot->modify( "+$step minutes" ) ) {
			// The key is always 24-hour; the label follows the site's format.
			$times[ $slot->format( 'H:i' ) ] = wp_date( $format, $slot->getTimestamp() );
		}

		return $times;
	}

	/**
	 * The bookable lengths, from the owner's own settings.
	 *
	 * Read rather than hardcoded so that changing "shortest booking" in the
	 * admin changes this menu too — and so the search bar can never offer a
	 * length the booking endpoint would refuse.
	 *
	 * Guarded because the settings are free text: a maximum below the minimum
	 * would otherwise render an empty menu with no way to tell why.
	 *
	 * @return array{min: int, max: int} Whole hours.
	 */
	private static function hour_bounds(): array {
		/*
		 * MIN_HOURS, not BASE_HOURS. The two are easy to confuse and an earlier
		 * version used the wrong one: base_hours is how many hours the base rate
		 * covers — a pricing concept — while min_hours is the shortest booking
		 * the server will accept. Reading the pricing value here happened to
		 * give the right number only because both were set to 3.
		 */
		$min = max( 1, (int) round( SettingsRepository::number( SettingsRepository::MIN_HOURS ) ?: 1 ) );
		$max = max( $min, (int) round( SettingsRepository::number( SettingsRepository::MAX_HOURS ) ?: 8 ) );

		return array(
			'min' => $min,
			'max' => $max,
		);
	}

	/**
	 * What the guest asked for, taken from the query string.
	 *
	 * Read here rather than posted over AJAX so the search survives a reload,
	 * a shared link and the back button — and so the grid works with no
	 * JavaScript at all. Nothing is trusted: the date has to parse, and the
	 * numbers are clamped to the range the form offers.
	 *
	 * @param array<string, string> $atts
	 *
	 * @return array{date: string, hours: int, guests: int}
	 */
	private static function showcase_search_values( array $atts ): array {
		$bounds = self::hour_bounds();

		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- A
		// public read-only filter; there is nothing here to forge.
		$date = isset( $_GET[ self::SEARCH_ARGS['date'] ] )
			? self::valid_date( sanitize_text_field( wp_unslash( (string) $_GET[ self::SEARCH_ARGS['date'] ] ) ) )
			: '';

		$hours = isset( $_GET[ self::SEARCH_ARGS['hours'] ] )
			? absint( $_GET[ self::SEARCH_ARGS['hours'] ] )
			: absint( $atts['hours'] );

		$guests = isset( $_GET[ self::SEARCH_ARGS['guests'] ] )
			? absint( $_GET[ self::SEARCH_ARGS['guests'] ] )
			: absint( $atts['guests'] );

		$time = isset( $_GET[ self::SEARCH_ARGS['time'] ] )
			? sanitize_text_field( wp_unslash( (string) $_GET[ self::SEARCH_ARGS['time'] ] ) )
			: (string) $atts['time'];
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		// Only a start the picker actually offers; anything else means "any".
		if ( ! array_key_exists( $time, self::showcase_times() ) ) {
			$time = '';
		}

		return array(
			'date'   => $date,
			'time'   => $time,
			// Opens at the shortest bookable length, which is the commonest
			// choice and the one that shows the lowest price.
			'hours'  => min( $bounds['max'], max( $bounds['min'], $hours ?: $bounds['min'] ) ),
			'guests' => min( 99, $guests ),
		);
	}

	/**
	 * Narrow the list to apartments that can actually be booked as searched.
	 *
	 * Two cases, and the second is the one that matters most in practice:
	 *
	 *   date + time  one window, checked directly.
	 *   date only    every start the picker offers that day. An apartment is
	 *                shown only if at least one of them still fits — so an
	 *                apartment locked across the whole date drops out of the
	 *                grid instead of appearing and failing at checkout.
	 *
	 * The day case loads each apartment's busy windows once and tests the starts
	 * in PHP. Running is_available() per start would be roughly thirty queries
	 * per apartment for a single filtered page.
	 *
	 * @param array<int, array<string, mixed>>                           $apartments
	 * @param array{date: string, time: string, hours: int, guests: int} $search
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function showcase_available( array $apartments, array $search ): array {
		if ( '' === $search['date'] || ! $apartments ) {
			return $apartments;
		}

		$window = self::showcase_window( $search );

		if ( null !== $window ) {
			return array_values(
				array_filter(
					$apartments,
					static fn( array $apartment ): bool => BookingsRepository::is_available(
						(int) $apartment['id'],
						$window[0],
						$window[1]
					)
				)
			);
		}

		$starts = self::showcase_day_starts( $search['date'], $search['hours'] );

		if ( ! $starts ) {
			// Nothing bookable that day for anyone — a past date, typically.
			return array();
		}

		$ids  = wp_list_pluck( $apartments, 'id' );
		$last = end( $starts );

		$busy = BookingsRepository::busy_windows(
			$ids,
			$starts[0][0],
			$last[1]
		);

		return array_values(
			array_filter(
				$apartments,
				static function ( array $apartment ) use ( $busy, $starts ): bool {
					$windows = $busy[ (int) $apartment['id'] ] ?? array();

					foreach ( $starts as $slot ) {
						$free = true;

						foreach ( $windows as $taken ) {
							// Touching ranges do not overlap: one may end
							// exactly as the other begins.
							if ( $taken[0] < $slot[1] && $taken[1] > $slot[0] ) {
								$free = false;
								break;
							}
						}

						if ( $free ) {
							return true;
						}
					}

					return false;
				}
			)
		);
	}

	/**
	 * Every start on a date at which a booking of this length could begin.
	 *
	 * Mirrors SlotGenerator::for_date(): starts run from opening to closing at
	 * the configured step, a booking may finish after closing, and a start that
	 * has already passed is not offered.
	 *
	 * @return array<int, array{0: string, 1: string}> Start/end pairs.
	 */
	private static function showcase_day_starts( string $date, int $hours ): array {
		$step = max( 15, (int) SettingsRepository::number( SettingsRepository::SLOT_STEP ) );

		try {
			$zone  = wp_timezone();
			$open  = new \DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_START ), $zone );
			$close = new \DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_END ), $zone );
			$now   = new \DateTimeImmutable( current_time( 'mysql' ), $zone );
		} catch ( \Exception $e ) {
			return array();
		}

		$starts = array();

		for ( $slot = $open; $slot <= $close; $slot = $slot->modify( "+$step minutes" ) ) {
			if ( $slot <= $now ) {
				continue;
			}

			$ends = $slot->modify( '+' . ( $hours * 60 ) . ' minutes' );

			$starts[] = array(
				$slot->format( 'Y-m-d H:i:s' ),
				$ends->format( 'Y-m-d H:i:s' ),
			);
		}

		return $starts;
	}

	/**
	 * The stay the search describes, as a pair of MySQL timestamps.
	 *
	 * Returned only when both a date and a start time were chosen — those are
	 * what make a window concrete enough to check against the calendar. A date
	 * on its own is deliberately not enough: it would mean testing every start
	 * on that day for every apartment, which is a lot of queries to answer a
	 * question the guest did not ask.
	 *
	 * @param array{date: string, time: string, hours: int, guests: int} $search
	 *
	 * @return array{0: string, 1: string}|null
	 */
	private static function showcase_window( array $search ): ?array {
		if ( '' === $search['date'] || '' === $search['time'] ) {
			return null;
		}

		try {
			$starts = new \DateTimeImmutable( $search['date'] . ' ' . $search['time'] . ':00' );
		} catch ( \Exception $e ) {
			return null;
		}

		$ends = $starts->modify( '+' . (int) round( $search['hours'] * 60 ) . ' minutes' );

		return array( $starts->format( 'Y-m-d H:i:s' ), $ends->format( 'Y-m-d H:i:s' ) );
	}

	/**
	 * The search bar: arrival date, duration, party size.
	 *
	 * One date and a length in hours — there is no check-out field, because an
	 * hourly booking has one date and a second date control would be a field
	 * that can contradict the first.
	 *
	 * A plain GET form, submitting to the page it sits on: the result is
	 * bookmarkable, survives the back button, and needs no JavaScript.
	 *
	 * @param array{date: string, hours: int, guests: int} $search
	 */
	private static function showcase_search_bar( array $search ): string {
		$action = is_front_page() ? home_url( '/' ) : (string) get_permalink();

		if ( '' === $action ) {
			$action = home_url( '/' );
		}

		$arrival  = self::showcase_date_menu( $search['date'] );
		$duration = self::showcase_duration_menu( $search['hours'] );
		$time     = self::showcase_time_menu( $search['time'] );

		/*
		 * Each field is a label above an icon-and-control row — the same shape
		 * as the React filter bar, so a guest moving between the homepage and
		 * an apartment page does not meet two different search bars.
		 */
		return sprintf(
			'<form class="bks-showcase__search" method="get" action="%1$s" role="search">
				%2$s
				%3$s
				%4$s
				<div class="bks-showcase__search-field bks-showcase__search-field--guests">
					<label class="bks-showcase__search-label" for="bks-showcase-guests">%5$s</label>
					<div class="bks-showcase__search-control">%6$s<input type="number" id="bks-showcase-guests" name="%7$s" value="%8$s" min="1" max="99" inputmode="numeric" placeholder="%9$s"></div>
				</div>
				<button type="submit" class="bks-showcase__search-submit">%10$s<span>%11$s</span></button>
			</form>',
			esc_url( $action ),
			$arrival,
			$time,
			$duration,
			esc_html__( 'Guests', 'booking-suite' ),
			self::icon( 'users' ),
			esc_attr( self::SEARCH_ARGS['guests'] ),
			esc_attr( $search['guests'] > 0 ? (string) $search['guests'] : '' ),
			esc_attr__( 'Any', 'booking-suite' ),
			self::icon( 'search', 17 ),
			esc_html__( 'Search', 'booking-suite' )
		);
	}

	/**
	 * The Duration control: a dropdown whose open menu is ours to style.
	 *
	 * A native <select> is the robust choice for a form that must work without
	 * JavaScript, but its open list is drawn by the operating system and no CSS
	 * can reach it. <details>/<summary> gives the same "click to reveal" with
	 * real elements underneath — so the panel, the rows, the hover state and the
	 * tick on the current choice are all designed rather than inherited.
	 *
	 * The options are radios sharing the query argument's name, so the form
	 * still submits by GET with no script involved, and the keyboard gets arrow
	 * navigation through the group for free.
	 *
	 * The trigger carries every label and CSS reveals the checked one, so the
	 * value updates the moment an option is picked with no script involved. The
	 * rules that do it are static in showcase.css rather than generated here:
	 * inline styles added during the_content arrive after wp_head has already
	 * printed the stylesheets, so they never reach the page at all.
	 *
	 * @param int $current The hours currently chosen.
	 */
	private static function showcase_duration_menu( int $current ): string {
		$bounds  = self::hour_bounds();
		$options = array();

		for ( $hours = $bounds['min']; $hours <= $bounds['max']; $hours++ ) {
			$options[ (string) $hours ] = sprintf(
				/* translators: %d: number of hours. */
				_n( '%d hour', '%d hours', $hours, 'booking-suite' ),
				$hours
			);
		}

		return self::showcase_menu(
			'duration',
			__( 'Duration', 'booking-suite' ),
			self::SEARCH_ARGS['hours'],
			'clock',
			$options,
			(string) $current,
			'hours'
		);
	}

	/** How many months of dates the arrival calendar offers. */
	private const CALENDAR_MONTHS = 4;

	/**
	 * The Arrival control: a calendar, not a native date input.
	 *
	 * `<input type="date">` renders in the operating system's locale — dd/mm/yyyy
	 * on this machine whatever Settings → General says — and no CSS or attribute
	 * can change that. The only way to honour the site's own date format is to
	 * draw the calendar ourselves.
	 *
	 * Still no JavaScript: a few months of days are rendered as radios inside the
	 * same dropdown the other filters use, so picking a date and pressing Search
	 * works exactly as before. The value submitted stays 'Y-m-d'; only what the
	 * guest reads is formatted.
	 *
	 * @param string $current The chosen 'Y-m-d', or '' for any.
	 */
	private static function showcase_date_menu( string $current ): string {
		$zone   = wp_timezone();
		$format = (string) get_option( 'date_format', 'j F Y' );

		try {
			$today = new \DateTimeImmutable( current_time( 'Y-m-d' ), $zone );
		} catch ( \Exception $e ) {
			return '';
		}

		// WordPress lets the owner choose which day a week starts on.
		$week_starts = (int) get_option( 'start_of_week', 1 );

		$any = '' === $current;

		$label = $any
			? __( 'Any date', 'booking-suite' )
			: self::showcase_format_date( $current, $format );

		$months = '';

		for ( $offset = 0; $offset < self::CALENDAR_MONTHS; $offset++ ) {
			$months .= self::showcase_month(
				$today->modify( "first day of +$offset month" ),
				$today,
				$current,
				$week_starts,
				$format
			);
		}

		return sprintf(
			'<div class="bks-showcase__search-field bks-showcase__search-field--date">
				<span class="bks-showcase__search-label" id="bks-showcase-date">%1$s</span>
				<details class="bks-showcase__menu bks-showcase__menu--calendar">
					<summary class="bks-showcase__menu-trigger" aria-labelledby="bks-showcase-date">%2$s<span class="bks-showcase__menu-value"><span class="is-current">%3$s</span></span>%4$s</summary>
					<div class="bks-showcase__menu-panel" role="radiogroup" aria-labelledby="bks-showcase-date">
						<label class="bks-showcase__option"><input type="radio" name="%5$s" value=""%6$s data-label="%7$s"><span class="bks-showcase__option-label">%7$s</span>%8$s</label>
						%9$s
					</div>
				</details>
			</div>',
			esc_html__( 'Arrival', 'booking-suite' ),
			self::icon( 'calendar' ),
			esc_html( $label ),
			self::icon( 'chevron', 16 ),
			esc_attr( self::SEARCH_ARGS['date'] ),
			checked( $any, true, false ),
			esc_attr__( 'Any date', 'booking-suite' ),
			self::icon( 'check', 16 ),
			$months
		);
	}

	/**
	 * One month of the arrival calendar.
	 *
	 * Days before today are drawn but not selectable — removing them would shift
	 * the remaining days out of their weekday columns, which is worse than a few
	 * greyed-out numbers.
	 *
	 * @param \DateTimeImmutable $month       Any day in the month to draw.
	 * @param \DateTimeImmutable $today       The first selectable day.
	 * @param string             $current     The chosen 'Y-m-d'.
	 * @param int                $week_starts 0 for Sunday, per Settings → General.
	 * @param string             $format      The site's date format.
	 */
	private static function showcase_month(
		\DateTimeImmutable $month,
		\DateTimeImmutable $today,
		string $current,
		int $week_starts,
		string $format
	): string {
		$first = $month->modify( 'first day of this month' );
		$days  = (int) $month->format( 't' );

		// How many blanks before the 1st, given the week's first day.
		$lead = ( (int) $first->format( 'w' ) - $week_starts + 7 ) % 7;

		$headers = '';

		for ( $index = 0; $index < 7; $index++ ) {
			// 2024-01-07 was a Sunday, a convenient origin for weekday names.
			$sample = new \DateTimeImmutable( '2024-01-07' );
			$sample = $sample->modify( '+' . ( ( $week_starts + $index ) % 7 ) . ' days' );

			$headers .= sprintf(
				'<abbr title="%1$s">%2$s</abbr>',
				esc_attr( wp_date( 'l', $sample->getTimestamp() ) ?: '' ),
				esc_html( mb_substr( (string) wp_date( 'D', $sample->getTimestamp() ), 0, 2 ) )
			);
		}

		$cells = str_repeat( '<span class="bks-showcase__cal-pad"></span>', $lead );

		for ( $day = 1; $day <= $days; $day++ ) {
			$date = $first->modify( '+' . ( $day - 1 ) . ' days' );
			$key  = $date->format( 'Y-m-d' );

			if ( $date < $today ) {
				$cells .= sprintf(
					'<span class="bks-showcase__cal-day is-past" aria-hidden="true">%d</span>',
					$day
				);

				continue;
			}

			$cells .= sprintf(
				'<label class="bks-showcase__cal-day"><input type="radio" name="%1$s" value="%2$s"%3$s data-label="%4$s"><span>%5$d</span><span class="bks-sr-only">%4$s</span></label>',
				esc_attr( self::SEARCH_ARGS['date'] ),
				esc_attr( $key ),
				checked( $key === $current, true, false ),
				esc_attr( self::showcase_format_date( $key, $format ) ),
				$day
			);
		}

		return sprintf(
			'<div class="bks-showcase__cal"><span class="bks-showcase__cal-caption">%1$s</span><div class="bks-showcase__cal-head">%2$s</div><div class="bks-showcase__cal-grid">%3$s</div></div>',
			esc_html( (string) wp_date( 'F Y', $first->getTimestamp() ) ),
			$headers,
			$cells
		);
	}

	/**
	 * A 'Y-m-d' date in the site's own format.
	 *
	 * Built in the site timezone so wp_date(), which shifts whatever timestamp it
	 * is handed, formats back to the same calendar day.
	 */
	private static function showcase_format_date( string $key, string $format ): string {
		try {
			$date = new \DateTimeImmutable( $key . ' 12:00', wp_timezone() );
		} catch ( \Exception $e ) {
			return $key;
		}

		return (string) wp_date( $format, $date->getTimestamp() );
	}

	/**
	 * The Time control: which start the guest wants.
	 *
	 * "Any time" is a real option and the default, because a guest browsing the
	 * homepage usually has a day in mind before an hour — and because filtering
	 * by availability only becomes meaningful once a start is actually named.
	 *
	 * @param string $current The chosen 'H:i', or '' for any.
	 */
	private static function showcase_time_menu( string $current ): string {
		$options = array( '' => __( 'Any time', 'booking-suite' ) ) + self::showcase_times();

		return self::showcase_menu(
			'time',
			__( 'Time', 'booking-suite' ),
			self::SEARCH_ARGS['time'],
			'clock',
			$options,
			$current,
			'value'
		);
	}

	/**
	 * One dropdown: a styled trigger over a panel of radio options.
	 *
	 * Shared by Duration and Time so the two cannot drift apart. The options are
	 * radios sharing the query argument's name, so the form still submits by GET
	 * with no script, and the keyboard gets arrow navigation through the group
	 * for free.
	 *
	 * @param string                $id      Slug for the element ids.
	 * @param string                $label   The field label.
	 * @param string                $name    Query argument the radios submit as.
	 * @param string                $icon    Icon name for the trigger.
	 * @param array<string, string> $options value => label, in order.
	 * @param string                $current The selected value.
	 * @param string                $attr    Data attribute the stylesheet keys on.
	 */
	private static function showcase_menu(
		string $id,
		string $label,
		string $name,
		string $icon,
		array $options,
		string $current,
		string $attr
	): string {
		$rows   = '';
		$values = '';

		foreach ( $options as $value => $text ) {
			$is_current = (string) $value === $current;

			$rows .= sprintf(
				'<label class="bks-showcase__option"><input type="radio" name="%1$s" value="%2$s"%3$s><span class="bks-showcase__option-label">%4$s</span>%5$s</label>',
				esc_attr( $name ),
				esc_attr( (string) $value ),
				checked( $is_current, true, false ),
				esc_html( $text ),
				self::icon( 'check', 16 )
			);

			/*
			 * Every label sits in the trigger and the stylesheet reveals the
			 * checked one, so the value changes the instant an option is picked.
			 * The server-rendered choice is marked as well, so a browser without
			 * :has() — and every browser for the Time menu, whose values cannot
			 * be enumerated in a static stylesheet — still shows the applied
			 * value rather than nothing.
			 */
			$values .= sprintf(
				'<span data-%1$s="%2$s"%3$s>%4$s</span>',
				esc_attr( $attr ),
				esc_attr( (string) $value ),
				$is_current ? ' class="is-current"' : '',
				esc_html( $text )
			);
		}

		return sprintf(
			'<div class="bks-showcase__search-field bks-showcase__search-field--%1$s">
				<span class="bks-showcase__search-label" id="bks-showcase-%1$s">%2$s</span>
				<details class="bks-showcase__menu">
					<summary class="bks-showcase__menu-trigger" aria-labelledby="bks-showcase-%1$s">%3$s<span class="bks-showcase__menu-value">%4$s</span>%5$s</summary>
					<div class="bks-showcase__menu-panel" role="radiogroup" aria-labelledby="bks-showcase-%1$s">%6$s</div>
				</details>
			</div>',
			esc_attr( $id ),
			esc_html( $label ),
			self::icon( $icon ),
			$values,
			self::icon( 'chevron', 16 ),
			$rows
		);
	}

	/**
	 * One inline SVG from the guest icon set.
	 *
	 * Inline rather than an icon font or sprite: the showcase is rendered before
	 * any stylesheet or script has run, and an icon that arrives late is an icon
	 * that shifts the layout. The paths match the React set exactly, so the two
	 * search bars draw the same marks.
	 *
	 * Decorative in every use here — each sits beside a real label — so all
	 * carry aria-hidden.
	 *
	 * @param string $name One of calendar, clock, users, search, chevron.
	 * @param int    $size Width and height in pixels.
	 */
	private static function icon( string $name, int $size = 16 ): string {
		$paths = array(
			'calendar' => '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3.5V6M16 3.5V6"/>',
			'clock'    => '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
			'users'    => '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
			'search'   => '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/>',
			'chevron'  => '<path d="m6 9.5 6 6 6-6"/>',
			'check'    => '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
			'image'    => '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 4.5-4.5 3 3 3-2.5L20 17"/>',
		);

		if ( ! isset( $paths[ $name ] ) ) {
			return '';
		}

		return sprintf(
			'<svg class="bks-showcase__icon bks-showcase__icon--%1$s" width="%2$d" height="%2$d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">%3$s</svg>',
			esc_attr( $name ),
			$size,
			$paths[ $name ]
		);
	}

	/**
	 * @param array<string, string> $atts
	 */
	private static function showcase_header( array $atts ): string {
		$heading    = trim( (string) $atts['heading'] );
		$subheading = trim( (string) $atts['subheading'] );

		if ( '' === $heading && '' === $subheading ) {
			return '';
		}

		$markup = '<header class="bks-showcase__header">';

		if ( '' !== $heading ) {
			$markup .= '<h2 class="bks-showcase__heading">' . esc_html( $heading ) . '</h2>';
		}

		if ( '' !== $subheading ) {
			$markup .= '<p class="bks-showcase__subheading">' . esc_html( $subheading ) . '</p>';
		}

		return $markup . '</header>';
	}

	/**
	 * One apartment card.
	 *
	 * @param array<string, mixed>  $apartment
	 * @param array<string, string> $atts
	 * @param array<int, float>     $prices   Fallback prices, keyed by apartment id.
	 */
	private static function showcase_card(
		array $apartment,
		array $atts,
		array $prices,
		string $currency,
		array $search = array()
	): string {
		$id     = (int) $apartment['id'];
		$name   = (string) $apartment['name'];
		$colour = (string) $apartment['colour'];

		$title = esc_html( $name );

		if ( 'no' !== $atts['link'] && ! empty( $apartment['permalink'] ) ) {
			$title = sprintf(
				'<a href="%1$s">%2$s</a>',
				esc_url( (string) $apartment['permalink'] ),
				$title
			);
		}

		$excerpt = '';

		if ( 'no' !== $atts['excerpt'] ) {
			/*
			 * strip_shortcodes() before the tags, not after: an apartment's
			 * description routinely contains [booking_suite_book_now], and
			 * stripping only tags leaves the shortcode's literal source text
			 * sitting in the card as if it were prose.
			 */
			$text = wp_trim_words(
				wp_strip_all_tags( strip_shortcodes( (string) $apartment['description'] ) ),
				22
			);

			if ( '' !== $text ) {
				$excerpt = '<p class="bks-showcase__excerpt">' . esc_html( $text ) . '</p>';
			}
		}

		$price = '';

		if ( 'no' !== $atts['price'] ) {
			$price = self::showcase_price( $apartment, $search, $prices, $currency );
		}

		// The button, unchanged — same markup, same modal, same behaviour as the
		// one on the apartment's own page.
		$button = self::render_book_now(
			array(
				'id'     => (string) $id,
				'label'  => (string) $atts['label'],
				'size'   => 'sm',
				// Carries the search bar's answers into the modal, so the guest
				// does not describe the same stay twice.
				'date'   => (string) ( $search['date'] ?? '' ),
				'time'   => (string) ( $search['time'] ?? '' ),
				'hours'  => (string) ( $search['hours'] ?? '' ),
				'guests' => (string) ( $search['guests'] ?? '' ),
			)
		);

		return sprintf(
			'<li class="bks-showcase__card">%1$s<div class="bks-showcase__body"><h3 class="bks-showcase__title">%2$s</h3>%3$s<div class="bks-showcase__footer">%4$s%5$s</div></div></li>',
			self::showcase_media( $apartment, $colour ),
			$title,
			$excerpt,
			$price,
			$button
		);
	}

	/**
	 * What the stay on the card costs.
	 *
	 * Priced for the duration the guest asked for, not per night: this grid
	 * sells hourly visits, and "from €120 / night" answers a question nobody on
	 * it is asking.
	 *
	 * The figure comes from RateCalculator::quote(), the same call the booking
	 * flow prices with, rather than from multiplying an hourly rate by hand. The
	 * two would disagree the moment a booking crosses the base-hours break or a
	 * weekend rate, and a card that quotes less than the checkout is worse than
	 * a card that quotes nothing.
	 *
	 * @param array<string, mixed>                                      $apartment
	 * @param array{date: string, time: string, hours: int, guests: int} $search
	 * @param array<int, float>                                         $prices   Fallback prices by id.
	 */
	private static function showcase_price(
		array $apartment,
		array $search,
		array $prices,
		string $currency
	): string {
		$id = (int) $apartment['id'];

		if ( ! RateCalculator::is_priced( $apartment ) ) {
			// No rate set at all; the rules table is the last fallback.
			$fallback = $prices[ $id ] ?? null;

			if ( null === $fallback ) {
				return '<span class="bks-showcase__price bks-showcase__price--request">'
					. esc_html__( 'Price on request', 'booking-suite' )
					. '</span>';
			}

			return sprintf(
				'<span class="bks-showcase__price">%1$s<span class="bks-showcase__price-value">%2$s</span></span>',
				esc_html__( 'from', 'booking-suite' ),
				esc_html( self::money( (float) $fallback, $currency ) )
			);
		}

		$window = self::showcase_window( $search );

		/*
		 * With no date and time chosen there is still a duration to price, so
		 * the card quotes it on the next bookable day at opening time and says
		 * "from" — the rate can differ at a weekend, and the label is what keeps
		 * the number honest rather than merely approximate.
		 */
		$is_exact = null !== $window;

		if ( ! $is_exact ) {
			$date = '' !== $search['date'] ? $search['date'] : current_time( 'Y-m-d' );
			$open = SettingsRepository::get( SettingsRepository::DAY_START );

			try {
				$starts = new \DateTimeImmutable( $date . ' ' . $open );
			} catch ( \Exception $e ) {
				return '';
			}

			$ends   = $starts->modify( '+' . (int) round( $search['hours'] * 60 ) . ' minutes' );
			$window = array( $starts->format( 'Y-m-d H:i:s' ), $ends->format( 'Y-m-d H:i:s' ) );
		}

		$quote = RateCalculator::quote(
			$apartment,
			$window[0],
			$window[1],
			max( 1, $search['guests'] )
		);

		$hours = sprintf(
			/* translators: %d: number of hours. */
			_n( '%d hour', '%d hours', $search['hours'], 'booking-suite' ),
			$search['hours']
		);

		return sprintf(
			'<span class="bks-showcase__price">%1$s<span class="bks-showcase__price-value">%2$s</span><span class="bks-showcase__price-unit">%3$s</span></span>',
			$is_exact ? '' : esc_html__( 'from', 'booking-suite' ),
			esc_html( self::money( (float) $quote['subtotal'], $currency ) ),
			esc_html(
				sprintf(
					/* translators: %s: a duration such as "3 hours". */
					__( '/ %s', 'booking-suite' ),
					$hours
				)
			)
		);
	}

	/**
	 * The card's photo, with the capacity badge over it.
	 *
	 * The featured image is preferred over the gallery: it is the one the owner
	 * chose to represent the apartment, and it is what every other WordPress
	 * surface already shows.
	 *
	 * @param array<string, mixed> $apartment
	 */
	private static function showcase_media( array $apartment, string $colour ): string {
		$id = (int) $apartment['id'];

		$attachment_id = (int) get_post_thumbnail_id( $id );

		if ( ! $attachment_id ) {
			$images        = (array) $apartment['images'];
			$attachment_id = (int) ( reset( $images ) ?: 0 );
		}

		$image = $attachment_id
			? wp_get_attachment_image(
				$attachment_id,
				'medium_large',
				false,
				array(
					// Not pre-escaped: wp_get_attachment_image() escapes every
					// attribute itself, and doing it twice mangles apostrophes.
					'alt'   => (string) $apartment['name'],
					// No `loading` here — WordPress adds lazy loading itself,
					// and setting it too emits the attribute twice.
					'sizes' => '(min-width: 62rem) 33vw, (min-width: 40rem) 50vw, 100vw',
				)
			)
			: '';

		if ( '' === $image ) {
			/*
			 * An apartment with no photo yet. A wash of its own colour plus a
			 * picture mark, rather than an empty grey rectangle — the latter
			 * reads as a broken image, which is worse than an obvious absence.
			 */
			$image = sprintf(
				'<span class="bks-showcase__placeholder" aria-hidden="true"><span class="bks-showcase__placeholder-wash" style="background:%1$s"></span>%2$s</span>',
				esc_attr( $colour ),
				self::icon( 'image', 28 )
			);
		}

		$capacity = (int) $apartment['capacity'];

		$badge = sprintf(
			'<span class="bks-showcase__badge">%s</span>',
			esc_html(
				sprintf(
					/* translators: %d: maximum number of guests. */
					_n( '%d guest', '%d guests', $capacity, 'booking-suite' ),
					$capacity
				)
			)
		);

		return sprintf(
			'<div class="bks-showcase__media">%1$s<span class="bks-showcase__accent" style="background:%2$s" aria-hidden="true"></span>%3$s</div>',
			$image,
			esc_attr( $colour ),
			$badge
		);
	}

	/**
	 * A price for a card: no decimals on a round number, which most rates are.
	 */
	private static function money( float $amount, string $currency ): string {
		$symbols = array(
			'EUR' => '€',
			'USD' => '$',
			'GBP' => '£',
			'CHF' => 'CHF',
		);

		$decimals = 0.0 === fmod( round( $amount, 2 ), 1.0 ) ? 0 : 2;

		$value = number_format_i18n( $amount, $decimals );

		return $value . ' ' . ( $symbols[ strtoupper( $currency ) ] ?? $currency );
	}
}
