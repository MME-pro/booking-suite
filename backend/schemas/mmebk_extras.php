<?php
/**
 * Schema: extras.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class ExtrasTable {

	public const NAME = 'extras';

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `room_ids` holds a JSON array of apartment ids the extra may be
		// booked with; an empty array means every apartment.
		// `stock` is NULL-able, where NULL means unlimited availability.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			name varchar(191) NOT NULL default '',
			description longtext NULL,
			price decimal(10,2) NOT NULL default 0.00,
			stock int(11) unsigned NULL default NULL,
			room_ids longtext NULL,
			active tinyint(1) unsigned NOT NULL default 1,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY active_name (active,name)
		) $collate;";
	}
}
