<?php
/**
 * Schema: booking events.
 *
 * The trail a booking leaves behind it. Every other table in this plugin holds
 * the CURRENT state of something: the bookings row says what the stay is now,
 * the payments row says what is owed now. Change either and what it used to say
 * is gone — the price it was taken at, the dates it was moved from, the amount
 * the guest was originally asked for.
 *
 * That is fine for running the property and useless for answering a guest who
 * says "but you told me it was €240". So each change is also written down here,
 * once, and never touched again. Rows are append-only: nothing in the plugin
 * updates or deletes one except the hard delete of the booking itself, which
 * takes its history with it because the history is about a booking that no
 * longer exists.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class BookingEventsTable {

	public const NAME = 'booking_events';

	/** The booking row itself was inserted. */
	public const CREATED = 'created';

	/** Columns on the booking changed; `changes` says which, and from what. */
	public const UPDATED = 'updated';

	/** A payment row was written against the booking. */
	public const PAYMENT_RECORDED = 'payment_recorded';

	/** An existing payment's amount was rewritten in place. */
	public const PAYMENT_AMENDED = 'payment_amended';

	/** A payment moved between pending, paid, failed or refunded. */
	public const PAYMENT_STATUS = 'payment_status';

	/** An invoice number was assigned to a payment. */
	public const INVOICE_ISSUED = 'invoice_issued';

	/** A template was sent to the guest. */
	public const EMAIL_SENT = 'email_sent';

	public const EVENTS = array(
		self::CREATED,
		self::UPDATED,
		self::PAYMENT_RECORDED,
		self::PAYMENT_AMENDED,
		self::PAYMENT_STATUS,
		self::INVOICE_ISSUED,
		self::EMAIL_SENT,
	);

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		/*
		 * `payment_id` is NULL on anything that is not about one payment.
		 *
		 * `actor_id` is the WordPress user who did it, or 0 for the guest
		 * booking from the website and for the hourly sweep. `actor_name` is a
		 * SNAPSHOT of their display name rather than a lookup: staff come and
		 * go, and a history that reads "deleted user" a year later has lost the
		 * one thing it was keeping.
		 *
		 * `changes` is JSON — { field: { from, to } } — because the set of
		 * columns worth recording is not the set of columns this table should
		 * have to grow with.
		 */
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			booking_id bigint(20) unsigned NOT NULL,
			payment_id bigint(20) unsigned NULL default NULL,
			event varchar(32) NOT NULL default 'updated',
			actor_id bigint(20) unsigned NOT NULL default 0,
			actor_name varchar(191) NOT NULL default '',
			changes longtext NULL,
			note text NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			KEY booking_id (booking_id,id),
			KEY event (event)
		) $collate;";
	}
}
