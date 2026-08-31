<?php
/**
 * Schema: bookings.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;

defined( 'ABSPATH' ) || exit;

final class BookingsTable {

	public const NAME = 'bookings';

	/**
	 * Lifecycle of the reservation itself.
	 *
	 * pending   — the request has arrived, nothing decided; holds no dates
	 * reserved  — held for the guest while payment is awaited
	 * confirmed — approved and going ahead
	 * completed — the stay has happened
	 * cancelled — it will not happen, and holds no dates
	 *
	 * `cancelled` is deliberately absent from BLOCKING_STATUSES: a cancelled
	 * booking frees its dates the moment it is cancelled. Before it existed the
	 * only way out of a booking was to delete the row, which threw away the
	 * record along with the reservation — see BookingLifecycle, which parks
	 * expired requests here instead.
	 */
	public const STATUSES = array( 'pending', 'reserved', 'confirmed', 'completed', 'cancelled' );

	/** Settlement state, tracked separately from the booking status. */
	public const PAYMENT_STATUSES = array( 'unpaid', 'partial', 'paid', 'refunded' );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `reference` is the human-facing booking number and is NULL-able so
		// the UNIQUE key tolerates a row created before one is assigned.
		// `starts_at`/`ends_at` are the time window, stored in UTC.
		// `customer_id` is NULL-able so a booking can be taken down before the
		// guest record exists.
		return "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL auto_increment,
			reference varchar(32) NULL default NULL,
			room_id bigint(20) unsigned NOT NULL,
			customer_id bigint(20) unsigned NULL default NULL,
			status varchar(20) NOT NULL default 'pending',
			payment_status varchar(20) NOT NULL default 'unpaid',
			guests smallint(5) unsigned NOT NULL default 1,
			starts_at datetime NOT NULL default '0000-00-00 00:00:00',
			ends_at datetime NOT NULL default '0000-00-00 00:00:00',
			total_amount decimal(10,2) NOT NULL default 0.00,
			currency char(3) NOT NULL default 'EUR',
			source varchar(32) NOT NULL default 'website',
			notes longtext NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY reference (reference),
			KEY room_window (room_id,starts_at,ends_at),
			KEY customer_id (customer_id),
			KEY status (status),
			KEY payment_status (payment_status)
		) $collate;";
	}
}
