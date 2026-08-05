<?php
/**
 * Public-facing asset registration.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Site;

use BookingSuite\Backend\PostTypes\ApartmentPostType;

use const BookingSuite\PLUGIN_DIR;
use const BookingSuite\PLUGIN_URL;

defined( 'ABSPATH' ) || exit;

final class Assets {

	public const HANDLE = 'booking-suite-site';

	/** Path of the built bundle, relative to the plugin directory. */
	private const BUILD_PATH = 'frontend/site/app/build/';

	/** Global the guest app reads its bootstrap data from. */
	private const DATA_OBJECT = 'bookingSuiteSite';

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', array( self::class, 'on_enqueue_scripts' ) );
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

		if ( self::current_page_uses_shortcode() ) {
			self::enqueue_app();
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
			foreach ( array( Shortcodes::APARTMENTS, Shortcodes::BOOK_NOW ) as $shortcode ) {
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

		wp_localize_script(
			self::HANDLE,
			self::DATA_OBJECT,
			array(
				'restUrl' => esc_url_raw( rest_url( 'booking-suite/v1/' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
				'locale'  => determine_locale(),
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
