<?php
/**
 * Schema: extra ↔ booking link table.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class ExtraBookingTable {

	public const NAME = 'extra_booking';

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `unit_price` is copied from the extra at booking time so later price
		// changes never rewrite what a guest was charged.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			booking_id bigint(20) unsigned NOT NULL,
			extra_id bigint(20) unsigned NOT NULL,
			quantity smallint(5) unsigned NOT NULL default 1,
			unit_price decimal(10,2) NOT NULL default 0.00,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY booking_extra (booking_id,extra_id),
			KEY extra_id (extra_id)
		) $collate;";
	}
}
