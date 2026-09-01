<?php
/**
 * Data access for the booking history.
 *
 * Write-once: there is a record() and no update(). That is the point of the
 * table — a history that can be edited is not evidence of anything — and it is
 * why every method here either appends or reads.
 *
 * Recording is done from the REPOSITORIES that own the change, not from the
 * controllers that ask for it. A booking's price is rewritten from the REST
 * update, from the settlement arithmetic, and from the hourly sweep; hanging
 * the history off each caller means the day someone adds a fourth, the trail
 * quietly stops being complete. There is one function that writes to the
 * bookings table, so that is where the record is taken.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BookingEventsTable;

defined( 'ABSPATH' ) || exit;

final class BookingEventsRepository {

	/**
	 * Booking columns worth remembering.
	 *
	 * Deliberately not every column. `updated_at` changes on every write and
	 * says nothing. `currency` cannot change. And `customer_id` is an internal
	 * foreign key: it moves when a guest record is merged or re-matched by
	 * email, which is bookkeeping this system does to itself — "Guest 3 → 7"
	 * is not something anyone can act on, and the guest's name is on the
	 * booking either way.
	 *
	 * What is left is what a guest or an operator might actually disagree
	 * about later: which apartment, which dates, how many people, what it
	 * costs, where the booking stands, and what they wrote on it.
	 */
	private const TRACKED = array(
		'room_id',
		'status',
		'payment_status',
		'guests',
		'starts_at',
		'ends_at',
		'total_amount',
		'notes',
	);

	/**
	 * Append one event.
	 *
	 * Deliberately forgiving: history is a record OF the work, never a
	 * condition of it. If this table is missing — an install that has not run
	 * the upgrade yet — the booking must still save, so the write is allowed to
	 * fail quietly rather than take the operator's change down with it.
	 *
	 * @param int                  $booking_id The booking it belongs to.
	 * @param string               $event      One of BookingEventsTable::EVENTS.
	 * @param array{payment_id?: int, changes?: array<string, array{from: mixed, to: mixed}>, note?: string} $args
	 *
	 * @return int The event id, or 0 when nothing was written.
	 */
	public static function record( int $booking_id, string $event, array $args = array() ): int {
		global $wpdb;

		if ( $booking_id <= 0 || ! in_array( $event, BookingEventsTable::EVENTS, true ) ) {
			return 0;
		}

		$changes = $args['changes'] ?? array();

		/*
		 * An "update" that changed nothing is not history, it is noise — and
		 * re-saving a booking form without touching a field is a normal thing
		 * to do. Events that are not about field changes still record.
		 */
		if ( BookingEventsTable::UPDATED === $event && ! $changes ) {
			return 0;
		}

		$actor = self::actor();

		$inserted = $wpdb->insert(
			BookingEventsTable::table(),
			array(
				'booking_id' => $booking_id,
				'payment_id' => empty( $args['payment_id'] ) ? null : (int) $args['payment_id'],
				'event'      => $event,
				'actor_id'   => $actor['id'],
				'actor_name' => $actor['name'],
				'changes'    => $changes ? (string) wp_json_encode( $changes ) : null,
				'note'       => isset( $args['note'] ) ? (string) $args['note'] : null,
				'created_at' => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%d', '%s', '%s', '%s', '%s' )
		);

		return false === $inserted ? 0 : (int) $wpdb->insert_id;
	}

	/**
	 * Who is making the change.
	 *
	 * A booking taken on the website has no logged-in user, and neither does
	 * the hourly sweep that expires stale requests. Both are worth telling
	 * apart from a person, so they get named rather than left blank.
	 *
	 * @return array{id: int, name: string}
	 */
	private static function actor(): array {
		$id = get_current_user_id();

		if ( $id > 0 ) {
			$user = wp_get_current_user();

			return array(
				'id'   => $id,
				'name' => (string) ( $user->display_name ?: $user->user_login ),
			);
		}

		return array(
			'id'   => 0,
			'name' => wp_doing_cron()
				? __( 'Scheduled task', 'booking-suite' )
				: __( 'Website', 'booking-suite' ),
		);
	}

	/**
	 * What changed between two raw booking rows.
	 *
	 * Compared as strings, because $wpdb hands back everything as a string and
	 * a float that has been round-tripped through the database will not match
	 * the float that was sent to it. Money is normalised to two places first,
	 * so 250 and 250.00 are the same price rather than a change of one.
	 *
	 * @param array<string, mixed> $before The row as it was.
	 * @param array<string, mixed> $after  The values being written.
	 *
	 * @return array<string, array{from: string, to: string}> Field => from/to.
	 */
	public static function diff( array $before, array $after ): array {
		$changes = array();

		foreach ( self::TRACKED as $column ) {
			if ( ! array_key_exists( $column, $after ) ) {
				continue;
			}

			$from = self::normalise( $column, $before[ $column ] ?? null );
			$to   = self::normalise( $column, $after[ $column ] );

			if ( $from === $to ) {
				continue;
			}

			$changes[ $column ] = array(
				'from' => $from,
				'to'   => $to,
			);
		}

		return $changes;
	}

	/**
	 * One value, in the form both sides of a comparison can be read in.
	 *
	 * @param string $column The column being compared.
	 * @param mixed  $value  Its value on one side.
	 *
	 * @return string The comparable form.
	 */
	private static function normalise( string $column, $value ): string {
		if ( null === $value ) {
			return '';
		}

		if ( 'total_amount' === $column ) {
			return number_format( (float) $value, 2, '.', '' );
		}

		return (string) $value;
	}

	/**
	 * A booking's history, newest first.
	 *
	 * @param int $booking_id The booking.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function for_booking( int $booking_id ): array {
		global $wpdb;

		$table = BookingEventsTable::table();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE booking_id = %d ORDER BY id DESC",
				$booking_id
			),
			ARRAY_A
		) ?: array();

		return array_map(
			static fn( array $row ): array => self::resolve( self::cast( $row ) ),
			$rows
		);
	}

	/**
	 * Put names to the ids a change was recorded with.
	 *
	 * An apartment or a guest is stored as a foreign key, which is the right
	 * thing to record — names change, and a history that said "Studio" would
	 * quietly become wrong the day the apartment was renamed. It is also
	 * useless on screen: "7 → 9" tells an operator nothing. So the raw values
	 * stay exactly as they were written and a readable form is added beside
	 * them, resolved fresh on every read.
	 *
	 * @param array<string, mixed> $event One cast event.
	 *
	 * @return array<string, mixed> The event, with labels where they exist.
	 */
	private static function resolve( array $event ): array {
		$resolvers = array(
			'room_id' => static fn( string $id ): string =>
				'' === $id ? '' : (string) ( get_the_title( (int) $id ) ?: $id ),
		);

		foreach ( $event['changes'] as $field => $change ) {
			if ( ! isset( $resolvers[ $field ] ) ) {
				continue;
			}

			$event['changes'][ $field ]['fromLabel'] = $resolvers[ $field ]( (string) ( $change['from'] ?? '' ) );
			$event['changes'][ $field ]['toLabel']   = $resolvers[ $field ]( (string) ( $change['to'] ?? '' ) );
		}

		return $event;
	}

	/**
	 * Erase a booking's history.
	 *
	 * Only ever called from the hard delete of the booking itself. History
	 * about a booking that no longer exists is not history, it is orphaned
	 * rows no screen can reach.
	 */
	public static function delete_for_booking( int $booking_id ): void {
		global $wpdb;

		$wpdb->delete( BookingEventsTable::table(), array( 'booking_id' => $booking_id ), array( '%d' ) );
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$changes = json_decode( (string) ( $row['changes'] ?? '' ), true );

		return array(
			'id'        => (int) $row['id'],
			'bookingId' => (int) $row['booking_id'],
			'paymentId' => null === $row['payment_id'] ? null : (int) $row['payment_id'],
			'event'     => (string) $row['event'],
			'actorId'   => (int) $row['actor_id'],
			'actorName' => (string) ( $row['actor_name'] ?? '' ),
			'changes'   => is_array( $changes ) ? $changes : array(),
			'note'      => (string) ( $row['note'] ?? '' ),
			'createdAt' => (string) $row['created_at'],
		);
	}
}
