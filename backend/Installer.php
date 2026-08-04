<?php
/**
 * Creates and upgrades the plugin's custom tables.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend;

use const BookingSuite\PLUGIN_DIR;

defined( 'ABSPATH' ) || exit;

final class Installer {

	/**
	 * Bump whenever any table definition changes.
	 */
	public const DB_VERSION = 6;

	private const VERSION_OPTION = 'bksuite_db_version';

	private const SCHEMA_NAMESPACE = __NAMESPACE__ . '\\Schemas\\';

	/**
	 * Run dbDelta over every schema in backend/schemas/. Idempotent.
	 */
	public static function install(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		foreach ( self::table_classes() as $class ) {
			dbDelta( $class::definition() );
		}

		update_option( self::VERSION_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Re-run install() when the stored schema version is behind, so updates
	 * shipped without a deactivate/activate cycle still get their tables.
	 */
	public static function maybe_upgrade(): void {
		if ( (int) get_option( self::VERSION_OPTION, 0 ) === self::DB_VERSION ) {
			return;
		}

		self::install();
	}

	/**
	 * Every table class under backend/schemas/.
	 *
	 * Schema files are named after their table (mmebk_rooms.php) rather than
	 * their class, so they are required explicitly instead of autoloaded.
	 *
	 * @return string[]
	 */
	public static function table_classes(): array {
		foreach ( glob( PLUGIN_DIR . 'backend/schemas/*.php' ) ?: array() as $file ) {
			require_once $file;
		}

		return array_values(
			array_filter(
				get_declared_classes(),
				static fn( string $class ): bool =>
					str_starts_with( $class, self::SCHEMA_NAMESPACE )
					&& method_exists( $class, 'definition' )
			)
		);
	}
}
