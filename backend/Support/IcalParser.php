<?php
/**
 * Reads an iCalendar (.ics) document into plain event rows.
 *
 * This is deliberately a reader for *portal availability exports* — the files
 * Airbnb, Booking.com and Vrbo publish for a listing — and not a general
 * RFC 5545 implementation. Those exports are a narrow dialect: a flat list of
 * VEVENTs, almost always whole-day, one per blocked or booked stay, with no
 * attendees, alarms or repetition. Everything here is aimed at reading that
 * dialect exactly right rather than reading everything approximately.
 *
 * Where a file does step outside the dialect the event is kept and marked
 * rather than dropped, so the import screen can say "this one was not
 * understood" instead of quietly importing fewer dates than the file held.
 *
 * A note on time zones, because it decides where every imported lock lands.
 * Whole-day dates in iCalendar carry no zone at all: DTSTART:20261007 means the
 * 7th of October wherever you are reading it, which is also exactly what the
 * operator means when they lock the 7th by hand in the Availability screen. So
 * a date is stored as it is written, with no shifting. Only an event that names
 * an actual instant — a UTC stamp, or a TZID — is converted, and it is
 * converted into the site's own time zone so that it lines up with the locks
 * around it rather than with Greenwich.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use DateTimeImmutable;
use DateTimeZone;
use Throwable;

defined( 'ABSPATH' ) || exit;

final class IcalParser {

	/** An event this reader understood and can import. */
	public const STATE_OK = 'ok';

	/** Understood, but the portal says it no longer applies. */
	public const STATE_CANCELLED = 'cancelled';

	/** Read, but describing something outside the portal dialect. */
	public const STATE_UNSUPPORTED = 'unsupported';

	/** Malformed — a missing or unreadable start, or an end before its start. */
	public const STATE_INVALID = 'invalid';

	/**
	 * Portals this reader can name on sight, as PRODID fragment → source key.
	 *
	 * Matched against the whole PRODID line in lower case, so the fragments
	 * only have to be distinctive rather than complete.
	 */
	private const PRODUCERS = array(
		'airbnb'      => 'airbnb',
		'booking.com' => 'booking',
		'vrbo'        => 'vrbo',
		'homeaway'    => 'vrbo',
		'expedia'     => 'expedia',
		'tripadvisor' => 'tripadvisor',
		'fewo-direkt' => 'vrbo',
		'google'      => 'google',
	);

	/** Every source key this plugin recognises, including the fallbacks. */
	public const SOURCES = array(
		'airbnb',
		'booking',
		'vrbo',
		'expedia',
		'tripadvisor',
		'google',
		'other',
	);

	/**
	 * Human label for a source key.
	 */
	public static function source_label( string $source ): string {
		$labels = array(
			'airbnb'      => __( 'Airbnb', 'booking-suite' ),
			'booking'     => __( 'Booking.com', 'booking-suite' ),
			'vrbo'        => __( 'Vrbo', 'booking-suite' ),
			'expedia'     => __( 'Expedia', 'booking-suite' ),
			'tripadvisor' => __( 'Tripadvisor', 'booking-suite' ),
			'google'      => __( 'Google Calendar', 'booking-suite' ),
			'other'       => __( 'Calendar', 'booking-suite' ),
			'manual'      => __( 'Manual', 'booking-suite' ),
		);

		return $labels[ $source ] ?? $labels['other'];
	}

	/**
	 * Every source as a value/label pair, for a dropdown.
	 *
	 * @return array<int, array{value: string, label: string}>
	 */
	public static function source_options(): array {
		return array_map(
			static fn( string $source ): array => array(
				'value' => $source,
				'label' => self::source_label( $source ),
			),
			self::SOURCES
		);
	}

	/**
	 * Read a document.
	 *
	 * @param string $content Raw .ics text.
	 *
	 * @return array{
	 *     valid: bool,
	 *     source: string,
	 *     producer: string,
	 *     calendarName: string,
	 *     events: array<int, array<string, mixed>>
	 * }
	 */
	public static function parse( string $content ): array {
		$lines = self::unfold( $content );

		$producer      = '';
		$calendar_name = '';
		$events        = array();

		// The properties of the VEVENT currently being read, or null between
		// them. Anything outside a VEVENT belongs to the calendar itself.
		$current = null;

		foreach ( $lines as $line ) {
			$property = self::property( $line );

			if ( null === $property ) {
				continue;
			}

			[ $name, $params, $value ] = $property;

			if ( 'BEGIN' === $name && 'VEVENT' === strtoupper( $value ) ) {
				$current = array();
				continue;
			}

			if ( 'END' === $name && 'VEVENT' === strtoupper( $value ) ) {
				if ( null !== $current ) {
					$events[] = self::event( $current );
				}

				$current = null;
				continue;
			}

			if ( null === $current ) {
				if ( 'PRODID' === $name ) {
					$producer = $value;
				}

				if ( 'X-WR-CALNAME' === $name ) {
					$calendar_name = self::unescape( $value );
				}

				continue;
			}

			/*
			 * Repeated properties keep the first occurrence. None of the
			 * properties read below may legally appear twice in one VEVENT, so
			 * a second is a malformed file rather than extra information.
			 */
			if ( ! isset( $current[ $name ] ) ) {
				$current[ $name ] = array(
					'value'  => $value,
					'params' => $params,
				);
			}
		}

		return array(
			// A document with no VEVENT at all is not necessarily broken — an
			// empty calendar is a legitimate export — but one that never even
			// said BEGIN:VCALENDAR is not an .ics file.
			'valid'        => (bool) preg_grep( '/^BEGIN:VCALENDAR/i', $lines ),
			'source'       => self::detect_source( $producer ),
			'producer'     => $producer,
			'calendarName' => $calendar_name,
			'events'       => $events,
		);
	}

	/**
	 * Which portal wrote this file, from its PRODID.
	 */
	public static function detect_source( string $producer ): string {
		$haystack = strtolower( $producer );

		foreach ( self::PRODUCERS as $fragment => $source ) {
			if ( str_contains( $haystack, $fragment ) ) {
				return $source;
			}
		}

		return 'other';
	}

	/**
	 * Split a document into logical lines.
	 *
	 * iCalendar wraps long lines at 75 octets and marks the continuation with a
	 * leading space or tab, so a UID can easily arrive across two physical
	 * lines. Unfolding has to happen before anything else looks at the text.
	 *
	 * @return string[]
	 */
	private static function unfold( string $content ): array {
		// Strip a UTF-8 byte-order mark: Booking.com's export carries one, and
		// it would otherwise become part of the first property name.
		$content = preg_replace( '/^\xEF\xBB\xBF/', '', $content ) ?? $content;

		$content = str_replace( array( "\r\n", "\r" ), "\n", $content );
		$content = preg_replace( '/\n[ \t]/', '', $content ) ?? $content;

		return array_values(
			array_filter(
				array_map( 'trim', explode( "\n", $content ) ),
				static fn( string $line ): bool => '' !== $line
			)
		);
	}

	/**
	 * Split one line into name, parameters and value.
	 *
	 * The name is separated from the value by the first colon that is not
	 * inside a quoted parameter — quoting matters because a TZID is routinely
	 * written as TZID="Europe/Berlin" and, on some producers, contains a colon.
	 *
	 * @return array{0: string, 1: array<string, string>, 2: string}|null
	 */
	private static function property( string $line ): ?array {
		$in_quotes = false;
		$split     = -1;

		for ( $i = 0, $length = strlen( $line ); $i < $length; $i++ ) {
			$char = $line[ $i ];

			if ( '"' === $char ) {
				$in_quotes = ! $in_quotes;
				continue;
			}

			if ( ':' === $char && ! $in_quotes ) {
				$split = $i;
				break;
			}
		}

		if ( $split < 1 ) {
			return null;
		}

		$head  = substr( $line, 0, $split );
		$value = substr( $line, $split + 1 );

		$parts  = self::split_unquoted( $head, ';' );
		$name   = strtoupper( trim( (string) array_shift( $parts ) ) );
		$params = array();

		foreach ( $parts as $part ) {
			$pair = explode( '=', $part, 2 );

			if ( 2 === count( $pair ) ) {
				$params[ strtoupper( trim( $pair[0] ) ) ] = trim( $pair[1], " \t\"" );
			}
		}

		return array( $name, $params, $value );
	}

	/**
	 * Explode on a delimiter, ignoring delimiters inside double quotes.
	 *
	 * @return string[]
	 */
	private static function split_unquoted( string $subject, string $delimiter ): array {
		$parts     = array();
		$buffer    = '';
		$in_quotes = false;

		for ( $i = 0, $length = strlen( $subject ); $i < $length; $i++ ) {
			$char = $subject[ $i ];

			if ( '"' === $char ) {
				$in_quotes = ! $in_quotes;
			}

			if ( $char === $delimiter && ! $in_quotes ) {
				$parts[] = $buffer;
				$buffer  = '';
				continue;
			}

			$buffer .= $char;
		}

		$parts[] = $buffer;

		return $parts;
	}

	/**
	 * Turn the collected properties of one VEVENT into an event row.
	 *
	 * @param array<string, array{value: string, params: array<string, string>}> $properties
	 *
	 * @return array<string, mixed>
	 */
	private static function event( array $properties ): array {
		$read = static fn( string $key ): string => (string) ( $properties[ $key ]['value'] ?? '' );

		$summary     = self::unescape( $read( 'SUMMARY' ) );
		$description = self::unescape( $read( 'DESCRIPTION' ) );

		$start = isset( $properties['DTSTART'] )
			? self::moment( $properties['DTSTART']['value'], $properties['DTSTART']['params'] )
			: null;

		$event = array(
			'uid'         => substr( trim( $read( 'UID' ) ), 0, 191 ),
			'summary'     => $summary,
			'description' => $description,
			'status'      => strtoupper( trim( $read( 'STATUS' ) ) ),
			'allDay'      => (bool) ( $start['allDay'] ?? false ),
			'startsAt'    => '',
			'endsAt'      => '',
			'nights'      => 0,
			'state'       => self::STATE_OK,
			'note'        => '',
		);

		if ( null === $start ) {
			$event['state'] = self::STATE_INVALID;
			$event['note']  = __( 'The event has no readable start date.', 'booking-suite' );

			return self::with_fallback_uid( $event );
		}

		$end = isset( $properties['DTEND'] )
			? self::moment( $properties['DTEND']['value'], $properties['DTEND']['params'] )
			: null;

		if ( null === $end ) {
			$end = self::implied_end( $start, $read( 'DURATION' ) );
		}

		$event['startsAt'] = $start['at']->format( 'Y-m-d H:i:s' );
		$event['endsAt']   = $end['at']->format( 'Y-m-d H:i:s' );
		$event['nights']   = (int) max(
			0,
			floor( ( $end['at']->getTimestamp() - $start['at']->getTimestamp() ) / DAY_IN_SECONDS )
		);

		if ( $end['at'] <= $start['at'] ) {
			$event['state'] = self::STATE_INVALID;
			$event['note']  = __( 'The event ends before it starts.', 'booking-suite' );

			return self::with_fallback_uid( $event );
		}

		/*
		 * A repeating event would have to be expanded into its occurrences to
		 * be imported honestly, and portal exports never produce one. Reading
		 * only the first occurrence would block a single week of what the
		 * calendar says is every week, so it is reported instead.
		 */
		if ( isset( $properties['RRULE'] ) ) {
			$event['state'] = self::STATE_UNSUPPORTED;
			$event['note']  = __( 'Repeating events are not imported.', 'booking-suite' );

			return self::with_fallback_uid( $event );
		}

		// TRANSP:TRANSPARENT is the calendar way of saying "this does not make
		// me busy" — a note in the feed rather than a stay.
		if ( 'TRANSPARENT' === strtoupper( trim( $read( 'TRANSP' ) ) ) ) {
			$event['state'] = self::STATE_CANCELLED;
			$event['note']  = __( 'Marked as free time, not a booking.', 'booking-suite' );

			return self::with_fallback_uid( $event );
		}

		if ( 'CANCELLED' === $event['status'] ) {
			$event['state'] = self::STATE_CANCELLED;
			$event['note']  = __( 'Cancelled in the source calendar.', 'booking-suite' );
		}

		return self::with_fallback_uid( $event );
	}

	/**
	 * Give an event without a UID a stable one of its own.
	 *
	 * The UID is how a re-import recognises a lock it wrote last time. Every
	 * portal sends one, but a hand-made file may not, and without something in
	 * its place each import would add the same dates again. Hashing the window
	 * and the summary gives a value that stays the same as long as the event
	 * does — which is the only property actually being relied on.
	 *
	 * @param array<string, mixed> $event
	 *
	 * @return array<string, mixed>
	 */
	private static function with_fallback_uid( array $event ): array {
		if ( '' === $event['uid'] ) {
			$event['uid'] = 'bks-' . md5(
				$event['startsAt'] . '|' . $event['endsAt'] . '|' . $event['summary']
			);
		}

		return $event;
	}

	/**
	 * Read one DTSTART/DTEND value.
	 *
	 * @param array<string, string> $params
	 *
	 * @return array{at: DateTimeImmutable, allDay: bool}|null
	 */
	private static function moment( string $value, array $params ): ?array {
		$value = trim( $value );
		$site  = wp_timezone();

		// A whole day, which is what a portal availability export is made of.
		// Kept exactly as written — see the note at the top of this file.
		if ( 'DATE' === strtoupper( $params['VALUE'] ?? '' ) || preg_match( '/^\d{8}$/', $value ) ) {
			$at = self::make( substr( $value, 0, 8 ) . 'T000000', $site );

			return null === $at ? null : array(
				'at'     => $at,
				'allDay' => true,
			);
		}

		// An instant in UTC.
		if ( preg_match( '/^(\d{8}T\d{6})Z$/', $value, $matches ) ) {
			$at = self::make( $matches[1], new DateTimeZone( 'UTC' ) );

			return null === $at ? null : array(
				'at'     => $at->setTimezone( $site ),
				'allDay' => false,
			);
		}

		if ( ! preg_match( '/^\d{8}T\d{6}$/', $value ) ) {
			return null;
		}

		/*
		 * A local time. TZID names the zone it was written in; an unknown or
		 * absent one is a floating time, which means "this clock reading,
		 * wherever it is read" — so the site's own zone is the right reading.
		 */
		$zone = $site;

		if ( '' !== ( $params['TZID'] ?? '' ) ) {
			try {
				$zone = new DateTimeZone( $params['TZID'] );
			} catch ( Throwable $error ) {
				$zone = $site;
			}
		}

		$at = self::make( $value, $zone );

		return null === $at ? null : array(
			'at'     => $at->setTimezone( $site ),
			'allDay' => false,
		);
	}

	private static function make( string $stamp, DateTimeZone $zone ): ?DateTimeImmutable {
		$at = DateTimeImmutable::createFromFormat( 'Ymd\THis', $stamp, $zone );

		return false === $at ? null : $at;
	}

	/**
	 * The end of an event that did not state one.
	 *
	 * RFC 5545 gives two answers and they differ: with a DURATION the end is
	 * start plus that duration; with neither, a whole-day event lasts one day
	 * and a timed event lasts no time at all. The last case is left as-is and
	 * comes back out of event() as invalid, which is the honest result — a
	 * zero-length event blocks nothing.
	 *
	 * @param array{at: DateTimeImmutable, allDay: bool} $start
	 *
	 * @return array{at: DateTimeImmutable, allDay: bool}
	 */
	private static function implied_end( array $start, string $duration ): array {
		$seconds = self::duration_seconds( $duration );

		if ( $seconds > 0 ) {
			return array(
				'at'     => $start['at']->modify( '+' . $seconds . ' seconds' ),
				'allDay' => $start['allDay'],
			);
		}

		if ( $start['allDay'] ) {
			return array(
				'at'     => $start['at']->modify( '+1 day' ),
				'allDay' => true,
			);
		}

		return $start;
	}

	/**
	 * An ISO 8601 duration in seconds, e.g. P2D or PT3H30M. 0 when unreadable.
	 */
	private static function duration_seconds( string $duration ): int {
		$pattern = '/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i';

		if ( '' === trim( $duration ) || ! preg_match( $pattern, trim( $duration ), $matches ) ) {
			return 0;
		}

		$seconds = ( (int) ( $matches[2] ?? 0 ) ) * WEEK_IN_SECONDS
			+ ( (int) ( $matches[3] ?? 0 ) ) * DAY_IN_SECONDS
			+ ( (int) ( $matches[4] ?? 0 ) ) * HOUR_IN_SECONDS
			+ ( (int) ( $matches[5] ?? 0 ) ) * MINUTE_IN_SECONDS
			+ ( (int) ( $matches[6] ?? 0 ) );

		// A negative duration puts the end before the start; event() rejects it.
		return '-' === ( $matches[1] ?? '' ) ? -$seconds : $seconds;
	}

	/**
	 * Undo the escaping iCalendar applies to text values.
	 *
	 * Order matters: the backslash pair must be resolved last, or the "\\n" in
	 * a literal backslash followed by an n would turn into a line break.
	 */
	private static function unescape( string $value ): string {
		$value = str_replace(
			array( '\\N', '\\n', '\\,', '\\;' ),
			array( "\n", "\n", ',', ';' ),
			$value
		);

		return str_replace( '\\\\', '\\', $value );
	}
}
