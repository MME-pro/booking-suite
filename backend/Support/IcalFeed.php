<?php
/**
 * The public URL an apartment's calendar is published at.
 *
 *   https://example.com/booking-suite/calendar/<token>.ics
 *
 * Airbnb and Booking.com fetch this with no cookie, no login and no ability to
 * be prompted for one, so the token in the path IS the credential — the same
 * arrangement the portals use for the links they hand out. It is minted per
 * apartment, only when the operator asks for the link, and can be replaced to
 * revoke a URL that has been shared too widely.
 *
 * The address ends in `.ics` because a portal that will only accept a calendar
 * URL often decides by looking at the extension, and because a link a person
 * clicks should land as a file rather than a wall of text. Both wants are met
 * by the same rewrite.
 *
 * A plain-permalinks site has no rewrite rules to add to, and some hosts strip
 * unknown paths before WordPress sees them, so the query-string form
 * `?bks_ical=<token>` is handled too and is what the admin screen falls back to
 * showing. It is the identical response — only the address differs.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\ApartmentsRepository;

defined( 'ABSPATH' ) || exit;

final class IcalFeed {

	/** The query variable the rewrite resolves to, and the fallback's name. */
	public const QUERY_VAR = 'bks_ical';

	/** Path segment the pretty URL lives under. */
	public const PATH = 'booking-suite/calendar';

	/**
	 * Bumped whenever the rewrite rule below changes, so existing installs
	 * flush once and only once instead of on every admin request.
	 */
	private const RULES_VERSION = 1;

	private const RULES_OPTION = 'bksuite_ical_rules';

	public static function register(): void {
		add_action( 'init', array( self::class, 'add_rewrite' ) );
		add_filter( 'query_vars', array( self::class, 'add_query_var' ) );

		/*
		 * parse_request rather than template_redirect: this response is a file,
		 * not a page, and there is no reason to let WordPress resolve a query,
		 * pick a template or load a theme on the way to producing it.
		 */
		add_action( 'parse_request', array( self::class, 'maybe_serve' ) );

		add_action( 'admin_init', array( self::class, 'maybe_flush' ) );
	}

	public static function add_rewrite(): void {
		add_rewrite_rule(
			'^' . self::PATH . '/([a-f0-9]{32})\.ics$',
			'index.php?' . self::QUERY_VAR . '=$matches[1]',
			'top'
		);
	}

	/**
	 * @param string[] $vars
	 *
	 * @return string[]
	 */
	public static function add_query_var( array $vars ): array {
		$vars[] = self::QUERY_VAR;

		return $vars;
	}

	/**
	 * Teach an existing install the rule without a deactivate/activate.
	 */
	public static function maybe_flush(): void {
		if ( (int) get_option( self::RULES_OPTION, 0 ) === self::RULES_VERSION ) {
			return;
		}

		self::add_rewrite();
		flush_rewrite_rules( false );

		update_option( self::RULES_OPTION, self::RULES_VERSION, false );
	}

	/**
	 * The public URL for an apartment, minting its token on first use.
	 */
	public static function url( int $apartment_id ): string {
		return self::url_from_token( ApartmentsRepository::ensure_token( $apartment_id ) );
	}

	/**
	 * The URL a token resolves to.
	 *
	 * Split from url() so a screen can list the links it already has without
	 * minting one for every apartment it merely displays.
	 */
	public static function url_from_token( string $token ): string {
		if ( '' === $token ) {
			return '';
		}

		// Without pretty permalinks there is no rule to match, so the honest
		// URL is the one that actually works.
		if ( ! get_option( 'permalink_structure' ) ) {
			return self::fallback_from_token( $token );
		}

		return home_url( self::PATH . '/' . $token . '.ics' );
	}

	/**
	 * The always-works form, offered alongside the pretty one when a portal
	 * refuses the latter — usually a host that never let the path through.
	 */
	public static function fallback_from_token( string $token ): string {
		if ( '' === $token ) {
			return '';
		}

		return add_query_arg( self::QUERY_VAR, $token, home_url( '/' ) );
	}

	/**
	 * Serve the calendar when the request is for one. Never returns if it is.
	 *
	 * @param \WP $wp The request, after parsing.
	 */
	public static function maybe_serve( $wp ): void {
		$token = (string) ( $wp->query_vars[ self::QUERY_VAR ] ?? '' );

		// The rewrite is not the only way in — a plain-permalinks site passes
		// the token as an ordinary query argument.
		if ( '' === $token && isset( $_GET[ self::QUERY_VAR ] ) ) {
			$token = sanitize_text_field( wp_unslash( $_GET[ self::QUERY_VAR ] ) );
		}

		if ( '' === $token ) {
			return;
		}

		$apartment_id = ApartmentsRepository::find_by_token( $token );

		if ( null === $apartment_id ) {
			/*
			 * 404, not 403. A wrong token is indistinguishable from a URL that
			 * never existed, and saying "that token is wrong" would confirm to
			 * anyone guessing that the right one gets a different answer.
			 */
			self::not_found();
		}

		$document = IcalExporter::build( $apartment_id );

		if ( null === $document ) {
			self::not_found();
		}

		self::send( $document, $apartment_id );
	}

	/**
	 * Emit the file and stop.
	 */
	private static function send( string $document, int $apartment_id ): void {
		// Anything a plugin or theme has already printed would corrupt the
		// file; a stray blank line before <?php is the usual culprit.
		if ( ob_get_length() ) {
			ob_end_clean();
		}

		nocache_headers();

		header( 'Content-Type: text/calendar; charset=utf-8' );
		header( 'Content-Length: ' . strlen( $document ) );
		header( 'X-Content-Type-Options: nosniff' );

		/*
		 * `attachment` so a person clicking the link gets a saved file rather
		 * than a page of text. Portals fetch with an HTTP client and ignore the
		 * header entirely, so this costs them nothing.
		 */
		header(
			'Content-Disposition: attachment; filename="' . self::filename( $apartment_id ) . '"'
		);

		/*
		 * A public calendar with a secret in its URL should not be cached by
		 * anything between here and the reader, and should not be indexed.
		 */
		header( 'X-Robots-Tag: noindex, nofollow' );

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $document;

		exit;
	}

	/**
	 * A filename a human can recognise in a downloads folder.
	 */
	private static function filename( int $apartment_id ): string {
		$slug = sanitize_title( (string) get_the_title( $apartment_id ) );

		if ( '' === $slug ) {
			$slug = 'apartment-' . $apartment_id;
		}

		return $slug . '.ics';
	}

	private static function not_found(): void {
		status_header( 404 );
		nocache_headers();
		header( 'Content-Type: text/plain; charset=utf-8' );

		echo esc_html__( 'Calendar not found.', 'booking-suite' );

		exit;
	}
}
