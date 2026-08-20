<?php
/**
 * Lets the admin be installed to a phone's home screen.
 *
 * The brief asks for an app-like feel — its own icon, opened full screen — and
 * that is three small things rather than one big one: a web app manifest saying
 * what the app is called and what it looks like, a set of icons in the shapes
 * each platform wants, and a service worker, which is the price Chrome charges
 * for offering to install anything at all.
 *
 * Both endpoints are served from the site root as query arguments rather than
 * as files or rewrites. That is deliberate on two counts. A manifest fetched
 * from `/` gets a default scope of `/`, which is what lets `start_url` point
 * into `/wp-admin/`; and neither endpoint needs a rewrite rule, so nothing has
 * to be flushed and nothing breaks on a site running plain permalinks.
 *
 * The service worker is the part worth being careful about. Its scope is pinned
 * to `/wp-admin/` — never the whole site — and it does not cache. A worker with
 * site-wide scope on a property that takes bookings could serve a stale
 * availability page to a guest, and a caching worker in wp-admin could serve a
 * stale nonce, which fails every write with no explanation. Passing every
 * request straight through satisfies Chrome's installability rules and can do
 * neither of those things.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Frontend\Admin\Menu;

use const BookingSuite\PLUGIN_URL;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class Pwa {

	/** Query argument that serves the manifest. */
	public const MANIFEST_VAR = 'bks_manifest';

	/** Query argument that serves the service worker script. */
	public const WORKER_VAR = 'bks_sw';

	/** Where the rasterised icons live, relative to the plugin. */
	private const ICONS = 'frontend/admin/assets/icons/';

	public static function register(): void {
		add_filter( 'query_vars', array( self::class, 'add_query_vars' ) );
		add_action( 'parse_request', array( self::class, 'maybe_serve' ) );
		add_action( 'admin_head', array( self::class, 'head_tags' ) );
	}

	/**
	 * @param string[] $vars
	 *
	 * @return string[]
	 */
	public static function add_query_vars( array $vars ): array {
		$vars[] = self::MANIFEST_VAR;
		$vars[] = self::WORKER_VAR;

		return $vars;
	}

	public static function manifest_url(): string {
		return add_query_arg( self::MANIFEST_VAR, VERSION, home_url( '/' ) );
	}

	public static function worker_url(): string {
		return add_query_arg( self::WORKER_VAR, VERSION, home_url( '/' ) );
	}

	public static function icon_url( string $file ): string {
		return PLUGIN_URL . self::ICONS . $file;
	}

	/**
	 * The colour of the title bar in the installed app.
	 *
	 * Follows the accent colour the operator picked in Settings, so an installed
	 * app matches the admin it was installed from. The repository already
	 * sanitises the value and falls back when it is unset or malformed, so there
	 * is nothing to re-check here.
	 */
	private static function theme_colour(): string {
		return SettingsRepository::accent_colour();
	}

	/**
	 * Announce the app on Booking Suite screens only.
	 *
	 * Not site-wide, and not on the rest of wp-admin: installing from the Posts
	 * screen would produce an app that opens on the Posts screen. The manifest
	 * is only offered where the thing being installed is this plugin.
	 */
	public static function head_tags(): void {
		if ( ! self::is_plugin_screen() ) {
			return;
		}

		$colour = self::theme_colour();

		printf(
			'<link rel="manifest" href="%s">' . "\n",
			esc_url( self::manifest_url() )
		);

		printf(
			'<meta name="theme-color" content="%s">' . "\n",
			esc_attr( $colour )
		);

		/*
		 * iOS ignores the manifest entirely: it takes the icon, the title and
		 * the standalone behaviour from these meta tags instead, which is why
		 * they are here rather than only in the manifest.
		 */
		printf(
			'<link rel="apple-touch-icon" href="%s">' . "\n",
			esc_url( self::icon_url( 'apple-touch-icon.png' ) )
		);

		echo '<meta name="mobile-web-app-capable" content="yes">' . "\n";
		echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
		echo '<meta name="apple-mobile-web-app-status-bar-style" content="default">' . "\n";

		printf(
			'<meta name="apple-mobile-web-app-title" content="%s">' . "\n",
			esc_attr__( 'Booking Suite', 'booking-suite' )
		);
	}

	private static function is_plugin_screen(): bool {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		return '' !== $page && isset( Menu::pages()[ $page ] );
	}

	/**
	 * Serve the manifest or the worker when the request is for one.
	 *
	 * @param \WP $wp The parsed request.
	 */
	public static function maybe_serve( $wp ): void {
		$wants = static function ( string $var ) use ( $wp ): bool {
			return isset( $wp->query_vars[ $var ] ) || isset( $_GET[ $var ] );
		};

		if ( $wants( self::MANIFEST_VAR ) ) {
			self::send_manifest();
		}

		if ( $wants( self::WORKER_VAR ) ) {
			self::send_worker();
		}
	}

	private static function send_manifest(): void {
		$colour = self::theme_colour();
		$start  = admin_url( 'admin.php?page=' . Menu::SLUG_DASHBOARD );

		$manifest = array(
			'name'             => __( 'Booking Suite', 'booking-suite' ),
			'short_name'       => __( 'Bookings', 'booking-suite' ),
			'description'      => __(
				'Manage bookings, availability and payments.',
				'booking-suite'
			),
			'start_url'        => $start,
			/*
			 * Scoped to wp-admin. Anything outside it — the public site, a
			 * payment provider — opens in the normal browser instead of being
			 * trapped inside the app with no address bar.
			 */
			'scope'            => wp_parse_url( admin_url(), PHP_URL_PATH ),
			'display'          => 'standalone',
			'orientation'      => 'any',
			'background_color' => '#ffffff',
			'theme_color'      => $colour,
			'lang'             => str_replace( '_', '-', get_user_locale() ),
			'dir'              => is_rtl() ? 'rtl' : 'ltr',
			'icons'            => array(
				array(
					'src'     => self::icon_url( 'icon-192.png' ),
					'sizes'   => '192x192',
					'type'    => 'image/png',
					'purpose' => 'any',
				),
				array(
					'src'     => self::icon_url( 'icon-512.png' ),
					'sizes'   => '512x512',
					'type'    => 'image/png',
					'purpose' => 'any',
				),
				array(
					'src'     => self::icon_url( 'icon-maskable-512.png' ),
					'sizes'   => '512x512',
					'type'    => 'image/png',
					'purpose' => 'maskable',
				),
			),
			// The long-press menu on an installed icon.
			'shortcuts'        => array(
				array(
					'name' => __( 'Bookings', 'booking-suite' ),
					'url'  => admin_url( 'admin.php?page=' . Menu::SLUG_BOOKINGS ),
				),
				array(
					'name' => __( 'Calendar', 'booking-suite' ),
					'url'  => admin_url( 'admin.php?page=' . Menu::SLUG_CALENDAR ),
				),
				array(
					'name' => __( 'Availability', 'booking-suite' ),
					'url'  => admin_url( 'admin.php?page=' . Menu::SLUG_AVAILABILITY ),
				),
			),
		);

		if ( ob_get_length() ) {
			ob_end_clean();
		}

		header( 'Content-Type: application/manifest+json; charset=utf-8' );
		header( 'Cache-Control: public, max-age=86400' );

		echo wp_json_encode( $manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		exit;
	}

	/**
	 * The smallest worker that counts as one.
	 *
	 * Chrome will not offer to install a site unless a service worker with a
	 * fetch handler controls the start URL. This is that and nothing more: every
	 * request is passed to the network untouched. There is no cache to go stale,
	 * no offline copy of a screen whose data has moved on, and no chance of
	 * replaying a nonce that has since expired.
	 */
	private static function send_worker(): void {
		if ( ob_get_length() ) {
			ob_end_clean();
		}

		header( 'Content-Type: text/javascript; charset=utf-8' );

		/*
		 * A worker may normally only control paths at or below its own URL.
		 * This one is served from the site root but must control /wp-admin/,
		 * and this header is what permits the wider registration.
		 */
		header( 'Service-Worker-Allowed: ' . wp_parse_url( admin_url(), PHP_URL_PATH ) );
		header( 'Cache-Control: no-cache' );

		// phpcs:disable
		echo <<<'JS'
/**
 * Booking Suite admin — installability only.
 *
 * Deliberately does not cache. The admin is a live view of a database; a cached
 * copy would show availability that has since changed, or replay a nonce that
 * has since expired and fail every save with no explanation.
 */
self.addEventListener( 'install', () => self.skipWaiting() );

self.addEventListener( 'activate', ( event ) =>
	event.waitUntil( self.clients.claim() )
);

self.addEventListener( 'fetch', ( event ) => {
	// Straight to the network. The handler exists so the browser counts this
	// as a real worker; it deliberately changes nothing about the response.
	event.respondWith( fetch( event.request ) );
} );
JS;
		// phpcs:enable

		exit;
	}
}
