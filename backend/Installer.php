<?php
/**
 * Creates and upgrades the plugin's custom tables.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend;

use BookingSuite\Backend\Repositories\SettingsRepository;

use const BookingSuite\PLUGIN_DIR;

defined( 'ABSPATH' ) || exit;

final class Installer {

	/**
	 * Bump whenever any table definition changes.
	 */
	public const DB_VERSION = 8;

	private const VERSION_OPTION = 'bksuite_db_version';

	private const SCHEMA_NAMESPACE = __NAMESPACE__ . '\\Schemas\\';

	/**
	 * Run dbDelta over every schema in backend/schemas/. Idempotent.
	 */
	public static function install(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		// Before dbDelta, because dbDelta cannot fix what this fixes.
		self::repair_settings_table();

		foreach ( self::table_classes() as $class ) {
			dbDelta( $class::definition() );
		}

		update_option( self::VERSION_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Rebuild a settings table left over from an older plugin.
	 *
	 * Some installs carry a `mmebk_settings` whose primary key is `setting_key`
	 * and which has no unique key on (option_key, locale). dbDelta cannot mend
	 * that: it never drops a column and never changes a primary key, so it
	 * reports success and leaves the table exactly as it found it.
	 *
	 * The damage is quiet and total. SettingsRepository::set() writes with
	 * INSERT … ON DUPLICATE KEY UPDATE, which without that unique key matches on
	 * the untouched `setting_key` instead — always ''. Every setting in the
	 * install therefore collapses into a single row, and because the UPDATE
	 * branch rewrites only the value, the row keeps whichever `option_key` was
	 * written first. Saving an accent colour appears to work and silently
	 * overwrites the currency.
	 *
	 * So the table is rebuilt. The old one is renamed rather than dropped, and
	 * the values are carried across — including the legacy setting_key rows the
	 * current code never reads, which are the site's original settings.
	 */
	private static function repair_settings_table(): void {
		global $wpdb;

		require_once PLUGIN_DIR . 'backend/schemas/mmebk_settings.php';

		$table = Schemas\SettingsTable::table();

		// Nothing to repair on a fresh install; dbDelta builds it correctly.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return;
		}

		$indexes = $wpdb->get_results( "SHOW INDEX FROM `$table`", ARRAY_A ) ?: array();

		foreach ( $indexes as $index ) {
			if ( 'option_key_locale' === ( $index['Key_name'] ?? '' ) ) {
				return;
			}
		}

		$rows = $wpdb->get_results( "SELECT * FROM `$table`", ARRAY_A ) ?: array();

		// Legacy pairs first, so a value in the current columns wins where both
		// name the same setting.
		$kept = array();

		foreach ( $rows as $row ) {
			if ( '' !== ( $row['setting_key'] ?? '' ) && null !== ( $row['setting_value'] ?? null ) ) {
				$kept[ $row['setting_key'] ] = array(
					'group'  => $row['option_group'] ?? 'general',
					'value'  => (string) $row['setting_value'],
					'locale' => '',
				);
			}
		}

		foreach ( $rows as $row ) {
			/*
			 * The collapsed row is discarded rather than trusted. On a legacy
			 * table every genuine row carries a `setting_key`; the current code
			 * never writes that column, so a row with an empty one is the
			 * casualty of the bug above — one row wearing the `option_key` of
			 * the first setting ever saved and the value of the last. Keeping it
			 * would file the accent colour under `currency`.
			 */
			if ( array_key_exists( 'setting_key', $row ) && '' === $row['setting_key'] ) {
				continue;
			}

			if ( '' !== ( $row['option_key'] ?? '' ) && null !== ( $row['option_value'] ?? null ) ) {
				$kept[ $row['option_key'] ] = array(
					'group'  => $row['option_group'] ?? 'general',
					'value'  => (string) $row['option_value'],
					'locale' => (string) ( $row['locale'] ?? '' ),
				);
			}
		}

		// Renamed, not dropped: if anything below fails the values are still on
		// disk and can be read out by hand.
		$backup = $table . '_legacy';

		$wpdb->query( "DROP TABLE IF EXISTS `$backup`" );
		$wpdb->query( "RENAME TABLE `$table` TO `$backup`" );

		dbDelta( Schemas\SettingsTable::definition() );

		foreach ( $kept as $key => $setting ) {
			SettingsRepository::set( $key, $setting['value'], $setting['group'], $setting['locale'] );
		}
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
