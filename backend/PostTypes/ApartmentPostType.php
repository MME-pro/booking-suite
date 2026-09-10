<?php
/**
 * The Apartment post type.
 *
 * Apartments are posts, not rows in a custom table: that is what gives each
 * one a real permalink, an Elementor single template, and dynamic tags that
 * read the fields below. Everything else — price rules, bookings, blocks —
 * references the post id.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\PostTypes;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;

defined( 'ABSPATH' ) || exit;

final class ApartmentPostType {

	public const POST_TYPE = 'bks_apartment';

	/**
	 * Legacy meta keys.
	 *
	 * These fields now live in the mmebk_apartments table; the map is kept so
	 * MetaToTableMigration can find and clear the old values.
	 */
	public const META = array(
		'capacity'            => 'bks_capacity',
		'colour'              => 'bks_colour',
		'cleaning_min'        => 'bks_cleaning_min',
		'holiday_hesse'       => 'bks_holiday_hesse',
		'active'              => 'bks_active',
		'internal_short_link' => 'bks_internal_short_link',
		'booking_short_link'  => 'bks_booking_short_link',
		'images'              => 'bks_gallery',
	);

	public static function register(): void {
		add_action( 'init', array( self::class, 'register_post_type' ) );

		// Keep the table in step with posts created or removed outside the
		// Booking Suite screens — straight from wp-admin, an import, or WP-CLI.
		add_action( 'wp_insert_post', array( self::class, 'on_insert' ), 10, 2 );
		add_action( 'deleted_post', array( self::class, 'on_delete' ), 10, 2 );

		// The short-link column on the WordPress apartments list.
		add_filter( 'manage_' . self::POST_TYPE . '_posts_columns', array( self::class, 'columns' ) );
		add_action( 'manage_' . self::POST_TYPE . '_posts_custom_column', array( self::class, 'column' ), 10, 2 );
		add_action( 'admin_head-edit.php', array( self::class, 'column_style' ) );
	}

	/**
	 * Add the short link to the apartments list.
	 *
	 * Placed before Date, which is the least useful thing on this screen — an
	 * apartment's publish date is not something anyone comes here to read, and
	 * the link is something they come here to copy.
	 *
	 * @param array<string, string> $columns The existing columns.
	 *
	 * @return array<string, string> With the short link inserted.
	 */
	/**
	 * The columns this list adds, in the order they are drawn.
	 *
	 * Declared once and read by the header, the cells and the stylesheet, so
	 * adding a sixth means touching one array rather than three places that
	 * have to agree.
	 *
	 * @return array<string, string> Column key => the apartment field it shows.
	 */
	private static function rate_columns(): array {
		return array(
			'bks_capacity'        => 'capacity',
			'bks_weekday_rate'    => 'weekday_rate',
			'bks_weekend_rate'    => 'weekend_rate',
			'bks_surcharge_hour'  => 'surcharge_hour',
			'bks_surcharge_guest' => 'surcharge_guest',
		);
	}

	/**
	 * What each of them is called.
	 *
	 * @return array<string, string>
	 */
	private static function rate_labels(): array {
		return array(
			'bks_capacity'        => __( 'Guests', 'booking-suite' ),
			'bks_weekday_rate'    => __( 'Weekday', 'booking-suite' ),
			'bks_weekend_rate'    => __( 'Weekend', 'booking-suite' ),
			'bks_surcharge_hour'  => __( 'Per extra hour', 'booking-suite' ),
			'bks_surcharge_guest' => __( 'Per extra guest', 'booking-suite' ),
		);
	}

	public static function columns( array $columns ): array {
		$out = array();

		foreach ( $columns as $key => $label ) {
			if ( 'date' === $key ) {
				/*
				 * Before the date, and in one block: capacity and the rates
				 * are read together when comparing two apartments, and a
				 * column of WordPress's own between them breaks the comparison
				 * in half.
				 */
				foreach ( self::rate_labels() as $rate_key => $rate_label ) {
					$out[ $rate_key ] = $rate_label;
				}

				$out['bks_short_link'] = __( 'Short link', 'booking-suite' );
			}

			$out[ $key ] = $label;
		}

		// The same guard the short link has: a list with Date switched off in
		// Screen Options must not lose these with it.
		foreach ( self::rate_labels() as $rate_key => $rate_label ) {
			if ( ! isset( $out[ $rate_key ] ) ) {
				$out[ $rate_key ] = $rate_label;
			}
		}

		// A list with the Date column switched off in Screen Options would
		// otherwise lose the short link with it.
		if ( ! isset( $out['bks_short_link'] ) ) {
			$out['bks_short_link'] = __( 'Short link', 'booking-suite' );
		}

		return $out;
	}

	/**
	 * Draw one cell of it.
	 *
	 * The link is minted on publish, so a published apartment always has one.
	 * A draft does not, and says so rather than showing an empty cell that
	 * reads as a bug.
	 *
	 * @param string $column  Which column is being drawn.
	 * @param int    $post_id The apartment.
	 */
	public static function column( string $column, int $post_id ): void {
		$rates = self::rate_columns();

		if ( isset( $rates[ $column ] ) ) {
			self::rate_cell( $column, $rates[ $column ], $post_id );

			return;
		}

		if ( 'bks_short_link' !== $column ) {
			return;
		}

		$apartment = ApartmentsRepository::find( $post_id );
		$link      = trim( (string) ( $apartment['internal_short_link'] ?? '' ) );

		if ( '' === $link ) {
			printf(
				'<span class="bks-short-link__empty">%s</span>',
				esc_html__( 'Not published yet', 'booking-suite' )
			);

			return;
		}

		$path = '/' . ltrim( $link, '/' );
		$url  = home_url( $path );

		/*
		 * The path is what is shown and the full address is what is copied:
		 * the host is identical on every row, and repeating it crowds out the
		 * part that differs — but nobody can paste a path into a newsletter.
		 *
		 * A plain input rather than a button and some JavaScript. It selects
		 * on click, copies with the keyboard everyone already knows, and works
		 * on the http installs where the clipboard API does not exist.
		 */
		printf(
			'<input type="text" class="bks-short-link" readonly value="%1$s" onclick="this.select()" aria-label="%2$s" /><br /><a href="%3$s" target="_blank" rel="noreferrer" class="bks-short-link__open">%4$s</a>',
			esc_attr( $url ),
			esc_attr__( 'Short link', 'booking-suite' ),
			esc_url( $url ),
			esc_html( $path )
		);
	}

	/**
	 * One capacity or rate cell.
	 *
	 * A rate of zero is drawn as a dash rather than as "0,00 €". Zero here
	 * almost always means "not set yet" — the apartment is priced by the
	 * fallback rules — and printing it as a price states something the owner
	 * never said.
	 *
	 * @param string $column  The column being drawn.
	 * @param string $field   The apartment field behind it.
	 * @param int    $post_id The apartment.
	 */
	private static function rate_cell( string $column, string $field, int $post_id ): void {
		$apartment = ApartmentsRepository::find( $post_id );

		if ( null === $apartment ) {
			echo '<span class="bks-rate__empty">&mdash;</span>';

			return;
		}

		if ( 'capacity' === $field ) {
			printf(
				'<span class="bks-rate">%s</span>',
				esc_html( number_format_i18n( (int) ( $apartment[ $field ] ?? 1 ) ) )
			);

			return;
		}

		$amount = (float) ( $apartment[ $field ] ?? 0 );

		if ( $amount <= 0 ) {
			echo '<span class="bks-rate__empty">&mdash;</span>';

			return;
		}

		printf(
			'<span class="bks-rate">%s</span>',
			esc_html( number_format_i18n( $amount, 2 ) . ' ' . SettingsRepository::currency_symbol() )
		);
	}

	/**
	 * Keep the field from stretching the column across the table.
	 */
	public static function column_style(): void {
		$screen = get_current_screen();

		if ( ! $screen || self::POST_TYPE !== $screen->post_type ) {
			return;
		}

		echo '<style>
			.column-bks_short_link { width: 18em; }
			/* Left, like every other column in a WordPress list table.
			   Tabular figures still line the digits up under each other. */
			.column-bks_capacity,
			.column-bks_weekday_rate,
			.column-bks_weekend_rate,
			.column-bks_surcharge_hour,
			.column-bks_surcharge_guest { width: 8em; text-align: left; }
			.bks-rate { font-variant-numeric: tabular-nums; white-space: nowrap; }
			.bks-rate__empty { color: #646970; }
			.bks-short-link { width: 100%; font-family: monospace; font-size: 12px; }
			.bks-short-link__open { font-family: monospace; font-size: 12px; }
			.bks-short-link__empty { color: #646970; font-style: italic; }
		</style>';
	}

	/**
	 * @param int      $post_id Post id.
	 * @param \WP_Post $post    Post object.
	 */
	public static function on_insert( int $post_id, $post ): void {
		if ( ! $post instanceof \WP_Post || self::POST_TYPE !== $post->post_type ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		ApartmentsRepository::ensure_row( $post_id );

		/*
		 * The short link is minted on PUBLISH, not on every save. A draft has
		 * no slug for it to be built from, and a link handed out for an
		 * apartment that was never published is a link to nothing.
		 */
		if ( 'publish' === $post->post_status ) {
			ApartmentsRepository::ensure_short_link( $post_id );
		}
	}

	/**
	 * @param int      $post_id Post id.
	 * @param \WP_Post $post    Post object.
	 */
	public static function on_delete( int $post_id, $post = null ): void {
		if ( $post instanceof \WP_Post && self::POST_TYPE !== $post->post_type ) {
			return;
		}

		ApartmentsRepository::delete_row( $post_id );

		/*
		 * The calendar subscriptions go too. They are the one thing hanging off
		 * an apartment that keeps working after it is gone: the scheduled sync
		 * would go on pulling them, writing locks for a room nobody can see,
		 * and no screen lists them because every screen lists them under the
		 * apartment they belong to.
		 */
		IcalFeedsRepository::delete_for_apartment( $post_id );
	}

	public static function register_post_type(): void {
		register_post_type(
			self::POST_TYPE,
			array(
				'labels'             => array(
					'name'               => __( 'Apartments', 'booking-suite' ),
					'singular_name'      => __( 'Apartment', 'booking-suite' ),
					'add_new_item'       => __( 'Add Apartment', 'booking-suite' ),
					'edit_item'          => __( 'Edit Apartment', 'booking-suite' ),
					'new_item'           => __( 'New Apartment', 'booking-suite' ),
					'view_item'          => __( 'View Apartment', 'booking-suite' ),
					'search_items'       => __( 'Search Apartments', 'booking-suite' ),
					'not_found'          => __( 'No apartments found.', 'booking-suite' ),
					'all_items'          => __( 'All Apartments', 'booking-suite' ),
				),
				'public'             => true,
				'has_archive'        => true,
				'publicly_queryable' => true,
				'show_ui'            => true,

				// Reachable from the Booking Suite menu rather than its own
				// top-level entry, so the admin keeps one home.
				'show_in_menu'       => false,
				'show_in_rest'       => true,
				'menu_icon'          => 'dashicons-building',
				'rewrite'            => array( 'slug' => 'apartment' ),
				'supports'           => array(
					'title',
					'editor',
					'excerpt',
					'thumbnail',
					'revisions',
					'custom-fields',
					'page-attributes',
				),
			)
		);
	}

}
