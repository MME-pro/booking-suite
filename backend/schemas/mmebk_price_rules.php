<?php
/**
 * Schema: price rules.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class PriceRulesTable {

	public const NAME = 'price_rules';

	/** Billing models a rule can price. */
	public const TYPES = array( 'hourly', 'overnight' );

	/** How the rule treats public holidays. */
	public const HOLIDAY_RULES = array( 'ignore', 'include', 'exclude' );

	/** Where the rule may be applied from. */
	public const VISIBILITIES = array( 'public', 'internal' );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `weekdays` is a comma-separated list of ISO-8601 day numbers
		// (1 = Monday … 7 = Sunday); an empty value means every day.
		// `package_prices` holds a JSON object of tier => price.
		// `type`, `holiday_rule` and `visibility` are constrained to the
		// constants above in application code rather than by an ENUM, so the
		// sets can grow without a schema migration.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			room_id bigint(20) unsigned NOT NULL,
			name varchar(191) NOT NULL default '',
			type varchar(20) NOT NULL default 'overnight',
			weekdays varchar(20) NOT NULL default '',
			holiday_rule varchar(20) NOT NULL default 'ignore',
			package_prices longtext NULL,
			surcharge_guest decimal(10,2) NOT NULL default 0.00,
			surcharge_hour decimal(10,2) NOT NULL default 0.00,
			visibility varchar(20) NOT NULL default 'public',
			active tinyint(1) unsigned NOT NULL default 1,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY room_type (room_id,type),
			KEY active_visibility (active,visibility)
		) $collate;";
	}
}
