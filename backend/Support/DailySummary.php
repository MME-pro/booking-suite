<?php
/**
 * The day's figures, sent to whoever runs the place.
 *
 * One email a day answering the questions an owner asks at closing time: how
 * many bookings, worth how much, how much money actually arrived, what was
 * cancelled, and how much of it was paid on the spot.
 *
 * The queries live here rather than in a repository because they are a report
 * — they span bookings and payments, they group by nothing, and nothing else
 * in the plugin wants them. A repository method returning "yesterday's cash
 * total" would be a reporting question wearing a data-access coat.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\CustomersTable;
use BookingSuite\Backend\Schemas\PaymentsTable;
use DateTimeImmutable;

use const BookingSuite\PREFIX;

defined( 'ABSPATH' ) || exit;

final class DailySummary {

	/** The recurring send. */
	public const HOOK = PREFIX . 'daily_summary';

	/**
	 * The hour before which "the day" means the one that just ended.
	 *
	 * A summary set for midnight is asking about the day that finished a
	 * moment ago, not the one that has barely started. A summary set for the
	 * evening is asking about today. Six is the dividing line: nobody sets a
	 * 5am summary meaning the day ahead.
	 */
	private const MORNING = 6;

	public static function register(): void {
		add_action( self::HOOK, array( self::class, 'run' ) );

		// Booked and re-booked from admin_init, so changing the time in
		// Settings moves the next send without a deactivate and activate.
		add_action( 'admin_init', array( self::class, 'schedule' ) );
	}

	/**
	 * Put the send on the schedule, or move it when the time has changed.
	 *
	 * WP-Cron has no "daily at 20:00" — only a first run and a recurrence — so
	 * the chosen time is expressed as the timestamp of the next occurrence. A
	 * stored event whose time no longer matches the setting is replaced rather
	 * than left running at the old hour forever.
	 */
	public static function schedule(): void {
		$wanted = self::next_run();

		if ( ! SettingsRepository::daily_summary_enabled() ) {
			self::unschedule();

			return;
		}

		$event = wp_get_scheduled_event( self::HOOK );

		if ( $event ) {
			// Same time of day, already booked daily: nothing to do.
			if ( 'daily' === ( $event->schedule ?? '' )
				&& gmdate( 'H:i', $event->timestamp ) === gmdate( 'H:i', $wanted )
			) {
				return;
			}

			wp_clear_scheduled_hook( self::HOOK );
		}

		wp_schedule_event( $wanted, 'daily', self::HOOK );
	}

	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/**
	 * When the next send falls, as a UTC timestamp.
	 *
	 * Worked out in the site's timezone and converted, because "midnight" is a
	 * wall-clock time to whoever set it — a summary that arrives at 01:00 in
	 * summer and 00:00 in winter is a bug nobody can explain.
	 */
	private static function next_run(): int {
		$time = (string) SettingsRepository::get( SettingsRepository::DAILY_SUMMARY_TIME );

		if ( ! preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $time ) ) {
			$time = '00:00';
		}

		$zone = wp_timezone();
		$now  = new DateTimeImmutable( 'now', $zone );
		$next = new DateTimeImmutable( $now->format( 'Y-m-d' ) . ' ' . $time . ':00', $zone );

		if ( $next <= $now ) {
			$next = $next->modify( '+1 day' );
		}

		return $next->getTimestamp();
	}

	/**
	 * Which day a summary sent now is about.
	 *
	 * @return string Y-m-d.
	 */
	public static function target_date(): string {
		$zone = wp_timezone();
		$now  = new DateTimeImmutable( 'now', $zone );

		return (int) $now->format( 'G' ) < self::MORNING
			? $now->modify( '-1 day' )->format( 'Y-m-d' )
			: $now->format( 'Y-m-d' );
	}

	/** The scheduled send. */
	public static function run(): void {
		if ( ! SettingsRepository::daily_summary_enabled() ) {
			return;
		}

		self::send( self::target_date() );
	}

	/**
	 * What happened on one day.
	 *
	 * Bookings are counted by when the stay *starts*, not when it was made:
	 * "today's bookings" to someone running an apartment means the people
	 * arriving today. Money is counted by when it was settled, which is the
	 * only date a bank statement can be reconciled against.
	 *
	 * @param string $date Y-m-d.
	 * @return array<string, mixed>
	 */
	public static function figures( string $date ): array {
		global $wpdb;

		$bookings  = BookingsTable::table();
		$payments  = PaymentsTable::table();
		$customers = CustomersTable::table();

		$from = $date . ' 00:00:00';
		$to   = $date . ' 23:59:59';

		$taken = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COUNT(*) AS rows_count,
					COALESCE( SUM( total_amount ), 0 ) AS total,
					COUNT( DISTINCT room_id ) AS rooms
				FROM $bookings
				WHERE starts_at BETWEEN %s AND %s
					AND status <> 'cancelled'",
				$from,
				$to
			),
			ARRAY_A
		) ?: array();

		/*
		 * The appointments, in the order they happen. Cancelled ones are
		 * listed too but marked: an owner who sees four in the count and
		 * five rows in the table has been told the truth, whereas one who
		 * turns up for a stay that was called off has not.
		 */
		$appointments = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT b.id, b.reference, b.room_id, b.status, b.guests,
					b.starts_at, b.ends_at, b.total_amount,
					c.first_name, c.last_name
				FROM $bookings AS b
				LEFT JOIN $customers AS c ON c.id = b.customer_id
				WHERE b.starts_at BETWEEN %s AND %s
				ORDER BY b.starts_at, b.id",
				$from,
				$to
			),
			ARRAY_A
		) ?: array();

		$cancelled = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $bookings
				WHERE starts_at BETWEEN %s AND %s AND status = 'cancelled'",
				$from,
				$to
			)
		);

		/*
		 * Settled money only. A pending payment is a guest's claim that they
		 * have paid, and putting it in a day's takings would have the owner
		 * reconciling against a figure the bank has never seen.
		 */
		$settled = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT method, COUNT(*) AS rows_count, COALESCE( SUM( amount ), 0 ) AS total
				FROM $payments
				WHERE status = 'paid' AND paid_at BETWEEN %s AND %s
				GROUP BY method",
				$from,
				$to
			),
			ARRAY_A
		) ?: array();

		$by_method = array();
		$received  = 0.0;

		foreach ( $settled as $row ) {
			$by_method[ (string) $row['method'] ] = array(
				'count' => (int) $row['rows_count'],
				'total' => (float) $row['total'],
			);

			$received += (float) $row['total'];
		}

		return array(
			'date'         => $date,
			'appointments' => $appointments,
			'bookings'     => (int) ( $taken['rows_count'] ?? 0 ),
			'bookingTotal' => (float) ( $taken['total'] ?? 0 ),
			'apartments'   => (int) ( $taken['rooms'] ?? 0 ),
			'cancelled'    => $cancelled,
			'received'     => $received,
			// Paid on the spot rather than transferred ahead. The owner counts
			// this separately because it is the money physically on hand.
			'onSiteCount'  => (int) ( $by_method['cash']['count'] ?? 0 ),
			'onSiteTotal'  => (float) ( $by_method['cash']['total'] ?? 0 ),
			'transfer'     => (float) ( $by_method['transfer']['total'] ?? 0 ),
			'card'         => (float) ( $by_method['card']['total'] ?? 0 ),
		);
	}

	/**
	 * Render and send the summary for one day.
	 *
	 * @param string $date Y-m-d.
	 * @return int How many recipients it was handed to.
	 */
	public static function send( string $date ): int {
		$template = EmailTemplatesRepository::find( EmailTemplatesRepository::DAILY_SUMMARY );

		if ( null === $template || ! $template['enabled'] ) {
			return 0;
		}

		$recipients = SettingsRepository::daily_summary_recipients();

		if ( ! $recipients ) {
			return 0;
		}

		$tokens = self::tokens( self::figures( $date ) );
		$sent   = 0;

		foreach ( $recipients as $address ) {
			if ( BookingEmails::send_raw(
				$address,
				strtr( (string) $template['subject'], $tokens ),
				strtr( (string) $template['body'], $tokens )
			) ) {
				++$sent;
			}
		}

		return $sent;
	}

	/**
	 * The day's appointments as table rows.
	 *
	 * Rendered here rather than left to the template: a row per booking is not
	 * something a placeholder can express, so the template holds the table and
	 * this fills it.
	 *
	 * @param array<int, array<string, mixed>> $appointments From figures().
	 */
	private static function appointment_rows( array $appointments ): string {
		if ( ! $appointments ) {
			return '<tr><td colspan="4">'
				. esc_html__( 'Nothing booked for this day.', 'booking-suite' )
				. '</td></tr>';
		}

		$currency = SettingsRepository::currency_symbol();
		$rows     = array();

		foreach ( $appointments as $row ) {
			$starts = (int) strtotime( (string) $row['starts_at'] );
			$ends   = (int) strtotime( (string) $row['ends_at'] );

			$when = gmdate( 'H:i', $starts ) . ' – ' . gmdate( 'H:i', $ends );

			// A stay that ends the next day says so, or "16:00 – 11:00" reads
			// as five hours running backwards.
			if ( gmdate( 'Y-m-d', $starts ) !== gmdate( 'Y-m-d', $ends ) ) {
				$when .= ' (+1)';
			}

			$guest = trim( (string) $row['first_name'] . ' ' . (string) $row['last_name'] );

			if ( '' === $guest ) {
				$guest = (string) ( $row['reference'] ?? '—' );
			}

			if ( 'cancelled' === (string) $row['status'] ) {
				$guest .= ' — ' . __( 'cancelled', 'booking-suite' );
			}

			$rows[] = '<tr>'
				. '<td>' . esc_html( $when ) . '</td>'
				. '<td>' . esc_html( self::apartment_name( (int) $row['room_id'] ) ) . '</td>'
				. '<td>' . esc_html( $guest ) . '</td>'
				. '<td>' . esc_html( number_format_i18n( (float) $row['total_amount'], 2 ) . ' ' . $currency ) . '</td>'
				. '</tr>';
		}

		return implode( "\n", $rows );
	}

	/**
	 * An apartment's name, or a stand-in when the post has gone.
	 *
	 * @param int $room_id The apartment post ID.
	 */
	private static function apartment_name( int $room_id ): string {
		$title = $room_id ? get_the_title( $room_id ) : '';

		return '' !== $title
			? $title
			: sprintf(
				/* translators: %d: the apartment's numeric ID. */
				__( 'Apartment %d', 'booking-suite' ),
				$room_id
			);
	}

	/**
	 * The figures as the placeholders a template uses.
	 *
	 * @param array<string, mixed> $figures From figures().
	 * @return array<string, string>
	 */
	private static function tokens( array $figures ): array {
		$currency = SettingsRepository::currency_symbol();

		$money = static fn( float $amount ): string =>
			number_format_i18n( $amount, 2 ) . ' ' . $currency;

		$date = (string) $figures['date'];

		return array(
			'{{summary_date}}'    => wp_date( (string) get_option( 'date_format', 'j F Y' ), strtotime( $date . ' 12:00:00' ) ),
			'{{bookings_count}}'  => number_format_i18n( (int) $figures['bookings'] ),
			'{{bookings_total}}'  => $money( (float) $figures['bookingTotal'] ),
			'{{apartments}}'      => number_format_i18n( (int) $figures['apartments'] ),
			'{{cancelled_count}}' => number_format_i18n( (int) $figures['cancelled'] ),
			'{{received_total}}'  => $money( (float) $figures['received'] ),
			'{{transfer_total}}'  => $money( (float) $figures['transfer'] ),
			'{{card_total}}'      => $money( (float) $figures['card'] ),
			'{{onsite_count}}'    => number_format_i18n( (int) $figures['onSiteCount'] ),
			'{{onsite_total}}'    => $money( (float) $figures['onSiteTotal'] ),
			'{{site_name}}'       => (string) get_bloginfo( 'name' ),
			'{{bookings_table}}'  => self::appointment_rows( (array) ( $figures['appointments'] ?? array() ) ),
			'{{admin_url}}'       => admin_url( 'admin.php?page=booking-suite-bookings' ),
		);
	}
}
