<?php
/**
 * Schema: settings.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class SettingsTable {

	public const NAME = 'settings';

	/** Groups used to fetch a screen's settings in one query. */
	public const GROUPS = array( 'bank', 'tax', 'booking', 'general' );

	/** Locales the plugin ships translations for. */
	public const LOCALES = array( 'de', 'en' );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// A key/value store rather than one column per setting, so bank
		// details, tax rates and booking rules can grow without migrations.
		// `locale` is '' for values shared across languages (a tax rate) and
		// 'de'/'en' for translated ones (terms text); the UNIQUE key is on the
		// pair, so one key can hold a value per language.
		// KEY is reserved in SQL, hence `option_key`.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			option_group varchar(50) NOT NULL default 'general',
			option_key varchar(191) NOT NULL default '',
			option_value longtext NULL,
			locale varchar(5) NOT NULL default '',
			autoload tinyint(1) unsigned NOT NULL default 1,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY option_key_locale (option_key,locale),
			KEY group_autoload (option_group,autoload)
		) $collate;";
	}
}
