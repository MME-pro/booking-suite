<?php
/**
 * The payment page, as a page.
 *
 * A guest who has just placed a booking sees the payment details in the modal
 * they were already in. But that is a tab they will close, on a device that may
 * not be the one their banking app is on — and the money is owed for the next
 * twenty-four hours. So the same details also live at a URL of their own, and
 * that URL goes out in the booking email.
 *
 * Public and login-free by design. The guest has no account here and never
 * will; the token in the URL is the whole credential, and it grants exactly two
 * things — reading this one booking's payment details, and saying the transfer
 * has been sent. See PaymentLink.
 *
 * Rendered as its own document rather than through the theme's page template.
 * There is no WordPress post behind it, so there is nothing for a template to
 * draw; and a page that opens from an email on a stranger's phone is better off
 * depending on as little of the theme as possible. `wp_head()` still runs, so
 * the site's fonts and colours come along.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Frontend\Site\Assets as SiteAssets;

defined( 'ABSPATH' ) || exit;

final class PaymentPage {

	/**
	 * The query variable the token arrives in.
	 *
	 * Also accepted as a plain query string, not only through the pretty
	 * rewrite: a link that has already gone out in an email must keep working
	 * even on an installation whose rewrite rules were never flushed, and email
	 * is exactly the place where a dead link cannot be fixed after the fact.
	 */
	public const QUERY_VAR = 'bks_pay';

	/** The path the pretty URL is built on. */
	public const PATH = 'booking/pay';

	public static function register(): void {
		add_action( 'init', array( self::class, 'add_rewrite' ) );
		add_filter( 'query_vars', array( self::class, 'add_query_var' ) );

		/*
		 * Early, and before the theme decides it has a 404 to draw. The URL
		 * matches no post, so left alone WordPress would answer with the
		 * theme's not-found page.
		 */
		add_action( 'template_redirect', array( self::class, 'maybe_render' ), 1 );
	}

	public static function add_rewrite(): void {
		add_rewrite_rule(
			'^' . self::PATH . '/([A-Za-z0-9.]+)/?$',
			'index.php?' . self::QUERY_VAR . '=$matches[1]',
			'top'
		);
	}

	/**
	 * @param string[] $vars Registered query variables.
	 * @return string[]
	 */
	public static function add_query_var( array $vars ): array {
		$vars[] = self::QUERY_VAR;

		return $vars;
	}

	/** The token on this request, or '' when this is some other page. */
	private static function token(): string {
		$token = get_query_var( self::QUERY_VAR );

		if ( '' === $token || null === $token ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$token = $_GET[ self::QUERY_VAR ] ?? '';
		}

		$token = is_string( $token ) ? trim( $token ) : '';

		// The shape PaymentLink mints, and nothing else gets as far as a page.
		return 1 === preg_match( '/^[0-9]+\.[0-9]+\.[a-f0-9]{64}$/', $token )
			? $token
			: '';
	}

	public static function maybe_render(): void {
		$token = self::token();

		if ( '' === $token ) {
			return;
		}

		/*
		 * Never cached and never indexed. The page is about one person's
		 * booking: a search engine has no business holding it, and a proxy
		 * serving a stale copy would show the guest a status that has moved on.
		 */
		nocache_headers();
		status_header( 200 );

		add_filter( 'wp_robots', 'wp_robots_no_robots' );

		SiteAssets::enqueue_app();

		self::render( $token );

		exit;
	}

	/**
	 * The document itself.
	 *
	 * @param string $token The payment token from the URL.
	 */
	private static function render( string $token ): void {
		$title = sprintf(
			/* translators: %s: the site name. */
			__( 'Complete your payment — %s', 'booking-suite' ),
			get_bloginfo( 'name' )
		);

		?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title><?php echo esc_html( $title ); ?></title>
	<?php wp_head(); ?>
</head>
<body class="bks-payment-page">
	<div class="bks-site-root bks-paypage">
		<header class="bks-paypage__header">
			<?php
			$home = home_url( '/' );
			$logo = SettingsRepository::logo_id();

			if ( $logo && 'attachment' === get_post_type( $logo ) ) {
				printf(
					'<a href="%1$s"><img src="%2$s" alt="%3$s" class="bks-paypage__logo" /></a>',
					esc_url( $home ),
					esc_url( (string) wp_get_attachment_image_url( $logo, 'medium' ) ),
					esc_attr( get_bloginfo( 'name' ) )
				);
			} else {
				printf(
					'<a href="%1$s" class="bks-paypage__name">%2$s</a>',
					esc_url( $home ),
					esc_html( get_bloginfo( 'name' ) )
				);
			}
			?>
		</header>

		<main class="bks-paypage__body">
			<?php
			/*
			 * The token goes in the markup rather than being read from the URL
			 * by the app: this is the one place that has already checked its
			 * shape, and a second parser is a second thing to get wrong.
			 */
			printf(
				'<div data-booking-suite-payment="%s"></div>',
				esc_attr( $token )
			);
			?>
		</main>
	</div>
	<?php wp_footer(); ?>
</body>
</html>
		<?php
	}
}
