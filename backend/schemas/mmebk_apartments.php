<?php
/**
 * Schema: apartments.
 *
 * The booking-relevant fields of a bks_apartment post. The post keeps what
 * WordPress and Elementor need — title, content, permalink, featured image —
 * and everything the booking engine reads lives here, typed and indexed,
 * instead of as untyped strings spread through wp_postmeta.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class ApartmentsTable {

	public const NAME = 'apartments';

	/**
	 * Allowed cleaning turnaround times, in minutes.
	 *
	 * @var int[]
	 */
	public const CLEANING_MINUTES = array( 30, 45, 60 );

	public const DEFAULT_COLOUR = '#3858e9';

	/**
	 * Days charged at the weekend rate, as returned by date( 'w' ).
	 * Friday and Saturday; Sunday through Thursday take the weekday rate.
	 *
	 * @var int[]
	 */
	public const WEEKEND_DAYS = array( 5, 6 );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `post_id` is both the primary key and the link to wp_posts: one row
		// per apartment, no surrogate id to keep in step.
		// `weekday_rate` covers Sunday–Thursday nights and `weekend_rate`
		// Friday and Saturday; 0.00 means "not priced yet".
		// `images` holds a JSON array of attachment IDs.
		// The short links are NULL-able so the UNIQUE keys tolerate "not set".
		//
		// `ical_token` is the secret in this apartment's calendar export URL.
		// The feed has to be readable by Airbnb and Booking.com, which arrive
		// with no cookie and cannot log in, so the URL itself is the
		// credential — the same arrangement those portals use for the links
		// they hand out. It is NULL until the operator asks for the link, and
		// UNIQUE because it is what a request is looked up by.
		return "CREATE TABLE $table (
			post_id bigint(20) unsigned NOT NULL,
			capacity smallint(5) unsigned NOT NULL default 1,
			colour varchar(7) NOT NULL default '#3858e9',
			cleaning_min smallint(5) unsigned NOT NULL default 30,
			weekday_rate decimal(10,2) NOT NULL default 0.00,
			weekend_rate decimal(10,2) NOT NULL default 0.00,
			holiday_hesse tinyint(1) unsigned NOT NULL default 0,
			active tinyint(1) unsigned NOT NULL default 1,
			internal_short_link varchar(191) NULL default NULL,
			booking_short_link varchar(191) NULL default NULL,
			images longtext NULL,
			ical_token varchar(64) NULL default NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (post_id),
			UNIQUE KEY internal_short_link (internal_short_link),
			UNIQUE KEY booking_short_link (booking_short_link),
			UNIQUE KEY ical_token (ical_token),
			KEY active_capacity (active,capacity)
		) $collate;";
	}
}
