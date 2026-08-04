<?php
/**
 * Schema: rooms.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class RoomsTable {

	public const NAME = 'rooms';

	/**
	 * Allowed cleaning turnaround times, in minutes.
	 *
	 * @var int[]
	 */
	public const CLEANING_MINUTES = array( 30, 45, 60 );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `images` holds a JSON array of attachment IDs.
		// `colour` is a hex value including the leading '#'.
		// `cleaning_min` is constrained to CLEANING_MINUTES in application code.
		// The short links are NULL-able so that UNIQUE keys tolerate "not set yet".
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			name varchar(191) NOT NULL default '',
			description longtext NULL,
			images longtext NULL,
			capacity smallint(5) unsigned NOT NULL default 1,
			colour varchar(7) NOT NULL default '#3858e9',
			internal_short_link varchar(191) NULL default NULL,
			booking_short_link varchar(191) NULL default NULL,
			holiday_hesse tinyint(1) unsigned NOT NULL default 0,
			cleaning_min smallint(5) unsigned NOT NULL default 30,
			active tinyint(1) unsigned NOT NULL default 1,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY internal_short_link (internal_short_link),
			UNIQUE KEY booking_short_link (booking_short_link),
			KEY active_name (active,name)
		) $collate;";
	}
}
