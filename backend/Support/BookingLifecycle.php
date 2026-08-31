<?php
/**
 * Moves bookings along once their time has passed.
 *
 * Two transitions, both keyed on `ends_at` — a booking is only ever settled
 * once the window it reserved is behind us:
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
	 * @return array{cancelled: int, completed: int} What changed.
	 */
	public static function run(): array {
		global $wpdb;

		$table = BookingsTable::table();

		// The site's own clock, not UTC: starts_at and ends_at are stored in
		// local time, so comparing them against a UTC now() would settle
		// bookings early or late by the offset.
		$now = current_time( 'mysql' );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$cancelled = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'cancelled', updated_at = %s
				WHERE status = 'pending' AND ends_at < %s",
				$now,
				$now
			)
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$completed = (int) $wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET status = 'completed', updated_at = %s
				WHERE status = 'confirmed' AND ends_at < %s",
				$now,
				$now
			)
		);

		return array(
			'cancelled' => max( 0, $cancelled ),
			'completed' => max( 0, $completed ),
		);
	}
}
