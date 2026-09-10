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
	public const DB_VERSION = 14;

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

		self::backfill_short_links();
		self::backfill_booking_types();

		/*
		 * The rewrite rules, too.
		 *
		 * An update installed through Updater never fires the activation hook,
		 * so a release that adds a rule — the guest's payment page did — would
		 * leave that URL answering 404 on every site that updated rather than
		 * reinstalled. And the payment page's URL goes out in email, where a
		 * dead link cannot be corrected afterwards.
		 *
		 * `false`, so the rules are recomputed and stored without touching the
		 * server config. This runs only when the schema version moves, which is
		 * exactly as often as it should.
		 */
		self::register_rewrites();
		flush_rewrite_rules( false );

		update_option( self::VERSION_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Give every published apartment its internal short link.
	 *
	 * New apartments get one when they are published. Every apartment that
	 * already existed has an empty field, because until now the only way to
	 * fill it was to type one — so without this the column an owner is about
	 * to be shown would be blank for their whole property until they went
	 * through and edited each one.
	 *
	 * Only fills blanks, so a link somebody chose by hand is left alone, and
	 * running it twice does nothing the second time.
	 */
	private static function backfill_short_links(): void {
		global $wpdb;

		require_once PLUGIN_DIR . 'backend/schemas/mmebk_apartments.php';

		$table = Schemas\ApartmentsTable::table();

		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return;
		}

		$ids = $wpdb->get_col(
			"SELECT post_id FROM $table
				WHERE internal_short_link IS NULL OR internal_short_link = ''"
		) ?: array();

		foreach ( $ids as $post_id ) {
			$post = get_post( (int) $post_id );

			if ( $post instanceof \WP_Post && 'publish' === $post->post_status ) {
				Repositories\ApartmentsRepository::ensure_short_link( (int) $post_id );
			}
		}
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
	 * Give every booking made before this release its type.
	 *
	 * The column arrives defaulting to 'overnight', which is wrong for every
	 * hourly booking already taken — and the type decides the VAT on the
	 * invoice, so leaving it wrong would put the wrong rate on paperwork for
	 * bookings that have already happened.
	 *
	 * Worked out the same way BookingsTable::type_for() does it, in SQL so it
	 * is one statement rather than a loop over every row a busy property has:
	 * same calendar day out as in means hourly.
	 *
	 * Only touches rows whose type is still the untouched default AND whose
	 * dates say hourly, so it cannot overwrite a type somebody has since
	 * corrected by hand, and running it twice does nothing the second time.
	 */
	private static function backfill_booking_types(): void {
		global $wpdb;

		$bookings = Schemas\BookingsTable::table();

		// The column may not exist yet on an install that has not run dbDelta.
		$columns = $wpdb->get_col( "DESC $bookings" );

		if ( ! in_array( 'booking_type', $columns, true ) ) {
			return;
		}

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE $bookings
				SET booking_type = %s
				WHERE booking_type = %s
					AND DATE( starts_at ) = DATE( ends_at )",
				Schemas\BookingsTable::TYPE_HOURLY,
				Schemas\BookingsTable::TYPE_OVERNIGHT
			)
		);
	}

	/**
	 * Add every rule this plugin owns, so a flush has them all to write.
	 *
	 * Both are normally added on `init`. install() can run before that — from
	 * the activation hook — so they are added again here rather than trusting
	 * the ordering.
	 */
	private static function register_rewrites(): void {
		Support\IcalFeed::add_rewrite();
		Support\PaymentPage::add_rewrite();
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
