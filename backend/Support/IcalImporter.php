<?php
/**
 * Turns the events of a portal calendar into availability locks.
 *
 * The import is a reconciliation, not an append. Every lock it writes carries
 * the UID of the event it came from, so a second run of the same calendar
 * recognises what the first run wrote and can tell the three cases apart:
 *
 *   the event is new                  → write a lock
 *   the event moved                   → move the lock it already has
 *   a lock's event is gone            → the portal released those dates
 *
 * That last case is the reason the UID is stored at all. Without it a cancelled
 * Airbnb booking would stay blocked on this site forever, and the apartment
 * would quietly stop being bookable for dates nobody holds any more.
 *
 * Only locks this importer wrote are ever touched — matching is on the
 * apartment and the portal, and a lock the operator made by hand carries the
 * source 'manual' and is never in that set.
 *
 * A dry run does the whole comparison and writes nothing, which is what the
 * import screen previews: the report it returns is the same either way, so what
 * the operator is shown before pressing Import is what actually happens.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BlocksRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use WP_Error;

defined( 'ABSPATH' ) || exit;

final class IcalImporter {

	/** What happened, or would happen, to one event. */
	public const ADDED = 'added';

	public const UPDATED = 'updated';

	public const UNCHANGED = 'unchanged';

	public const REMOVED = 'removed';

	public const SKIPPED = 'skipped';

	/** How long to wait on a portal before giving up, in seconds. */
	private const FETCH_TIMEOUT = 20;

	/** Refuse anything larger than this, in bytes — a listing feed is tiny. */
	private const MAX_SIZE = 2097152;

	/**
	 * Read a calendar and apply it to an apartment.
	 *
	 * @param int                  $apartment_id Apartment the calendar belongs to.
	 * @param string               $content      Raw .ics text.
	 * @param array<string, mixed> $options      source, feedId, removeMissing,
	 *                                           skipPast, dryRun.
	 *
	 * @return array<string, mixed>|WP_Error The report, or why nothing was read.
	 */
	public static function import( int $apartment_id, string $content, array $options = array() ) {
		$calendar = IcalParser::parse( $content );

		if ( ! $calendar['valid'] ) {
			return new WP_Error(
				'booking_suite_ical_unreadable',
				__(
					'That file is not a calendar. Export the .ics file from the portal and upload it unchanged.',
					'booking-suite'
				),
				array( 'status' => 400 )
			);
		}

		$apartment = ApartmentsRepository::find( $apartment_id );

		if ( null === $apartment ) {
			return new WP_Error(
				'booking_suite_ical_no_apartment',
				__( 'Choose which apartment the calendar belongs to.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'apartmentId',
				)
			);
		}

		/*
		 * The caller may name the portal — a feed knows its own — but the file
		 * itself is the better authority, so a stated source is only used when
		 * the PRODID gave nothing away.
		 */
		$stated = (string) ( $options['source'] ?? '' );
		$source = 'other' === $calendar['source'] && in_array( $stated, IcalParser::SOURCES, true )
			? $stated
			: $calendar['source'];

		$feed_id        = isset( $options['feedId'] ) ? (int) $options['feedId'] : null;
		$remove_missing = ! empty( $options['removeMissing'] );
		$skip_past      = ! empty( $options['skipPast'] );
		$dry_run        = ! empty( $options['dryRun'] );

		$existing = BlocksRepository::imported( $apartment_id, $source );
		$today    = current_time( 'Y-m-d' ) . ' 00:00:00';

		$rows     = array();
		$seen     = array();
		$conflict = array();

		foreach ( $calendar['events'] as $event ) {
			$row = self::plan( $event, $existing, $skip_past, $today );

			if ( $row['keeps'] ) {
				$seen[ $event['uid'] ] = true;
			}

			/*
			 * A lock does not cancel a booking, it stops new ones — so dates
			 * already sold on this site are reported rather than acted on. That
			 * is a real double booking between two channels and the operator
			 * has to resolve it at one of them.
			 */
			if ( in_array( $row['action'], array( self::ADDED, self::UPDATED ), true ) ) {
				foreach ( BlocksRepository::bookings_inside( $apartment_id, $row['startsAt'], $row['endsAt'] ) as $booking ) {
					$conflict[ $booking['id'] ] = $booking;
				}
			}

			$rows[] = $row;
		}

		// Locks whose event is no longer in the calendar.
		$orphans = array();

		foreach ( $existing as $uid => $lock ) {
			if ( isset( $seen[ $uid ] ) ) {
				continue;
			}

			$orphans[] = $lock;
		}

		if ( ! $dry_run ) {
			self::apply( $rows, $orphans, $apartment_id, $source, $feed_id, $remove_missing );
		}

		return array(
			'apartmentId'   => $apartment_id,
			'apartmentName' => (string) $apartment['name'],
			'source'        => $source,
			'sourceLabel'   => IcalParser::source_label( $source ),
			'calendarName'  => $calendar['calendarName'],
			'producer'      => $calendar['producer'],
			'dryRun'        => $dry_run,
			'removeMissing' => $remove_missing,
			'events'        => $rows,
			// Orphans are always reported; whether they were acted on is what
			// `removeMissing` decides, so the screen can offer the choice with
			// the consequence already on screen.
			'orphans'       => $orphans,
			'conflicts'     => array_values( $conflict ),
			'counts'        => self::counts( $rows, $orphans, $remove_missing ),
		);
	}

	/**
	 * Decide what one event means for the locks already stored.
	 *
	 * The `keeps` flag on the returned row says whether this event still
	 * accounts for the lock stored under its UID. Only a lock nothing accounts
	 * for is an orphan, and only an orphan can be released — which is why a
	 * skipped event is not automatically a released one.
	 *
	 * @param array<string, mixed>                $event
	 * @param array<string, array<string, mixed>> $existing UID → lock.
	 *
	 * @return array<string, mixed>
	 */
	private static function plan( array $event, array $existing, bool $skip_past, string $today ): array {
		$lock = $existing[ $event['uid'] ] ?? null;

		$row = array(
			'uid'      => (string) $event['uid'],
			'summary'  => (string) $event['summary'],
			'startsAt' => (string) $event['startsAt'],
			'endsAt'   => (string) $event['endsAt'],
			'nights'   => (int) $event['nights'],
			'allDay'   => (bool) $event['allDay'],
			'action'   => self::SKIPPED,
			'reason'   => '',
			'note'     => (string) $event['note'],
			'blockId'  => $lock ? (int) $lock['id'] : null,
			'keeps'    => null !== $lock,
		);

		/*
		 * A cancelled event is the portal saying those dates are free again, so
		 * its lock is deliberately left unaccounted for and gets released.
		 */
		if ( IcalParser::STATE_CANCELLED === $event['state'] ) {
			$row['keeps'] = false;

			return $row;
		}

		/*
		 * An event that could not be read is a gap in our understanding, not
		 * news from the portal. Releasing its lock on the strength of a parse
		 * failure would put dates back on sale that may well be sold, so the
		 * lock stays and the row says the event was not understood.
		 */
		if ( IcalParser::STATE_OK !== $event['state'] ) {
			return $row;
		}

		if ( $skip_past && $event['endsAt'] <= $today ) {
			$row['note'] = __( 'Already over.', 'booking-suite' );

			return $row;
		}

		$row['reason'] = self::reason( $event );

		if ( null === $lock ) {
			$row['action'] = self::ADDED;

			return $row;
		}

		$moved = $lock['startsAt'] !== $row['startsAt']
			|| $lock['endsAt'] !== $row['endsAt']
			|| $lock['reason'] !== $row['reason'];

		$row['action'] = $moved ? self::UPDATED : self::UNCHANGED;

		if ( $moved ) {
			$row['note'] = sprintf(
				/* translators: 1: previous start date, 2: previous end date. */
				__( 'Was %1$s to %2$s.', 'booking-suite' ),
				substr( (string) $lock['startsAt'], 0, 10 ),
				substr( (string) $lock['endsAt'], 0, 10 )
			);
		}

		return $row;
	}

	/**
	 * The label the lock carries in the calendar and the availability list.
	 *
	 * The portal's own wording is kept — "Reserved", "CLOSED - Not available" —
	 * because it is the difference between a stay someone booked and dates the
	 * host simply closed, and only the portal knows which.
	 *
	 * @param array<string, mixed> $event
	 */
	private static function reason( array $event ): string {
		$summary = trim( (string) $event['summary'] );

		if ( '' === $summary ) {
			$summary = __( 'Not available', 'booking-suite' );
		}

		// One line only: the reason is shown inline in lists, and Airbnb puts
		// the reservation URL and a phone number into DESCRIPTION.
		$summary = trim( (string) preg_replace( '/\s+/', ' ', $summary ) );

		return substr( $summary, 0, 191 );
	}

	/**
	 * Write the plan.
	 *
	 * @param array<int, array<string, mixed>> $rows
	 * @param array<int, array<string, mixed>> $orphans
	 */
	private static function apply(
		array $rows,
		array $orphans,
		int $apartment_id,
		string $source,
		?int $feed_id,
		bool $remove_missing
	): void {
		foreach ( $rows as $row ) {
			if ( self::ADDED === $row['action'] ) {
				BlocksRepository::create(
					$apartment_id,
					$row['startsAt'],
					$row['endsAt'],
					$row['reason'],
					null,
					$source,
					$feed_id,
					$row['uid']
				);

				continue;
			}

			if ( self::UPDATED === $row['action'] && $row['blockId'] ) {
				BlocksRepository::move(
					(int) $row['blockId'],
					$row['startsAt'],
					$row['endsAt'],
					$row['reason'],
					$feed_id
				);
			}
		}

		if ( ! $remove_missing ) {
			return;
		}

		foreach ( $orphans as $orphan ) {
			BlocksRepository::delete( (int) $orphan['id'] );
		}
	}

	/**
	 * @param array<int, array<string, mixed>> $rows
	 * @param array<int, array<string, mixed>> $orphans
	 *
	 * @return array<string, int>
	 */
	private static function counts( array $rows, array $orphans, bool $remove_missing ): array {
		$tally = static fn( string $action ): int => count(
			array_filter( $rows, static fn( array $row ): bool => $action === $row['action'] )
		);

		return array(
			'total'     => count( $rows ),
			'added'     => $tally( self::ADDED ),
			'updated'   => $tally( self::UPDATED ),
			'unchanged' => $tally( self::UNCHANGED ),
			'skipped'   => $tally( self::SKIPPED ),
			'removed'   => $remove_missing ? count( $orphans ) : 0,
			'orphans'   => count( $orphans ),
		);
	}

	/**
	 * Pull one subscription and apply it.
	 *
	 * A feed is a standing arrangement rather than a one-off file, so it always
	 * reconciles in full: dates the portal has released are released here too.
	 * That is the whole point of subscribing.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public static function sync_feed( int $feed_id, bool $dry_run = false ) {
		$feed = IcalFeedsRepository::find( $feed_id );

		if ( null === $feed ) {
			return new WP_Error(
				'booking_suite_feed_not_found',
				__( 'That calendar subscription no longer exists.', 'booking-suite' ),
				array( 'status' => 404 )
			);
		}

		$content = self::fetch( $feed['url'] );

		if ( is_wp_error( $content ) ) {
			if ( ! $dry_run ) {
				IcalFeedsRepository::record_sync(
					$feed_id,
					IcalFeedsRepository::STATUS_ERROR,
					$content->get_error_message()
				);
			}

			return $content;
		}

		$report = self::import(
			(int) $feed['apartmentId'],
			$content,
			array(
				'source'        => $feed['source'],
				'feedId'        => $feed_id,
				'removeMissing' => true,
				'skipPast'      => true,
				'dryRun'        => $dry_run,
			)
		);

		if ( is_wp_error( $report ) ) {
			if ( ! $dry_run ) {
				IcalFeedsRepository::record_sync(
					$feed_id,
					IcalFeedsRepository::STATUS_ERROR,
					$report->get_error_message()
				);
			}

			return $report;
		}

		if ( ! $dry_run ) {
			IcalFeedsRepository::record_sync(
				$feed_id,
				IcalFeedsRepository::STATUS_OK,
				sprintf(
					/* translators: 1: locks added, 2: locks moved, 3: locks released. */
					__( '%1$d added, %2$d changed, %3$d released.', 'booking-suite' ),
					$report['counts']['added'],
					$report['counts']['updated'],
					$report['counts']['removed']
				),
				$report['counts']['total']
			);
		}

		$report['feedId']   = $feed_id;
		$report['feedName'] = $feed['name'];

		return $report;
	}

	/**
	 * Pull every switched-on subscription. The scheduled sync calls this.
	 *
	 * One feed failing does not stop the others: a portal being briefly down
	 * should not mean the rest of the calendars go stale with it.
	 *
	 * @return array<int, array<string, mixed>> One result row per feed.
	 */
	public static function sync_all(): array {
		$results = array();

		foreach ( IcalFeedsRepository::due() as $feed ) {
			$report = self::sync_feed( (int) $feed['id'] );

			$results[] = is_wp_error( $report )
				? array(
					'feedId'  => (int) $feed['id'],
					'name'    => (string) $feed['name'],
					'ok'      => false,
					'message' => $report->get_error_message(),
				)
				: array(
					'feedId'  => (int) $feed['id'],
					'name'    => (string) $feed['name'],
					'ok'      => true,
					'counts'  => $report['counts'],
					'message' => '',
				);
		}

		return $results;
	}

	/**
	 * Download a calendar.
	 *
	 * @return string|WP_Error The document, or why it could not be had.
	 */
	public static function fetch( string $url ) {
		$url = trim( $url );

		// Portals hand out webcal:// links, which is http(s) wearing a scheme
		// that tells the operating system to open a calendar app. Nothing else
		// about the request differs.
		if ( str_starts_with( strtolower( $url ), 'webcal://' ) ) {
			$url = 'https://' . substr( $url, 9 );
		}

		if ( ! wp_http_validate_url( $url ) ) {
			return new WP_Error(
				'booking_suite_ical_bad_url',
				__( 'That is not a usable calendar address.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'url',
				)
			);
		}

		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout'    => self::FETCH_TIMEOUT,
				'user-agent' => 'BookingSuite/' . \BookingSuite\VERSION . '; ' . home_url( '/' ),
				'headers'    => array( 'Accept' => 'text/calendar, text/plain;q=0.8, */*;q=0.5' ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'booking_suite_ical_unreachable',
				sprintf(
					/* translators: %s: the underlying network error. */
					__( 'The calendar could not be reached: %s', 'booking-suite' ),
					$response->get_error_message()
				),
				array( 'status' => 502 )
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code > 299 ) {
			return new WP_Error(
				'booking_suite_ical_http_error',
				sprintf(
					/* translators: %d: HTTP status code. */
					__( 'The portal answered with status %d. Check the calendar link is still valid.', 'booking-suite' ),
					$code
				),
				array( 'status' => 502 )
			);
		}

		$body = (string) wp_remote_retrieve_body( $response );

		if ( strlen( $body ) > self::MAX_SIZE ) {
			return new WP_Error(
				'booking_suite_ical_too_large',
				__( 'That calendar is too large to be a listing export.', 'booking-suite' ),
				array( 'status' => 400 )
			);
		}

		return $body;
	}
}
