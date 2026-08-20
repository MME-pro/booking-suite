<?php
/**
 * Publishes one apartment's occupied dates as an iCalendar document.
 *
 * This is the other direction from IcalImporter: what Airbnb and Booking.com
 * read when they subscribe to this site, so a booking taken here closes the
 * same dates over there. Between the two, the site becomes the hub every
 * channel agrees with.
 *
 * Two decisions shape the whole file.
 *
 * The first is that it says WHEN and never WHO. The URL is a bearer token on a
 * public address — that is what it has to be for a portal with no login to read
 * it — so anyone who comes by the link sees the whole file. Guest names, email
 * addresses, references and prices are therefore not in it. Every event says
 * "Reserved" or "Not available", which is exactly what Airbnb's own export
 * says, and is all a portal needs in order to stop selling the date.
 *
 * The second is that whole-day stays are written as DATE values with an
 * exclusive end, which is the dialect every portal speaks and the one
 * IcalParser reads back. A stay that does not cover a night — an hourly
 * booking — is written with its real times instead, in UTC. Rounding those up
 * to a whole day would take a night off sale that nobody has bought.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Schemas\BlocksTable;
use BookingSuite\Backend\Schemas\BookingsTable;
use DateTimeImmutable;
use DateTimeZone;

defined( 'ABSPATH' ) || exit;

final class IcalExporter {

	/**
	 * Booking statuses that take the dates off the market.
	 *
	 * The same set BookingsRepository::is_available() refuses a window for, so
	 * what this site tells a portal matches what it tells a guest. A pending
	 * request is not among them: it holds nothing here, and exporting it would
	 * close dates elsewhere that are still for sale here.
	 */
	private const BLOCKING_STATUSES = array( 'reserved', 'confirmed' );

	/**
	 * How far back the feed reaches, in days.
	 *
	 * Past dates cannot be booked, so they block nothing and are only weight.
	 * A short tail is kept anyway because a portal reading the feed mid-stay
	 * should still see the stay it is in the middle of.
	 */
	private const PAST_DAYS = 30;

	/** How far ahead, in days. Beyond two years nothing is taking bookings. */
	private const FUTURE_DAYS = 730;

	/**
	 * Build the document for one apartment.
	 *
	 * @return string|null The .ics text, or null when there is no such apartment.
	 */
	public static function build( int $apartment_id ): ?string {
		$apartment = ApartmentsRepository::find( $apartment_id );

		if ( null === $apartment ) {
			return null;
		}

		$lines = array(
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//MME-Pro//Booking Suite ' . \BookingSuite\VERSION . '//EN',
			'CALSCALE:GREGORIAN',
			'METHOD:PUBLISH',
			'X-WR-CALNAME:' . self::escape( (string) $apartment['name'] ),
			// Tells a subscribing client how often it is worth coming back.
			// Advisory only — every portal uses its own schedule regardless.
			'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
			'X-PUBLISHED-TTL:PT1H',
		);

		foreach ( self::events( $apartment_id ) as $event ) {
			$lines = array_merge( $lines, self::vevent( $event ) );
		}

		$lines[] = 'END:VCALENDAR';

		/*
		 * CRLF between lines and a trailing one, per RFC 5545. Some readers
		 * tolerate bare newlines; enough do not that it is not worth finding
		 * out which portal is which.
		 */
		return implode( "\r\n", array_map( array( self::class, 'fold' ), $lines ) ) . "\r\n";
	}

	/**
	 * Everything that makes the apartment unavailable, in date order.
	 *
	 * Locks imported from another portal are included. That is the point of a
	 * hub: an Airbnb booking read in this morning is what closes the date on
	 * Booking.com this afternoon. A portal re-reading its own block does no
	 * harm — the dates are already closed there.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function events( int $apartment_id ): array {
		global $wpdb;

		$from = gmdate( 'Y-m-d H:i:s', time() - self::PAST_DAYS * DAY_IN_SECONDS );
		$to   = gmdate( 'Y-m-d H:i:s', time() + self::FUTURE_DAYS * DAY_IN_SECONDS );

		$bookings = BookingsTable::table();
		$blocks   = BlocksTable::table();

		$statuses = implode( ',', array_fill( 0, count( self::BLOCKING_STATUSES ), '%s' ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$booked = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, starts_at, ends_at FROM $bookings
				WHERE room_id = %d
					AND status IN ($statuses)
					AND starts_at < %s
					AND ends_at > %s
				ORDER BY starts_at ASC",
				array_merge( array( $apartment_id ), self::BLOCKING_STATUSES, array( $to, $from ) )
			),
			ARRAY_A
		) ?: array();

		/*
		 * `room_id IS NULL` is the estate-wide Master Lock, which closes every
		 * apartment and so belongs in every apartment's feed. `extra_id IS
		 * NULL` keeps extras out: a projector being booked does not make the
		 * apartment unavailable.
		 */
		$locked = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, starts_at, ends_at FROM $blocks
				WHERE ( room_id = %d OR room_id IS NULL )
					AND extra_id IS NULL
					AND starts_at < %s
					AND ends_at > %s
				ORDER BY starts_at ASC",
				$apartment_id,
				$to,
				$from
			),
			ARRAY_A
		) ?: array();

		$events = array();

		foreach ( $booked as $row ) {
			$events[] = array(
				'uid'       => 'booking-' . (int) $row['id'],
				'summary'   => __( 'Reserved', 'booking-suite' ),
				'starts_at' => (string) $row['starts_at'],
				'ends_at'   => (string) $row['ends_at'],
			);
		}

		foreach ( $locked as $row ) {
			$events[] = array(
				'uid'       => 'block-' . (int) $row['id'],
				// Not the lock's own reason: that is an internal note — "boiler
				// replacement", a guest's name — and this file is public.
				'summary'   => __( 'Not available', 'booking-suite' ),
				'starts_at' => (string) $row['starts_at'],
				'ends_at'   => (string) $row['ends_at'],
			);
		}

		usort(
			$events,
			static fn( array $a, array $b ): int => strcmp( $a['starts_at'], $b['starts_at'] )
		);

		return $events;
	}

	/**
	 * One VEVENT.
	 *
	 * @param array<string, mixed> $event
	 *
	 * @return string[]
	 */
	private static function vevent( array $event ): array {
		$starts_at = (string) $event['starts_at'];
		$ends_at   = (string) $event['ends_at'];

		$start_day = substr( $starts_at, 0, 10 );
		$end_day   = substr( $ends_at, 0, 10 );

		$lines = array(
			'BEGIN:VEVENT',
			'DTSTAMP:' . gmdate( 'Ymd\THis\Z' ),
			// Host-qualified, so this site's events stay distinct from the
			// portal's own inside a calendar holding both.
			'UID:' . $event['uid'] . '@' . self::host(),
		);

		if ( $start_day !== $end_day ) {
			/*
			 * An overnight stay, written the way every portal writes one: whole
			 * days, and an end that is the checkout date rather than the last
			 * night. 7 Oct → 8 Oct is the night of the 7th.
			 */
			$lines[] = 'DTSTART;VALUE=DATE:' . str_replace( '-', '', $start_day );
			$lines[] = 'DTEND;VALUE=DATE:' . str_replace( '-', '', $end_day );
		} else {
			// Inside one day: the hours are the whole of what was sold, so they
			// are what gets published.
			$lines[] = 'DTSTART:' . self::utc( $starts_at );
			$lines[] = 'DTEND:' . self::utc( $ends_at );
		}

		$lines[] = 'SUMMARY:' . self::escape( (string) $event['summary'] );
		// Says "this time is busy" to any reader that distinguishes the two.
		$lines[] = 'TRANSP:OPAQUE';
		$lines[] = 'STATUS:CONFIRMED';
		$lines[] = 'END:VEVENT';

		return $lines;
	}

	/**
	 * A stored wall-clock timestamp as a UTC stamp.
	 *
	 * Bookings and locks are stored in the site's own reckoning, so the zone
	 * has to be applied before the time means anything to a reader elsewhere.
	 */
	private static function utc( string $value ): string {
		$at = DateTimeImmutable::createFromFormat(
			'Y-m-d H:i:s',
			$value,
			wp_timezone()
		);

		if ( false === $at ) {
			return gmdate( 'Ymd\THis\Z' );
		}

		return $at->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Ymd\THis\Z' );
	}

	private static function host(): string {
		$host = (string) wp_parse_url( home_url( '/' ), PHP_URL_HOST );

		return '' !== $host ? $host : 'booking-suite';
	}

	/**
	 * Escape a TEXT value, as RFC 5545 requires.
	 */
	private static function escape( string $value ): string {
		$value = str_replace(
			array( '\\', ';', ',' ),
			array( '\\\\', '\\;', '\\,' ),
			$value
		);

		return str_replace( array( "\r\n", "\n", "\r" ), '\\n', $value );
	}

	/**
	 * Fold a line to 75 octets, continuing with a leading space.
	 *
	 * Counted in octets rather than characters, and cut on UTF-8 boundaries: a
	 * split multi-byte character would be a corrupt file, and an apartment
	 * named with an umlaut is the ordinary case here rather than the exotic one.
	 */
	private static function fold( string $line ): string {
		if ( 75 >= strlen( $line ) ) {
			return $line;
		}

		$out       = '';
		$current   = 0;
		$limit     = 75;
		$remaining = $line;

		while ( '' !== $remaining ) {
			$take = min( $limit, strlen( $remaining ) );

			// Walk back off a continuation byte so a character is never split.
			while ( $take > 1 && 0x80 === ( ord( $remaining[ $take ] ?? "\0" ) & 0xC0 ) ) {
				$take--;
			}

			$out       .= ( 0 === $current ? '' : "\r\n " ) . substr( $remaining, 0, $take );
			$remaining  = (string) substr( $remaining, $take );
			$current++;

			// Continuation lines carry a leading space, which counts too.
			$limit = 74;
		}

		return $out;
	}
}
