<?php
/**
 * Public-facing asset registration.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Site;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Repositories\SettingsRepository;

use const BookingSuite\PLUGIN_DIR;
use const BookingSuite\PLUGIN_URL;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class Assets {

	public const HANDLE = 'booking-suite-site';

	/**
	 * The showcase stylesheet.
	 *
	 * Kept out of the guest bundle because the showcase is rendered by PHP: a
	 * page using only that shortcode should not have to download the app's CSS
	 * to look right, even though the bundle still loads for the modal.
	 */
	public const SHOWCASE_HANDLE = 'booking-suite-showcase';

	/** Path of the built bundle, relative to the plugin directory. */
	private const BUILD_PATH = 'frontend/site/app/build/';

	/** Path of the showcase stylesheet, relative to the plugin directory. */
	private const SHOWCASE_PATH = 'frontend/site/assets/showcase.css';

	/** Path of the showcase enhancement script. */
	private const SHOWCASE_SCRIPT = 'frontend/site/assets/showcase.js';

	/** Global the guest app reads its bootstrap data from. */
	private const DATA_OBJECT = 'bookingSuiteSite';

	public static function register(): void {
		/*
		 * Priority 20, not the default 10. Themes enqueue their reset and base
		 * stylesheets at 10, and a stylesheet that prints first loses every tie
		 * on specificity — which is why the search bar was picking up the
		 * theme's input borders and button colours. Printing after the theme
		 * lets ordinary selectors win instead of forcing !important onto every
		 * rule.
		 */
		add_action( 'wp_enqueue_scripts', array( self::class, 'on_enqueue_scripts' ), 20 );
	}

	/**
	 * Register the bundle, and enqueue it up front when the page being shown
	 * already contains one of the shortcodes.
	 *
	 * Block themes render post content at a point where enqueuing from inside
	 * the shortcode can be too late for the footer, so the common case is
	 * handled here instead of relying on render order.
	 */
	public static function on_enqueue_scripts(): void {
		self::register_app();
		self::register_showcase();

		if ( self::current_page_uses_shortcode() ) {
			self::enqueue_app();
		}

		if ( self::content_has( Shortcodes::SHOWCASE ) ) {
			// The bundle too: every card carries a booking button, and the
			// button is inert without the modal behind it.
			self::enqueue_app();
			self::enqueue_showcase();
		}
	}

	/**
	 * Whether the page being rendered uses one of the guest shortcodes.
	 *
	 * post_content alone is not enough. A page built in Elementor keeps its
	 * layout in post meta, so a shortcode placed in an Elementor widget never
	 * appears in post_content — and apartment pages are designed in Elementor
	 * by default. Both places are checked here; anything further out (a theme
	 * template calling do_shortcode(), a sidebar widget) still works through
	 * the enqueue call inside the shortcode itself.
	 */
	private static function current_page_uses_shortcode(): bool {
		/*
		 * Every apartment page gets the booking button appended to it (see
		 * Shortcodes::append_book_now), and that runs while the content is
		 * rendered — too late for the stylesheet to make it into wp_head. So
		 * the page is claimed here instead, and the CSS arrives with the page
		 * rather than after it.
		 */
		if ( is_singular( ApartmentPostType::POST_TYPE ) ) {
			return true;
		}

		return self::content_has(
			Shortcodes::APARTMENTS,
			Shortcodes::BOOK_NOW,
			Shortcodes::SHOWCASE
		);
	}

	/**
	 * Whether the post being rendered contains any of the given shortcodes.
	 *
	 * post_content alone is not enough. A page built in Elementor keeps its
	 * layout in post meta, so a shortcode placed in an Elementor widget never
	 * appears in post_content. Both places are checked; anything further out (a
	 * theme template calling do_shortcode(), a sidebar widget) still works
	 * through the enqueue call inside the shortcode itself.
	 */
	private static function content_has( string ...$shortcodes ): bool {
		$post = get_post();

		if ( ! $post instanceof \WP_Post ) {
			return false;
		}

		$haystacks = array( (string) $post->post_content );

		$elementor = get_post_meta( $post->ID, '_elementor_data', true );

		if ( is_string( $elementor ) && '' !== $elementor ) {
			$haystacks[] = $elementor;
		}

		foreach ( $haystacks as $content ) {
			foreach ( $shortcodes as $shortcode ) {
				/*
				 * has_shortcode() parses, which is right for post_content but
				 * gives nothing on Elementor's JSON — hence the plain search
				 * for the opening tag alongside it.
				 */
				if (
					has_shortcode( $content, $shortcode )
					|| false !== strpos( $content, '[' . $shortcode )
				) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Register — but do not enqueue — the bundle. Safe to call repeatedly.
	 */
	public static function register_app(): void {
		if ( wp_script_is( self::HANDLE, 'registered' ) ) {
			return;
		}

		$asset = self::asset_manifest();

		if ( null === $asset ) {
			return;
		}

		wp_register_script(
			self::HANDLE,
			PLUGIN_URL . self::BUILD_PATH . 'index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( is_readable( PLUGIN_DIR . self::BUILD_PATH . 'index.css' ) ) {
			wp_register_style(
				self::HANDLE,
				PLUGIN_URL . self::BUILD_PATH . 'index.css',
				array(),
				$asset['version']
			);

			wp_style_add_data( self::HANDLE, 'rtl', 'replace' );
		}

		/*
		 * Hands the bundle its own translations. Without this the PHP half of
		 * the plugin speaks German and the booking flow — every label a guest
		 * actually reads — stays in English.
		 *
		 * Registered rather than enqueued at this point, which is fine:
		 * WordPress prints the translations alongside the script whenever it
		 * ends up on the page.
		 */
		wp_set_script_translations( self::HANDLE, 'booking-suite', PLUGIN_DIR . 'languages' );

		wp_localize_script(
			self::HANDLE,
			self::DATA_OBJECT,
			array(
				'restUrl'    => esc_url_raw( rest_url( 'booking-suite/v1/' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'locale'     => determine_locale(),

				/*
				 * Settings → General, so the booking flow writes dates and times
				 * the way the rest of the site does. Sent as the raw PHP format
				 * strings and formatted in the browser — the alternative, having
				 * the server pre-format every date, would mean a round trip
				 * before the guest could see the stay they just picked.
				 */
				'dateFormat'  => (string) get_option( 'date_format', 'j F Y' ),
				'timeFormat'  => (string) get_option( 'time_format', 'H:i' ),
				'timezone'    => wp_timezone_string(),

				/*
				 * Which day a week starts on, 0 for Sunday. Guessing this from
				 * the locale gets it wrong for anyone whose site language and
				 * calendar habits differ — and it is a setting the owner has
				 * already answered.
				 */
				'startOfWeek' => (int) get_option( 'start_of_week', 1 ),

				/*
				 * The bookable length, straight from the owner's settings. Sent
				 * with the page rather than fetched, so the duration control is
				 * correct on first paint — and so changing the setting changes
				 * the control, instead of the two drifting apart.
				 */
				'minHours' => SettingsRepository::number( SettingsRepository::MIN_HOURS ),
				'maxHours' => SettingsRepository::number( SettingsRepository::MAX_HOURS ),
			)
		);
	}

	/**
	 * Pull the bundle onto the current page, registering it first if the
	 * shortcode ran before wp_enqueue_scripts did.
	 */
	public static function enqueue_app(): void {
		self::register_app();

		if ( wp_script_is( self::HANDLE, 'registered' ) ) {
			wp_enqueue_script( self::HANDLE );
		}

		if ( wp_style_is( self::HANDLE, 'registered' ) ) {
			wp_enqueue_style( self::HANDLE );
		}
	}

	/**
	 * Register — but do not enqueue — the showcase stylesheet.
	 */
	public static function register_showcase(): void {
		if ( wp_style_is( self::SHOWCASE_HANDLE, 'registered' ) ) {
			return;
		}

		if ( ! is_readable( PLUGIN_DIR . self::SHOWCASE_PATH ) ) {
			return;
		}

		/*
		 * Depend on the bundle's stylesheet only when there is one to depend on:
		 * WordPress silently drops a style whose dependency is missing, and an
		 * unbuilt bundle would take the showcase down with it. The dependency is
		 * worth declaring where it exists — it puts the design tokens ahead of
		 * the rules that read them.
		 */
		$deps = wp_style_is( self::HANDLE, 'registered' ) ? array( self::HANDLE ) : array();

		/*
		 * Versioned by the file's own timestamp rather than the plugin version.
		 * This stylesheet is hand-written — nothing hashes it the way webpack
		 * hashes the bundles — so a plugin version that only moves on release
		 * would leave every visitor, and the person reviewing the change, on a
		 * cached copy of the previous design.
		 */
		$modified = filemtime( PLUGIN_DIR . self::SHOWCASE_PATH );

		wp_register_style(
			self::SHOWCASE_HANDLE,
			PLUGIN_URL . self::SHOWCASE_PATH,
			$deps,
			$modified ? (string) $modified : VERSION
		);

		/*
		 * The enhancement script: closes a dropdown when attention moves away
		 * and keeps its trigger label in step. Deferred and dependency-free —
		 * the bar is a plain GET form and works without it.
		 */
		if ( is_readable( PLUGIN_DIR . self::SHOWCASE_SCRIPT ) ) {
			$script_modified = filemtime( PLUGIN_DIR . self::SHOWCASE_SCRIPT );

			wp_register_script(
				self::SHOWCASE_HANDLE,
				PLUGIN_URL . self::SHOWCASE_SCRIPT,
				array(),
				$script_modified ? (string) $script_modified : VERSION,
				true
			);
		}
	}

	/**
	 * Pull the showcase stylesheet onto the current page.
	 */
	public static function enqueue_showcase(): void {
		self::register_app();
		self::register_showcase();

		if ( wp_style_is( self::SHOWCASE_HANDLE, 'registered' ) ) {
			wp_enqueue_style( self::SHOWCASE_HANDLE );
		}

		if ( wp_script_is( self::SHOWCASE_HANDLE, 'registered' ) ) {
			wp_enqueue_script( self::SHOWCASE_HANDLE );
		}
	}

	/**
	 * Reads the dependency manifest emitted by wp-scripts.
	 *
	 * @return array{dependencies: string[], version: string}|null
	 */
	private static function asset_manifest(): ?array {
		$manifest = PLUGIN_DIR . self::BUILD_PATH . 'index.asset.php';

		if ( ! is_readable( $manifest ) ) {
			return null;
		}

		$asset = require $manifest;

		if ( ! is_array( $asset ) || ! isset( $asset['dependencies'], $asset['version'] ) ) {
			return null;
		}

		return array(
			'dependencies' => (array) $asset['dependencies'],
			'version'      => (string) $asset['version'],
		);
	}
}
