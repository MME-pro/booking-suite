<?php
/**
 * Schema: ical_feeds.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class IcalFeedsTable {

	public const NAME = 'ical_feeds';

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		/*
		 * One row per calendar subscription: an apartment, and the .ics URL a
		 * portal publishes its blocked dates at.
		 *
		 * `url` is a varchar(500) with no index on it — Airbnb's export links
		 * run past 200 characters, and nothing ever looks a feed up by URL.
		 *
		 * The four `last_*` columns are the outcome of the most recent pull,
		 * kept on the row rather than in a log: what the operator needs to see
		 * is whether the last sync worked and when, and a log of every hourly
		 * success would grow without ever being read.
		 */
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			room_id bigint(20) unsigned NOT NULL default 0,
			name varchar(191) NOT NULL default '',
			url varchar(500) NOT NULL default '',
			source varchar(32) NOT NULL default 'other',
			active tinyint(1) unsigned NOT NULL default 1,
			last_sync_at datetime NULL default NULL,
			last_status varchar(32) NOT NULL default '',
			last_message varchar(255) NOT NULL default '',
			last_event_count int(11) NOT NULL default 0,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY room_active (room_id,active)
		) $collate;";
	}
}
