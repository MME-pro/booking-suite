<?php
/**
 * REST route behind the dashboard's System Status widget.
 *
 * GET /booking-suite/v1/system-status
 *
 * Everything reported here is measured, not assumed: the tables are looked up
 * in the database, and the mail state is read from the templates and from what
 * WordPress can actually do.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Installer;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use WP_REST_Response;
use WP_REST_Server;

use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class SystemController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'system-status';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'index' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	public static function index(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'database' => self::database(),
				'email'    => self::email(),
				'plugin'   => array( 'version' => VERSION ),
			),
			200
		);
	}

	/**
	 * Whether every table the plugin expects is actually present, and whether
	 * the stored schema version matches the shipped one.
	 *
	 * @return array<string, mixed>
	 */
	private static function database(): array {
		global $wpdb;

		$missing = array();

		foreach ( Installer::table_classes() as $class ) {
			$table = $class::table();

			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
				$missing[] = $table;
			}
		}

		$stored = (int) get_option( 'bksuite_db_version', 0 );

		return array(
			'ok'              => empty( $missing ) && $stored === Installer::DB_VERSION,
			'missing'         => $missing,
			'tables'          => count( Installer::table_classes() ),
			'schemaVersion'   => $stored,
			'expectedVersion' => Installer::DB_VERSION,
		);
	}

	/**
	 * The state of guest email.
	 *
	 * `canSend` reports whether anything has taken over wp_mail — an SMTP
	 * plugin — because the stock PHP mailer is the usual reason mail silently
	 * disappears on a live host. It is a hint, not a delivery guarantee: only
	 * an actual send proves that, which is what the test button on the Email
	 * Templates screen is for.
	 *
	 * @return array<string, mixed>
	 */
	private static function email(): array {
		$templates = EmailTemplatesRepository::all();

		$enabled = array_filter(
			$templates,
			static fn( array $template ): bool => (bool) $template['enabled']
		);

		$has_smtp = has_filter( 'phpmailer_init' ) || function_exists( 'wp_mail_smtp' );

		return array(
			'ok'         => count( $enabled ) > 0,
			'enabled'    => count( $enabled ),
			'total'      => count( $templates ),
			'smtp'       => (bool) $has_smtp,
			'canSend'    => function_exists( 'wp_mail' ),
			'templates'  => array_values(
				array_map(
					static fn( array $template ): array => array(
						'key'     => $template['key'],
						'label'   => $template['label'],
						'enabled' => (bool) $template['enabled'],
					),
					$templates
				)
			),
		);
	}
}
