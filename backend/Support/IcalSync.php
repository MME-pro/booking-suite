<?php
/**
 * The scheduled side of calendar synchronisation.
 *
 * A subscription is only worth having if it keeps itself up to date, so the
 * feeds are pulled on WP-Cron rather than only when somebody opens the screen.
 * The interval is every 15 minutes: the window in which this site could sell a
 * date another channel has already sold is the whole risk being managed here,
 * and a quarter of an hour is a much smaller window than an hour. The cost is
 * four HTTP requests per feed per hour instead of one.
 *
 * WordPress has no 15-minute schedule of its own — hourly is the shortest it
 * ships — so one is registered below.
 *
 * Worth knowing: polling more often does not make a portal's own export fresher.
 * Each portal regenerates its .ics on its own cadence, so the real staleness is
 * theirs plus ours, and this only shortens the second half.
 *
 * WP-Cron also only fires when the site is visited, so on a quiet site the pull
 * still lags whatever the interval says. The sync screen shows when each feed
 * was last read and can pull on demand; a site expecting long quiet stretches
 * wants a real server cron hitting wp-cron.php instead.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\BlocksRepository;
use BookingSuite\Backend\Schemas\BlocksTable;

defined( 'ABSPATH' ) || exit;

final class IcalSync {

	/** The cron hook every scheduled pull runs on. */
	public const HOOK = 'bksuite_ical_sync';

	/** Our own schedule; WordPress ships nothing shorter than hourly. */
	public const INTERVAL = 'bksuite_quarter_hourly';

	public static function register(): void {
		self::register_interval();

		add_action( self::HOOK, array( self::class, 'run' ) );

		// Also from admin_init, so an install that was already active when this
		// feature arrived gets its schedule without a deactivate/activate.
		add_action( 'admin_init', array( self::class, 'schedule' ) );
	}

	/**
	 * Teach WP-Cron the 15-minute interval.
	 *
	 * Called from schedule() as well as register(), because activation runs the
	 * scheduling directly and wp_schedule_event() refuses a recurrence it has
	 * never heard of. Registering the same callback twice is a no-op.
	 */
	public static function register_interval(): void {
		add_filter( 'cron_schedules', array( self::class, 'add_interval' ) );
	}

	/**
	 * @param array<string, array{interval: int, display: string}> $schedules
	 *
	 * @return array<string, array{interval: int, display: string}>
	 */
	public static function add_interval( array $schedules ): array {
		$schedules[ self::INTERVAL ] = array(
			'interval' => 15 * MINUTE_IN_SECONDS,
			'display'  => __( 'Every 15 minutes', 'booking-suite' ),
		);

		return $schedules;
	}

	/**
	 * Put the recurring pull on the schedule, if it is not there already.
	 *
	 * An event left over from an earlier version runs on whatever recurrence it
	 * was booked with — WordPress never revisits that — so an install that was
	 * scheduled hourly would stay hourly forever. Hence the check: if what is
	 * booked is not what this class now asks for, it is re-booked.
	 */
	public static function schedule(): void {
		self::register_interval();

		$event = wp_get_scheduled_event( self::HOOK );

		if ( $event && self::INTERVAL === ( $event->schedule ?? '' ) ) {
			return;
		}

		if ( $event ) {
			wp_clear_scheduled_hook( self::HOOK );
		}

		/*
		 * Not `time()`: the first run would land inside the request that
		 * scheduled it, which on activation means pulling every portal while
		 * the plugin is still switching on.
		 */
		wp_schedule_event(
			time() + 5 * MINUTE_IN_SECONDS,
			self::INTERVAL,
			self::HOOK
		);
	}

	/**
	 * Take it off again. Called when the plugin is deactivated.
	 */
	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	public static function run(): void {
		IcalImporter::sync_all();
	}

	/**
	 * Release every lock one portal's import wrote for one apartment.
	 *
	 * Used when a subscription is removed and the operator asks for its dates
	 * to go with it. Scoped exactly as the import is scoped — apartment and
	 * portal, imported locks only — so a lock made by hand is never caught up
	 * in it.
	 *
	 * @return int How many were released.
	 */
	public static function release_feed_locks( int $apartment_id, string $source ): int {
		global $wpdb;

		if ( BlocksRepository::SOURCE_MANUAL === $source ) {
			return 0;
		}

		$blocks = BlocksTable::table();

		return (int) $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM $blocks
				WHERE room_id = %d
					AND extra_id IS NULL
					AND source = %s
					AND external_uid <> ''",
				$apartment_id,
				$source
			)
		);
	}
}
