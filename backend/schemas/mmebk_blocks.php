<?php
/**
 * Schema: blocks.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class BlocksTable {

	public const NAME = 'blocks';

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// Both `room_id` and `extra_id` are NULL-able: a row with neither set
		// is a central block covering the whole property.
		// FROM and TO are reserved words in SQL, so the window columns follow
		// the naming used by bookings.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			room_id bigint(20) unsigned NULL default NULL,
			extra_id bigint(20) unsigned NULL default NULL,
			starts_at datetime NOT NULL default '0000-00-00 00:00:00',
			ends_at datetime NOT NULL default '0000-00-00 00:00:00',
			reason varchar(191) NOT NULL default '',
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY room_window (room_id,starts_at,ends_at),
			KEY extra_window (extra_id,starts_at,ends_at)
		) $collate;";
	}
}
