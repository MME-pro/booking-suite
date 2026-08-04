<?php
/**
 * Schema: customers.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class CustomersTable {

	public const NAME = 'customers';

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `email` is NULL-able so the UNIQUE key tolerates walk-in guests
		// recorded without one; MySQL allows repeated NULLs in a UNIQUE key.
		// `bookings_count`, `total_spent` and `last_booking_at` are the guest's
		// history, denormalised so a list view needs no aggregate query.
		// `user_id` links to a wp_users row when the guest has an account.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			user_id bigint(20) unsigned NULL default NULL,
			first_name varchar(100) NOT NULL default '',
			last_name varchar(100) NOT NULL default '',
			email varchar(191) NULL default NULL,
			phone varchar(50) NOT NULL default '',
			company varchar(191) NOT NULL default '',
			address varchar(191) NOT NULL default '',
			postcode varchar(20) NOT NULL default '',
			city varchar(100) NOT NULL default '',
			country char(2) NOT NULL default '',
			language varchar(5) NOT NULL default 'de',
			notes longtext NULL,
			bookings_count int(11) unsigned NOT NULL default 0,
			total_spent decimal(12,2) NOT NULL default 0.00,
			last_booking_at datetime NULL default NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY email (email),
			KEY user_id (user_id),
			KEY last_name (last_name)
		) $collate;";
	}
}
