<?php
/**
 * Moves bookings along once their time has passed.
 *
 * Two transitions, both keyed on the midnight after the day the booking
 * finishes on — not on `ends_at` itself. A booking is the desk's business for
 * the whole of its last day; see BookingsTable::becomes_past_at().
 *
 *   pending   → cancelled   the request was never answered
 *   confirmed → completed   the stay happened
 *
 * Nothing here decides anything a person has not already decided. A pending
 * request that nobody approved before its slot ended cannot be honoured, and a
 * confirmed booking whose window has closed has, as far as this system can
 * know, been served. Both were previously left sitting in the list forever,
 * which is what made the bookings screen fill with dead rows.
 *
 * There is deliberately no "no show". Distinguishing a guest who did not turn
 * up from one who did needs a record of arrival that this system does not keep,
 * and guessing at it would put a factual claim about a guest on the owner's
 * screen with nothing behind it.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\PaymentsTable;

defined( 'ABSPATH' ) || exit;

final class BookingLifecycle {

	/** The cron hook every sweep runs on. */
	public const HOOK = 'booking_suite_settle_bookings';

	/**
	 * Hourly.
	 *
	 * The transitions are not urgent — nothing a guest sees depends on them,
	 * and a booking that settles fifty minutes late is settled all the same.
	 * Hourly is a WordPress built-in, so it needs no custom interval.
	 */
	private const INTERVAL = 'hourly';

	public static function register(): void {
		add_action( self::HOOK, array( self::class, 'run' ) );

		// Also from admin_init, so an install that was already active when
		// this arrived gets its schedule without a deactivate/activate.
		add_action( 'admin_init', array( self::class, 'schedule' ) );
	}

	/**
	 * Put the sweep on the schedule, if it is not there already.
	 *
	 * An event booked by an earlier version keeps whatever recurrence it was
	 * given — WordPress never revisits that — so a mismatch is re-booked rather
	 * than left alone.
	 */
	public static function schedule(): void {
		$event = wp_get_scheduled_event( self::HOOK );

		if ( $event && self::INTERVAL === ( $event->schedule ?? '' ) ) {
			return;
		}

		if ( $event ) {
			wp_clear_scheduled_hook( self::HOOK );
		}

		/*
		 * Not time(): the first sweep would run inside the request that
		 * scheduled it, which on activation means rewriting the whole booking
		 * table while the plugin is still switching on.
		 */
		wp_schedule_event( time() + 5 * MINUTE_IN_SECONDS, self::INTERVAL, self::HOOK );
	}

	/** Take it off again. Called when the plugin is deactivated. */
	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/**
	 * Settle everything whose window has closed.
	 *
	 * Two statements rather than a row-by-row loop: the first sweep on a busy
	 * site has years of stale bookings to get through, and the work is a plain
	 * status rewrite with nothing to decide per row.
	 *
	 * No email is sent. The guest was told nothing when their request went
	 * unanswered, and telling them weeks later that it is now formally
	 * cancelled helps nobody — least of all on the first sweep, which would
	 * post a backlog of them at once.
	 *
	 * @return array{expired: int, cancelled: int, completed: int} What changed.
	 */
	public static function run(): array {
		global $wpdb;

		$table = BookingsTable::table();

		// The site's own clock, not UTC: starts_at and ends_at are stored in
		// local time, so comparing them against a UTC now() would settle
		// bookings early or late by the offset.
		$now = current_time( 'mysql' );

		/*
		 * The transfer never came.
		 *
		 * A booking awaiting its money holds the dates from the moment it is
		 * made, which is the only way to stop the same night being sold twice
		 * while a guest is at their bank. The cost of that is that a guest who
		 * never pays would hold the dates forever, so the hold has an end:
		 * payment_deadline, set when the booking was taken and promised to the
		 * guest on the checkout and again on the payment page.
		 *
		 * `transfer_declared` goes the same way. Saying the money was sent is a
		 * courtesy to the owner and has no legal weight of its own — if it
		 * never arrives, the claim that it was sent cannot keep the room shut.
		 *
		 * Rows with no deadline are left alone. Everything made before this
		 * release has none, and inventing one now would cancel bookings that
		 * were taken under different terms.
		 */
		$awaiting     = BookingsTable::AWAITING_STATUSES;
		$placeholders = implode( ',', array_fill( 0, count( $awaiting ), '%s' ) );

		/*
		 * Overdue, not cancelled.
		 *
		 * The flow diagram is explicit: a deadline the cron notices moves the
		 * booking to payment_overdue, and only the operator cancels. The
		 * distinction is worth keeping — a guest whose transfer crossed with
		 * the deadline can still be marked paid from here, which is exactly
		 * what the diagram's "manual recording of incoming payments" arrow
		 * out of payment_overdue is for. A cancelled booking has had that
		 * decision taken for it by a clock.
		 *
		 * The dates are released either way: payment_overdue is absent from
		 * BLOCKING_STATUSES, so the room is back on sale the moment the hold
		 * lapses.
		 */
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$expired = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'payment_overdue', updated_at = %s
				WHERE status IN ( $placeholders )
					AND payment_deadline IS NOT NULL
					AND payment_deadline < %s",
				array_merge( array( $now ), $awaiting, array( $now ) )
			)
		);

		/*
		 * And the older shape of the same thing: a request nobody ever answered
		 * whose window has now been and gone. Kept for rows written before the
		 * deadline existed.
		 */
		/*
		 * Both transitions wait for the day to turn over, not for the booking
		 * to finish.
		 *
		 * These compared against `ends_at` directly, so a stay that ended at
		 * 07:00 was settled at 07:01 — while the day it belonged to still had
		 * fourteen hours of business left in it. A booking is the desk's
		 * concern for the whole of the day it finishes on: the guest may still
		 * walk in and pay, the owner may still want it on the screen they are
		 * working. See BookingsTable::becomes_past_at().
		 *
		 * One boundary and one `now` for both, so a confirmed booking and an
		 * unanswered one never settle at different moments.
		 */
		$past_at = BookingsTable::past_boundary_sql();

		$lapsed = self::lapse( $past_at, $now );

		/*
		 * Whatever is left of the retired `pending` status.
		 *
		 * The lapse above takes every unpaid one first, which is the honest
		 * answer for them. What can still reach here is a `pending` row that
		 * was paid or part-paid and never moved on — rare, and cancelling it
		 * is the behaviour those rows were written under.
		 */
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cancelled = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'cancelled', updated_at = %s
				WHERE status = 'pending' AND $past_at <= %s",
				$now,
				$now
			)
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$completed = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'completed', updated_at = %s
				WHERE status = 'confirmed' AND $past_at <= %s",
				$now,
				$now
			)
		);

		return array(
			'expired'   => max( 0, $expired ),
			'lapsed'    => max( 0, $lapsed ),
			'cancelled' => max( 0, $cancelled ),
			'completed' => max( 0, $completed ),
		);
	}

	/**
	 * Close out bookings whose day went by with the money still outstanding.
	 *
	 * Three things have to be true, and the first is the one that matters: the
	 * *day* has turned over, not merely the end time. A guest has until
	 * midnight to walk in and settle; writing the booking off at 10:01 while
	 * they still had the afternoon to arrive is how this goes wrong.
	 *
	 * The amount stops being owed. Left alone these rows sit in the
	 * outstanding figures for ever, and the longer a site runs the further
	 * what it believes it is owed drifts from what anyone is going to pay.
	 *
	 * Idempotent, and it does not only look forward: a booking that has been
	 * sitting unpaid since before this existed is swept on the first run, so
	 * one pass leaves the totals right rather than right from here onwards.
	 *
	 * @param string $past_at SQL for the moment a booking becomes past.
	 * @param string $now     The site's clock, shared with the other passes.
	 * @return int How many were closed.
	 */
	private static function lapse( string $past_at, string $now ): int {
		global $wpdb;

		$table    = BookingsTable::table();
		$payments = PaymentsTable::table();

		/*
		 * Untouched: anything already settled by a person. `cancelled` was
		 * somebody's decision, `completed` says the stay happened, and a
		 * booking already lapsed is done. Re-running must change nothing.
		 */
		$settled      = array( 'cancelled', 'completed', 'lapsed' );
		$placeholders = implode( ',', array_fill( 0, count( $settled ), '%s' ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM $table
				WHERE payment_status = 'unpaid'
					AND status NOT IN ($placeholders)
					AND $past_at <= %s",
				array_merge( $settled, array( $now ) )
			)
		);

		if ( ! $ids ) {
			return 0;
		}

		$in = implode( ',', array_map( 'absint', $ids ) );

		/*
		 * The note says why the status moved. A row that changes on its own
		 * between two visits to the screen, with nothing to explain it, reads
		 * as the system having lost track of something.
		 */
		$note = __( 'Closed automatically: the booking date passed unpaid.', 'booking-suite' );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$count = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'lapsed',
					payment_status = 'void',
					notes = TRIM(CONCAT(COALESCE(notes, ''), '\n', %s)),
					updated_at = %s
				WHERE id IN ($in)",
				$note,
				$now
			)
		);

		/*
		 * The money that was expected and never came, closed with it.
		 *
		 * Only rows still waiting. A payment that actually landed is left
		 * exactly as it is — this closes a debt, it does not rewrite what was
		 * received.
		 */
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE $payments
				SET status = 'void', updated_at = %s
				WHERE booking_id IN ($in) AND status = 'pending'",
				$now
			)
		);

		return $count;
	}
}
