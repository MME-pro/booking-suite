<?php
/**
 * Admin asset registration.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Admin;

use BookingSuite\Backend\PostTypes\ApartmentPostType;

use const BookingSuite\PLUGIN_DIR;
use const BookingSuite\PLUGIN_URL;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

/**
 * Enqueues the compiled admin React bundle on Booking Suite screens only.
 */
final class Assets {

	public const HANDLE = 'booking-suite-admin';

	/** Path of the built bundle, relative to the plugin directory. */
	private const BUILD_PATH = 'frontend/admin/app/build/';

	/** Global the React app reads its bootstrap data from. */
	private const DATA_OBJECT = 'bookingSuiteAdmin';

	public static function register(): void {
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
	}

	public static function enqueue(): void {
		$view = self::current_view();

		if ( null === $view ) {
			return;
		}

		$asset = self::asset_manifest();

		if ( null === $asset ) {
			add_action( 'admin_notices', array( self::class, 'render_build_notice' ) );
			return;
		}

		// Gives the app wp.media for picking apartment photos.
		wp_enqueue_media();

		/*
		 * And wp.editor for the email templates, which are written in a rich
		 * text editor rather than as HTML. This is the same TinyMCE the block
		 * editor's classic block uses, so it arrives already knowing how to
		 * clean up pasted Word content — the usual way a template's markup
		 * gets ruined.
		 */
		wp_enqueue_editor();

		wp_enqueue_script(
			self::HANDLE,
			PLUGIN_URL . self::BUILD_PATH . 'index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		// wp-scripts names the stylesheet after the entry point, and emits a
		// mirrored index-rtl.css that wp_style_add_data() swaps in for RTL.
		if ( is_readable( PLUGIN_DIR . self::BUILD_PATH . 'index.css' ) ) {
			wp_enqueue_style(
				self::HANDLE,
				PLUGIN_URL . self::BUILD_PATH . 'index.css',
				array(),
				$asset['version']
			);

			wp_style_add_data( self::HANDLE, 'rtl', 'replace' );
		}

		wp_set_script_translations( self::HANDLE, 'booking-suite', PLUGIN_DIR . 'languages' );

		wp_localize_script(
			self::HANDLE,
			self::DATA_OBJECT,
			array(
				'view'       => $view,
				'version'    => VERSION,
				'adminUrl'   => admin_url(),
				'menuSlug'      => Menu::SLUG_DASHBOARD,
				/*
				 * Screen URLs are built here rather than in JavaScript, so the
				 * page slugs live in exactly one place. `action=new` is read by
				 * the destination screen to open its form straight away, which
				 * is what makes the dashboard's quick actions quick.
				 */
				'apartmentsUrl' => admin_url( 'admin.php?page=' . Menu::SLUG_APARTMENTS ),
				/*
				 * Straight to the post editor, not the React apartments form:
				 * apartments are posts, and that is where they are designed.
				 * It is also the only Apartments entry left in the menu, so
				 * "Add Apartment" lands where the rest of the flow lives.
				 */
				'newApartmentUrl' => admin_url( 'post-new.php?post_type=' . ApartmentPostType::POST_TYPE ),
				'bookingsUrl'   => admin_url( 'admin.php?page=' . Menu::SLUG_BOOKINGS ),
				'newBookingUrl' => admin_url( 'admin.php?page=' . Menu::SLUG_BOOKINGS . '&action=new' ),
				'calendarUrl'   => admin_url( 'admin.php?page=' . Menu::SLUG_CALENDAR ),
				'restUrl'    => esc_url_raw( rest_url( 'booking-suite/v1/' ) ),
				'nonce'      => wp_create_nonce( 'wp_rest' ),
				'locale'     => get_user_locale(),
				'assetsUrl'  => PLUGIN_URL . 'frontend/admin/app/build/',
			)
		);
	}

	/**
	 * Maps the current admin screen to a React view, or null when the screen
	 * does not belong to Booking Suite.
	 */
	private static function current_view(): ?string {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		if ( '' === $page ) {
			return null;
		}

		return Menu::pages()[ $page ] ?? null;
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

	/**
	 * Shown when the bundle has not been built yet — otherwise the page would
	 * simply render blank with no explanation.
	 */
	public static function render_build_notice(): void {
		printf(
			'<div class="notice notice-error"><p>%s</p><p><code>cd %s &amp;&amp; npm install &amp;&amp; npm run build</code></p></div>',
			esc_html__( 'Booking Suite: the admin interface has not been built yet.', 'booking-suite' ),
			esc_html( 'wp-content/plugins/booking_suite/frontend/admin/app' )
		);
	}
}
