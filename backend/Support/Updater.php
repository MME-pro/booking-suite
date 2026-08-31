<?php
/**
 * Updates from GitHub releases.
 *
 * WordPress only knows how to update plugins it can find on wordpress.org.
 * This one is not there and never will be, so the two questions WordPress asks
 * about every plugin — "is there a newer version?" and "where do I download
 * it?" — are answered here instead, from the releases of the plugin's own
 * repository.
 *
 * The download is the release *asset*, never GitHub's generated source zip.
 * The admin app's compiled bundle is gitignored, so a source zip installs a
 * plugin with a working guest site and a blank admin screen. tools/release.php
 * builds and attaches the real archive; this class refuses anything else, on
 * the grounds that a broken update is worse than no update.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\SettingsRepository;

use const BookingSuite\PLUGIN_FILE;
use const BookingSuite\PREFIX;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class Updater {

	/** owner/name of the repository releases are read from. */
	public const REPOSITORY = 'MME-pro/booking-suite';

	/** Where the answer to "is there a newer version?" is kept. */
	private const CACHE_KEY = PREFIX . 'latest_release';

	/**
	 * How long that answer is trusted.
	 *
	 * Fifteen minutes, matched by the cron below, so a release reaches a site
	 * within a quarter hour of being published without either half of the pair
	 * doing useless work. Four calls an hour also sits far inside GitHub's
	 * unauthenticated rate limit of sixty.
	 */
	private const CACHE_TTL = 15 * MINUTE_IN_SECONDS;

	/** The recurrence and the event that drives the automatic check. */
	public const INTERVAL = 'bksuite_quarter_hourly';

	public const HOOK = PREFIX . 'check_for_updates';

	/** Settings key holding a token, for when the repository goes private. */
	public const TOKEN_KEY = 'github_token';

	public static function register(): void {
		add_filter( 'cron_schedules', array( self::class, 'add_interval' ) );
		add_action( self::HOOK, array( self::class, 'check_now' ) );
		add_action( 'admin_init', array( self::class, 'schedule' ) );

		// What WordPress asks when it builds its list of available updates.
		add_filter( 'pre_set_site_transient_update_plugins', array( self::class, 'offer_update' ) );

		// And what it asks when someone clicks "View details".
		add_filter( 'plugins_api', array( self::class, 'details' ), 10, 3 );

		/*
		 * A private repository's asset is not a public URL: it needs an
		 * Authorization header, which WordPress's own downloader does not
		 * send. Registered whether or not a token is set, so switching the
		 * repository to private is a matter of pasting one in rather than
		 * shipping a new version.
		 */
		add_filter( 'upgrader_pre_download', array( self::class, 'download_private' ), 10, 3 );

		// Clearing the cache the moment an update finishes stops the "update
		// available" notice surviving its own update.
		add_action( 'upgrader_process_complete', array( self::class, 'forget' ), 10, 0 );
	}

	/**
	 * @param array<string, array{interval: int, display: string}> $schedules
	 * @return array<string, array{interval: int, display: string}>
	 */
	public static function add_interval( array $schedules ): array {
		$schedules[ self::INTERVAL ] = array(
			'interval' => self::CACHE_TTL,
			'display'  => __( 'Every 15 minutes', 'booking-suite' ),
		);

		return $schedules;
	}

	/**
	 * Book the recurring check, re-booking it if the recurrence has changed.
	 *
	 * WP-Cron writes the interval in seconds onto the event when it is booked
	 * and never revisits it, so an install scheduled under an older, longer
	 * recurrence would keep it forever unless the mismatch is noticed here.
	 */
	public static function schedule(): void {
		$event = wp_get_scheduled_event( self::HOOK );

		if ( $event && self::INTERVAL === ( $event->schedule ?? '' ) ) {
			return;
		}

		if ( $event ) {
			wp_clear_scheduled_hook( self::HOOK );
		}

		wp_schedule_event( time() + self::CACHE_TTL, self::INTERVAL, self::HOOK );
	}

	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/**
	 * Ask GitHub now, and have WordPress rebuild its update list from it.
	 *
	 * Both halves matter. Refreshing our own cache alone would leave the
	 * update sitting unnoticed until WordPress next polled — twice a day by
	 * default, which is the whole reason this event exists.
	 */
	public static function check_now(): void {
		self::forget();

		if ( ! function_exists( 'wp_update_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/update.php';
		}

		wp_update_plugins();
	}

	public static function forget(): void {
		delete_site_transient( self::CACHE_KEY );
	}

	/**
	 * Tell WordPress whether a newer version exists, and where it lives.
	 *
	 * @param mixed $transient The update list being built.
	 * @return mixed The same, with this plugin added when it is behind.
	 */
	public static function offer_update( $transient ) {
		if ( ! is_object( $transient ) ) {
			return $transient;
		}

		$release = self::latest_release();

		if ( null === $release ) {
			return $transient;
		}

		$file = plugin_basename( PLUGIN_FILE );
		$slug = dirname( $file );

		$item = (object) array(
			'id'          => self::REPOSITORY,
			'slug'        => $slug,
			'plugin'      => $file,
			'new_version' => $release['version'],
			'url'         => $release['url'],
			'package'     => $release['package'],
			'tested'      => $release['tested'],
			'icons'       => array(),
			'banners'     => array(),
		);

		/*
		 * A site already on the newest version still belongs in `no_update`.
		 * WordPress reads that list to decide whether a plugin can be offered
		 * automatic updates at all; leaving it out shows "automatic updates
		 * are not available for this plugin" on an install that is simply up
		 * to date.
		 */
		if ( version_compare( $release['version'], VERSION, '>' ) ) {
			$transient->response[ $file ] = $item;

			unset( $transient->no_update[ $file ] );
		} else {
			$transient->no_update[ $file ] = $item;

			unset( $transient->response[ $file ] );
		}

		return $transient;
	}

	/**
	 * Fill the "View details" screen, which would otherwise 404 to wp.org.
	 *
	 * @param mixed                 $result The response so far.
	 * @param string                $action What was asked for.
	 * @param object                $args   Which plugin.
	 * @return mixed Our own answer, or whatever it was before.
	 */
	public static function details( $result, string $action, $args ) {
		if ( 'plugin_information' !== $action ) {
			return $result;
		}

		$slug = dirname( plugin_basename( PLUGIN_FILE ) );

		if ( ( $args->slug ?? '' ) !== $slug ) {
			return $result;
		}

		$release = self::latest_release();

		if ( null === $release ) {
			return $result;
		}

		return (object) array(
			'name'          => 'Booking Suite',
			'slug'          => $slug,
			'version'       => $release['version'],
			'author'        => '<a href="https://mme-pro.de/">MME-Pro</a>',
			'homepage'      => $release['url'],
			'download_link' => $release['package'],
			'trunk'         => $release['package'],
			'requires'      => '6.6',
			'requires_php'  => '8.1',
			'tested'        => $release['tested'],
			'last_updated'  => $release['published'],
			'sections'      => array(
				'description' => wp_kses_post( $release['notes'] ),
			),
		);
	}

	/**
	 * Fetch a private repository's asset, which needs a header WordPress omits.
	 *
	 * Returns false — "not handled" — whenever there is no token or the URL is
	 * not ours, which is every public-repository install.
	 *
	 * @param mixed  $reply   False unless another filter already handled it.
	 * @param string $package The URL being downloaded.
	 * @param object $upgrader The upgrader, for its error strings.
	 * @return mixed A local file path, a WP_Error, or $reply untouched.
	 */
	public static function download_private( $reply, string $package, $upgrader ) {
		$token = self::token();

		if ( false !== $reply || '' === $token || ! str_contains( $package, 'api.github.com' ) ) {
			return $reply;
		}

		$upgrader->skin->feedback( 'downloading_package', $package );

		$response = wp_remote_get(
			$package,
			array(
				'timeout'  => 60,
				'stream'   => true,
				'filename' => wp_tempnam( $package ),
				'headers'  => array(
					// This header is the whole point: without it GitHub
					// answers with the asset's JSON metadata, not its bytes.
					'Accept'        => 'application/octet-stream',
					'Authorization' => 'Bearer ' . $token,
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$file = $response['filename'] ?? '';

		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			if ( $file && file_exists( $file ) ) {
				unlink( $file );
			}

			return new \WP_Error(
				'bksuite_download_failed',
				sprintf(
					/* translators: %d: an HTTP status code. */
					__( 'The update could not be downloaded (HTTP %d). Check the GitHub token in Settings.', 'booking-suite' ),
					(int) wp_remote_retrieve_response_code( $response )
				)
			);
		}

		return $file;
	}

	/**
	 * The newest published release, or null if there is nothing usable.
	 *
	 * @return array{version: string, package: string, url: string, notes: string, published: string, tested: string}|null
	 */
	private static function latest_release(): ?array {
		$cached = get_site_transient( self::CACHE_KEY );

		if ( is_array( $cached ) ) {
			return $cached['version'] ?? null ? $cached : null;
		}

		$release = self::fetch_release();

		/*
		 * A failure is cached too, as an empty array. GitHub being unreachable
		 * must not mean asking again on every single admin page load, which is
		 * what an uncached miss would do.
		 */
		set_site_transient( self::CACHE_KEY, $release ?? array(), self::CACHE_TTL );

		return $release;
	}

	/**
	 * @return array{version: string, package: string, url: string, notes: string, published: string, tested: string}|null
	 */
	private static function fetch_release(): ?array {
		$headers = array(
			'Accept'     => 'application/vnd.github+json',
			'User-Agent' => 'BookingSuite/' . VERSION,
		);

		$token = self::token();

		if ( '' !== $token ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}

		$response = wp_remote_get(
			'https://api.github.com/repos/' . self::REPOSITORY . '/releases/latest',
			array(
				'timeout' => 15,
				'headers' => $headers,
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( ! is_array( $body ) || ! empty( $body['draft'] ) || ! empty( $body['prerelease'] ) ) {
			return null;
		}

		$version = ltrim( (string) ( $body['tag_name'] ?? '' ), 'vV' );
		$asset   = self::plugin_asset( $body['assets'] ?? array() );

		/*
		 * No asset means whoever published this release did not attach the
		 * built zip. GitHub's own source archive is not a substitute — it has
		 * no admin bundle in it — so this release is simply not offered.
		 */
		if ( '' === $version || null === $asset ) {
			return null;
		}

		return array(
			'version'   => $version,
			'package'   => $asset,
			'url'       => (string) ( $body['html_url'] ?? '' ),
			'notes'     => (string) ( $body['body'] ?? '' ),
			'published' => (string) ( $body['published_at'] ?? '' ),
			'tested'    => get_bloginfo( 'version' ),
		);
	}

	/**
	 * The built archive attached to a release.
	 *
	 * A private repository is downloaded through the API URL with a token; a
	 * public one through the plain browser URL, which needs no credentials at
	 * all. Choosing here rather than at download time keeps the decision in
	 * one place.
	 *
	 * @param array<int, array<string, mixed>> $assets The release's assets.
	 * @return string|null The URL to download, or null if none qualifies.
	 */
	private static function plugin_asset( array $assets ): ?string {
		foreach ( $assets as $asset ) {
			$name = (string) ( $asset['name'] ?? '' );

			if ( ! str_starts_with( $name, 'booking_suite' ) || ! str_ends_with( $name, '.zip' ) ) {
				continue;
			}

			return '' === self::token()
				? (string) ( $asset['browser_download_url'] ?? '' )
				: (string) ( $asset['url'] ?? '' );
		}

		return null;
	}

	/**
	 * The token used when the repository is private. Empty while it is public.
	 */
	private static function token(): string {
		if ( ! class_exists( SettingsRepository::class ) ) {
			return '';
		}

		return trim( (string) SettingsRepository::get( self::TOKEN_KEY, '' ) );
	}
}
