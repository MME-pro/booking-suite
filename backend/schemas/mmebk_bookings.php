<?php
/**
 * Schema: bookings.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Schemas;

use BookingSuite\Backend\Db;
use BookingSuite\Backend\Pricing\RateCalculator;

defined( 'ABSPATH' ) || exit;

final class BookingsTable {

	public const NAME = 'bookings';

	/**
	 * Lifecycle of the reservation itself.
	 *
	 * awaiting_transfer — the contract is concluded and the money is owed; the
	 *                     dates are held until payment_deadline passes
	 * transfer_declared — the guest has said they sent it. A note to the owner
	 *                     and nothing more: no money has been seen, and this
	 *                     status has no legal weight of its own
	 * confirmed         — the owner has seen the money arrive in the bank and
	 *                     said so by hand. This is the only thing that sends
	 *                     the final confirmation
	 * completed         — the stay has happened
	 * cancelled         — it will not happen, and holds no dates
	 *
	 * `pending` and `reserved` are the old names for the first two and are kept
	 * so rows written before this release still read: nothing rewrites history,
	 * and BLOCKING_STATUSES covers both spellings.
	 *
	 * `cancelled` is deliberately absent from BLOCKING_STATUSES: a cancelled
	 * booking frees its dates the moment it is cancelled. Before it existed the
	 * only way out of a booking was to delete the row, which threw away the
	 * record along with the reservation — see BookingLifecycle, which parks
	 * expired requests here instead.
	 */
	public const STATUSES = array(
		'awaiting_transfer',
		'transfer_declared',
		/*
		 * The deadline passed and the money never came.
		 *
		 * Not the same thing as cancelled, and the flow diagram is explicit
		 * about it: cancelling is the operator's decision and nobody else's.
		 * An overdue booking is still a booking — the guest may yet pay, and
		 * the owner may yet decide to honour it — so it keeps its record, its
		 * number and its history rather than being written off by a cron job.
		 *
		 * It does NOT hold its dates. That is the whole purpose of the
		 * deadline: the room goes back on sale the moment the hold lapses, or
		 * one unpaid booking would keep a room shut indefinitely.
		 */
		'payment_overdue',
		'confirmed',
		'completed',
		'cancelled',
		/*
		 * The window went by and the money never came.
		 *
		 * Deliberately not called a no-show. Whether anybody turned up is a
		 * fact about a guest, and this system keeps no record of arrival — it
		 * would be guessing, and printing a guess about a person on the
		 * owner's screen is worse than printing nothing. What it does know,
		 * exactly, is that the booking reached its own end unpaid. That is
		 * what this word says, and it says it about the booking.
		 *
		 * Not `cancelled`, which claims a decision somebody made. Nobody
		 * decided this; the date simply passed.
		 *
		 * Distinct from `payment_overdue`, which is the same debt while the
		 * stay is still ahead — there the guest may yet pay and the owner may
		 * yet honour it. Once the day is gone there is nothing left to
		 * honour, and the amount has to stop being counted as owed.
		 */
		'lapsed',
		// Retired, still readable.
		'pending',
		'reserved',
	);

	/**
	 * The two kinds of booking, decided by the dates and never by a person.
	 *
	 * The distinction is a tax one: a stay that crosses midnight is
	 * accommodation and a stay that does not is something else, and the two
	 * carry different VAT. That is why it is written into the row when the
	 * booking is made rather than worked out again whenever an invoice is
	 * printed — the rate a guest was charged under must not move because the
	 * rules changed afterwards.
	 */
	public const TYPE_OVERNIGHT = 'overnight';

	public const TYPE_HOURLY = 'hourly';

	public const TYPES = array( self::TYPE_OVERNIGHT, self::TYPE_HOURLY );

	/**
	 * Which kind a stay is, from its two ends.
	 *
	 * "Does it cross into the next day" is the obvious reading and the wrong
	 * one. An hourly visit from 22:00 to 02:00 crosses midnight and is not
	 * accommodation — the guest was charged an hourly rate for it, and taxing
	 * as a hotel night something that was priced as four hours is incoherent
	 * on the same invoice.
	 *
	 * So the question asked is the pricing engine's: does this stay occupy the
	 * overnight window, check-in time to check-out time on the following day?
	 * That is the same test that decided whether the guest paid a night rate,
	 * which keeps the rate and the tax telling one story.
	 *
	 * @param string $starts_at 'Y-m-d H:i:s'.
	 * @param string $ends_at   'Y-m-d H:i:s'.
	 */
	public static function type_for( string $starts_at, string $ends_at ): string {
		return RateCalculator::is_overnight_window( $starts_at, $ends_at )
			? self::TYPE_OVERNIGHT
			: self::TYPE_HOURLY;
	}

	/**
	 * When a booking stops being today's business.
	 *
	 * Midnight after the day it finishes on, not the moment it finishes. A
	 * booking that ran 06:00–07:00 is still the desk's concern all day: the
	 * guest may walk in at four to pay, the owner may want it on the screen
	 * they are working. Turning it over at 07:01 takes it off their list while
	 * the day it belongs to is still being worked.
	 *
	 * Inclusive at midnight: at exactly 00:00:00 the booking is past.
	 *
	 * Measured from the end, never the start. A booking running 23:30–02:30
	 * finishes on the following day and turns over the midnight after *that* —
	 * keying it to the start would file it as finished while it was still
	 * running.
	 *
	 * @param string $ends_at 'Y-m-d H:i:s', site local time.
	 * @return string The instant it becomes past, same format.
	 */
	public static function becomes_past_at( string $ends_at ): string {
		/*
		 * The date part alone, advanced a day. Deliberately not strtotime()
		 * plus gmdate(): ends_at is the site's wall clock, gmdate() formats in
		 * UTC, and the pair would land on the wrong date either side of
		 * midnight for any site that is not on UTC. Only the calendar matters
		 * here, so only the calendar is touched.
		 */
		try {
			$day = new \DateTimeImmutable( substr( $ends_at, 0, 10 ) );
		} catch ( \Exception $e ) {
			return $ends_at;
		}

		return $day->modify( '+1 day' )->format( 'Y-m-d 00:00:00' );
	}

	/**
	 * The same boundary, as SQL.
	 *
	 * The filtering has to happen in the query rather than over the rows it
	 * returns, or the count and the page disagree and pagination breaks.
	 *
	 * `ends_at` is a whole timestamp here, so this is one expression rather
	 * than the CASE a schema storing a date and a time-of-day separately would
	 * need — there is no end that appears to precede its own start.
	 *
	 * Compare it against a time passed in from PHP, never against NOW(). The
	 * database server's clock and the site's timezone are not the same thing.
	 *
	 * @param string $alias Table alias, or '' for an unqualified column.
	 */
	public static function past_boundary_sql( string $alias = '' ): string {
		// Interpolated into SQL, so it is stripped to what an alias may be.
		$alias  = preg_replace( '/[^A-Za-z0-9_]/', '', $alias );
		$column = '' === $alias ? 'ends_at' : $alias . '.ends_at';

		return "TIMESTAMP(DATE_ADD(DATE($column), INTERVAL 1 DAY))";
	}

	/**
	 * The statuses that take a window off the board.
	 *
	 * A booking is binding the moment the guest presses the order button, so
	 * the dates go the moment it exists — waiting for the money to arrive would
	 * leave the same night on sale to somebody else for a day.
	 *
	 * Legacy `reserved` is here for the same reason it always was. Legacy
	 * `pending` is not: it never held dates, and adding it now would take
	 * windows off the board retrospectively for requests nobody ever answered.
	 */
	public const BLOCKING_STATUSES = array(
		'awaiting_transfer',
		'transfer_declared',
		'confirmed',
		'reserved',
	);

	/**
	 * The statuses a booking can be in while it is still owed money.
	 *
	 * These are the ones the deadline sweep looks at, and the ones the owner
	 * is chasing.
	 */
	public const AWAITING_STATUSES = array( 'awaiting_transfer', 'transfer_declared' );
	/** Settlement state, tracked separately from the booking status. */
	/**
	 * Settlement state, tracked separately from the booking status.
	 *
	 * `overpaid` is its own state rather than a variety of `paid`: the owner
	 * has money that is not theirs until somebody decides what happens to it,
	 * and a difference the system quietly rounded into "paid" is a difference
	 * nobody ever looks at again.
	 */
	/**
	 * `void` closes a debt that was never going to be settled.
	 *
	 * Nothing came and nothing is owed any longer. Left as `unpaid`, a booking
	 * whose day has passed sits in the outstanding figures for ever, quietly
	 * telling the owner they are owed money that nobody is going to bring.
	 *
	 * It is not `refunded`: that is money which arrived and went back. This is
	 * money that never arrived and has stopped being expected. The amount
	 * drops out of everything owed without ever being counted as taken.
	 */
	public const PAYMENT_STATUSES = array( 'unpaid', 'partial', 'paid', 'overpaid', 'refunded', 'void' );

	public static function table(): string {
		return Db::table( self::NAME );
	}

	public static function definition(): string {
		$collate = Db::collate();
		$table   = self::table();

		// `reference` is the human-facing booking number and is NULL-able so
		// the UNIQUE key tolerates a row created before one is assigned.
		// `starts_at`/`ends_at` are the time window, stored as the SITE'S wall
		// clock — the time it is at the apartment, which is what the guest was
		// told and what the cleaner is given. Not UTC: PublicBookingController
		// writes the chosen date and time as they were picked, and compares
		// them against current_time( 'mysql' ). This comment used to say UTC,
		// and the admin app believed it and shifted every time on screen by
		// the viewer's own offset.
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
			booking_type varchar(20) NOT NULL default 'overnight',
			payment_deadline datetime NULL default NULL,
			transfer_confirmed_at datetime NULL default NULL,
			notes longtext NULL,
			created_at datetime NOT NULL default '0000-00-00 00:00:00',
			updated_at datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (id),
			UNIQUE KEY reference (reference),
			KEY room_window (room_id,starts_at,ends_at),
			KEY customer_id (customer_id),
			KEY status (status),
			KEY payment_deadline (payment_deadline),
			KEY payment_status (payment_status)
		) $collate;";
	}
}
