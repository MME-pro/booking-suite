<?php
/**
 * The public URL an apartment's calendar is published at.
 *
 *   https://example.com/booking-suite/calendar/<token>.ics
 *   https://example.com/booking-suite/calendar/<token>-airbnb.ics
 *
 * The suffix is the scope — which locks the file carries, see IcalExporter.
 * It is optional, so the bare address keeps serving the full feed it always
 * served and a link already lodged with a portal does not have to be replaced.
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
use BookingSuite\Backend\Repositories\IcalFeedsRepository;

defined( 'ABSPATH' ) || exit;

final class IcalFeed {

	/** The query variable the rewrite resolves to, and the fallback's name. */
	public const QUERY_VAR = 'bks_ical';

	/**
	 * The scope's query variable.
	 *
	 * Carried in the path rather than the query string on a pretty URL — as a
	 * suffix on the token, so the address still ends in `.ics` — because a
	 * portal that decides what a link is by looking at its extension will not
	 * be talked out of it by an argument, and some will drop query strings
	 * from a subscription URL outright.
	 */
	public const QUERY_VAR_SCOPE = 'bks_ical_scope';

	/** Path segment the pretty URL lives under. */
	public const PATH = 'booking-suite/calendar';

	/**
	 * Bumped whenever the rewrite rule below changes, so existing installs
	 * flush once and only once instead of on every admin request.
	 *
	 * 2: the optional `-<scope>` suffix on the token.
	 */
	private const RULES_VERSION = 3;

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
		/*
		 * The suffix is optional, so the bare token URL that was handed to
		 * portals before scopes existed still matches and still serves the
		 * full feed. `[a-z]+` rather than the scope names themselves keeps the
		 * rule stable when a source is added; an unknown suffix is decided in
		 * PHP, where it falls back to the full feed.
		 */
		add_rewrite_rule(
			'^' . self::PATH . '/([a-f0-9]{32})(?:-([a-z]+))?\.ics$',
			'index.php?' . self::QUERY_VAR . '=$matches[1]&' . self::QUERY_VAR_SCOPE . '=$matches[2]',
			'top'
		);

		/*
		 * The form we hand out now, with the scope in front of the token.
		 *
		 * Three links that differ only in their last eight characters, after
		 * thirty-two of hex, are three links an operator cannot tell apart —
		 * and pasting the wrong one into a portal is silent, because every one
		 * of them serves a valid calendar. Leading with the scope puts the
		 * difference where it is read first.
		 *
		 * The two rules cannot collide: this one needs 32 hex digits *after*
		 * the dash, the one above needs them before it.
		 */
		add_rewrite_rule(
			'^' . self::PATH . '/([a-z]+)-([a-f0-9]{32})\.ics$',
			'index.php?' . self::QUERY_VAR . '=$matches[2]&' . self::QUERY_VAR_SCOPE . '=$matches[1]',
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
		$vars[] = self::QUERY_VAR_SCOPE;

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
	public static function url( int $apartment_id, string $scope = IcalExporter::SCOPE_ALL ): string {
		return self::url_from_token( ApartmentsRepository::ensure_token( $apartment_id ), $scope );
	}

	/**
	 * The URL a token resolves to.
	 *
	 * Split from url() so a screen can list the links it already has without
	 * minting one for every apartment it merely displays.
	 *
	 * Every scope rides on the one token. A scope is not a secret — which
	 * dates a portal is shown is the operator's arrangement, not something the
	 * portal is kept in the dark about — so a second token per scope would be
	 * three things to revoke where one will do.
	 */
	public static function url_from_token( string $token, string $scope = IcalExporter::SCOPE_ALL ): string {
		if ( '' === $token ) {
			return '';
		}

		// Without pretty permalinks there is no rule to match, so the honest
		// URL is the one that actually works.
		if ( ! get_option( 'permalink_structure' ) ) {
			return self::fallback_from_token( $token, $scope );
		}

		// The all-channels feed keeps the bare token: it is the address that
		// was handed to portals before scopes existed, and it still means the
		// same thing.
		$prefix = IcalExporter::SCOPE_ALL === $scope ? '' : $scope . '-';

		return home_url( self::PATH . '/' . $prefix . $token . '.ics' );
	}

	/**
	 * The always-works form, offered alongside the pretty one when a portal
	 * refuses the latter — usually a host that never let the path through.
	 */
	public static function fallback_from_token( string $token, string $scope = IcalExporter::SCOPE_ALL ): string {
		if ( '' === $token ) {
			return '';
		}

		$url = add_query_arg( self::QUERY_VAR, $token, home_url( '/' ) );

		if ( IcalExporter::SCOPE_ALL === $scope ) {
			return $url;
		}

		return add_query_arg( self::QUERY_VAR_SCOPE, $scope, $url );
	}

	/**
	 * Every feed an apartment can publish, as the admin screen shows them.
	 *
	 * Read, never mint: an apartment with no token yet gets empty addresses
	 * and nothing is published on its behalf, exactly as the single link
	 * behaved before there were three of them.
	 *
	 * `available` is what the operator's rule comes down to — a feed *for*
	 * Airbnb only means anything once Airbnb's own calendar is subscribed to,
	 * because until then it carries the same dates the full feed does and the
	 * choice between them is a distinction without a difference. The scope is
	 * still listed, so the screen can say why it is not offered yet rather
	 * than silently omitting it.
	 *
	 * @param int    $apartment_id The apartment.
	 * @param string $token        Its token, or '' when unpublished.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function exports( int $apartment_id, string $token ): array {
		$subscribed = array();

		foreach ( IcalFeedsRepository::for_apartment( $apartment_id ) as $feed ) {
			$source = (string) ( $feed['source'] ?? '' );

			$subscribed[ $source ] = ( $subscribed[ $source ] ?? 0 ) + 1;
		}

		$exports = array();

		foreach ( IcalExporter::scopes() as $scope ) {
			$is_portal = ! in_array(
				$scope,
				array( IcalExporter::SCOPE_ALL, IcalExporter::SCOPE_SUITE ),
				true
			);

			/*
			 * A portal gets a feed of its own only if this apartment reads
			 * that portal's calendar.
			 *
			 * The scoped feed exists for one reason: to withhold from a portal
			 * the dates it gave us. A lock re-exported to its own source can
			 * bounce between the two calendars, gaining a fresh UID on every
			 * lap, and neither side can tell the copies apart afterwards.
			 *
			 * A portal we do not import from has contributed nothing, so there
			 * is nothing to withhold and its scoped feed would be byte for byte
			 * the all-channels one. Listing seven identical links under seven
			 * portal names would not be seven choices; the all-channels feed is
			 * the link for every portal that has no row of its own.
			 */
			$is_source = isset( $subscribed[ $scope ] );

			$exports[] = array(
				'scope'       => $scope,
				'label'       => IcalExporter::scope_label( $scope ),
				'url'         => self::url_from_token( $token, $scope ),
				'fallbackUrl' => self::fallback_from_token( $token, $scope ),
				'available'   => ! $is_portal || $is_source,
				'feedCount'   => (int) ( $subscribed[ $scope ] ?? 0 ),
				/*
				 * What this particular feed would carry beyond this site's own
				 * bookings, so the screen can say "carries Airbnb" rather than
				 * leaving the operator to work out what the scope means.
				 */
				'carries'     => IcalExporter::SCOPE_SUITE === $scope
					? array()
					: array_values(
						array_filter(
							array_keys( $subscribed ),
							static fn( string $source ): bool => $source !== $scope
						)
					),
			);
		}

		return $exports;
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

		$scope = (string) ( $wp->query_vars[ self::QUERY_VAR_SCOPE ] ?? '' );

		if ( '' === $scope && isset( $_GET[ self::QUERY_VAR_SCOPE ] ) ) {
			$scope = sanitize_key( wp_unslash( $_GET[ self::QUERY_VAR_SCOPE ] ) );
		}

		if ( '' === $scope ) {
			$scope = IcalExporter::SCOPE_ALL;
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

		$document = IcalExporter::build( $apartment_id, $scope );

		if ( null === $document ) {
			self::not_found();
		}

		self::send( $document, $apartment_id, $scope );
	}

	/**
	 * Emit the file and stop.
	 */
	private static function send( string $document, int $apartment_id, string $scope ): void {
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
			'Content-Disposition: attachment; filename="' . self::filename( $apartment_id, $scope ) . '"'
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
	 *
	 * The scope is part of it, so an operator who saves all three does not end
	 * up with `rheinblick.ics`, `rheinblick (1).ics` and no way to tell which
	 * of them is the one for Airbnb.
	 */
	private static function filename( int $apartment_id, string $scope ): string {
		$slug = sanitize_title( (string) get_the_title( $apartment_id ) );

		if ( '' === $slug ) {
			$slug = 'apartment-' . $apartment_id;
		}

		if ( IcalExporter::SCOPE_ALL !== $scope && IcalExporter::is_scope( $scope ) ) {
			$slug .= '-' . $scope;
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
