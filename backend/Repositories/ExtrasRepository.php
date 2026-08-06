<?php
/**
 * Data access for extras.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\ExtraBookingTable;
use BookingSuite\Backend\Schemas\ExtrasTable;

defined( 'ABSPATH' ) || exit;

final class ExtrasRepository {

	/**
	 * Guests see extras in `sort_order`, then alphabetically — so a run of
	 * extras left at the default 0 still comes out in a stable order.
	 */
	private const ORDER_BY = 'ORDER BY sort_order ASC, name ASC';

	/**
	 * Every extra, active or not. The admin list needs both.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all(): array {
		global $wpdb;

		$table = ExtrasTable::table();

		$rows = $wpdb->get_results(
			"SELECT * FROM $table " . self::ORDER_BY,
			ARRAY_A
		) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * Active extras, optionally limited to those offered with one apartment.
	 *
	 * `room_ids` holds a JSON array; an empty array means "every apartment",
	 * so the filtering happens in PHP rather than in SQL.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function active( ?int $apartment_id = null ): array {
		global $wpdb;

		$table = ExtrasTable::table();

		$rows = $wpdb->get_results(
			"SELECT * FROM $table WHERE active = 1 " . self::ORDER_BY,
			ARRAY_A
		) ?: array();

		$extras = array();

		foreach ( $rows as $row ) {
			$room_ids = json_decode( (string) $row['room_ids'], true );
			$room_ids = is_array( $room_ids ) ? array_map( 'absint', $room_ids ) : array();

			if ( $apartment_id && $room_ids && ! in_array( $apartment_id, $room_ids, true ) ) {
				continue;
			}

			$extras[] = self::cast( $row );
		}

		return $extras;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$table = ExtrasTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ? self::cast( $row ) : null;
	}

	/**
	 * @param array<string, mixed> $data Column values, already sanitised.
	 *
	 * @return array<string, mixed>|null The stored extra, or null on failure.
	 */
	public static function create( array $data ): ?array {
		global $wpdb;

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			ExtrasTable::table(),
			self::columns( $data ) + array(
				'created_at' => $now,
				'updated_at' => $now,
			)
		);

		if ( ! $inserted ) {
			return null;
		}

		return self::find( (int) $wpdb->insert_id );
	}

	/**
	 * @param int                  $id
	 * @param array<string, mixed> $data Only the columns being changed.
	 *
	 * @return array<string, mixed>|null The stored extra, or null when missing.
	 */
	public static function update( int $id, array $data ): ?array {
		global $wpdb;

		if ( null === self::find( $id ) ) {
			return null;
		}

		$columns = self::columns( $data );

		if ( $columns ) {
			$wpdb->update(
				ExtrasTable::table(),
				$columns + array( 'updated_at' => current_time( 'mysql', true ) ),
				array( 'id' => $id )
			);
		}

		return self::find( $id );
	}

	/**
	 * Deletes an extra and unlinks it from any booking it was attached to.
	 *
	 * The line on a past booking goes with it; the booking keeps its stored
	 * total, which was fixed at the time it was taken.
	 */
	public static function delete( int $id ): bool {
		global $wpdb;

		$wpdb->delete( ExtraBookingTable::table(), array( 'extra_id' => $id ) );

		return (bool) $wpdb->delete( ExtrasTable::table(), array( 'id' => $id ) );
	}

	/**
	 * Booking statuses that hold an extra's stock.
	 *
	 * A completed booking has handed its extras back even if its window has
	 * not fully elapsed, so it is not counted.
	 */
	private const HOLDING_STATUSES = array( 'pending', 'reserved', 'confirmed' );

	/**
	 * How many of each extra are free for a given window.
	 *
	 * Stock is NOT a counter that depletes: it is how many of the thing exist.
	 * A projector booked for Tuesday afternoon is unavailable then and free
	 * again afterwards, so availability is always asked about a window rather
	 * than read off a running total. That is also why nothing decrements when
	 * a booking is taken — the stay ending IS the restock.
	 *
	 * Two windows collide when each starts before the other ends.
	 *
	 * @param string   $starts_at          'Y-m-d H:i:s' UTC.
	 * @param string   $ends_at            'Y-m-d H:i:s' UTC.
	 * @param int|null $ignore_booking_id  Excluded from the tally, so editing a
	 *                                     booking does not clash with itself.
	 *
	 * @return array<int, int|null> Extra id → units free, or null for unlimited.
	 */
	public static function availability(
		string $starts_at,
		string $ends_at,
		?int $ignore_booking_id = null
	): array {
		global $wpdb;

		$link     = ExtraBookingTable::table();
		$bookings = BookingsTable::table();

		$placeholders = implode(
			', ',
			array_fill( 0, count( self::HOLDING_STATUSES ), '%s' )
		);

		$params = array_merge(
			array( $ends_at, $starts_at ),
			self::HOLDING_STATUSES
		);

		$sql = "SELECT l.extra_id, SUM(l.quantity) AS held
			FROM $link l
			INNER JOIN $bookings b ON b.id = l.booking_id
			WHERE b.starts_at < %s
				AND b.ends_at > %s
				AND b.status IN ($placeholders)";

		if ( $ignore_booking_id ) {
			$sql     .= ' AND b.id <> %d';
			$params[] = $ignore_booking_id;
		}

		$sql .= ' GROUP BY l.extra_id';

		$rows = $wpdb->get_results(
			$wpdb->prepare( $sql, ...$params ),
			ARRAY_A
		) ?: array();

		$held = array();

		foreach ( $rows as $row ) {
			$held[ (int) $row['extra_id'] ] = (int) $row['held'];
		}

		/*
		 * A locked extra is not "low on stock", it is off the board — out for
		 * repair, lent out, whatever the reason says. So a lock overrides the
		 * count entirely, including for extras with unlimited stock, which no
		 * amount of arithmetic would otherwise take out of circulation.
		 */
		$locked = BlocksRepository::locked_extras( $starts_at, $ends_at );

		$available = array();

		foreach ( self::all() as $extra ) {
			$id = (int) $extra['id'];

			if ( isset( $locked[ $id ] ) ) {
				$available[ $id ] = 0;

				continue;
			}

			$available[ $id ] = null === $extra['stock']
				? null
				: max( 0, (int) $extra['stock'] - ( $held[ $id ] ?? 0 ) );
		}

		return $available;
	}

	/**
	 * How many of each extra have been booked, keyed by extra id.
	 *
	 * This is the all-time tally the admin list shows, NOT availability — see
	 * availability() for what can actually be booked in a window.
	 *
	 * @return array<int, int>
	 */
	public static function booked_quantities(): array {
		global $wpdb;

		$table = ExtraBookingTable::table();

		$rows = $wpdb->get_results(
			"SELECT extra_id, SUM(quantity) AS booked FROM $table GROUP BY extra_id",
			ARRAY_A
		) ?: array();

		$counts = array();

		foreach ( $rows as $row ) {
			$counts[ (int) $row['extra_id'] ] = (int) $row['booked'];
		}

		return $counts;
	}

	/**
	 * Maps the component shape onto columns, skipping anything not supplied so
	 * a partial update stays partial.
	 *
	 * @param array<string, mixed> $data
	 *
	 * @return array<string, mixed>
	 */
	private static function columns( array $data ): array {
		$columns = array();

		if ( array_key_exists( 'name', $data ) ) {
			$columns['name'] = (string) $data['name'];
		}

		if ( array_key_exists( 'description', $data ) ) {
			$columns['description'] = (string) $data['description'];
		}

		if ( array_key_exists( 'price', $data ) ) {
			$columns['price'] = (float) $data['price'];
		}

		// NULL is meaningful here: it is how "unlimited" is stored.
		if ( array_key_exists( 'stock', $data ) ) {
			$columns['stock'] = null === $data['stock'] ? null : (int) $data['stock'];
		}

		if ( array_key_exists( 'image_url', $data ) ) {
			$columns['image_url'] = (string) $data['image_url'];
		}

		if ( array_key_exists( 'sort_order', $data ) ) {
			$columns['sort_order'] = (int) $data['sort_order'];
		}

		if ( array_key_exists( 'room_ids', $data ) ) {
			$columns['room_ids'] = wp_json_encode(
				array_map( 'absint', (array) $data['room_ids'] )
			);
		}

		if ( array_key_exists( 'active', $data ) ) {
			$columns['active'] = $data['active'] ? 1 : 0;
		}

		return $columns;
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$room_ids = json_decode( (string) ( $row['room_ids'] ?? '' ), true );

		return array(
			'id'          => (int) $row['id'],
			'name'        => (string) $row['name'],
			'description' => (string) ( $row['description'] ?? '' ),
			'price'       => (float) $row['price'],
			'stock'       => null === $row['stock'] ? null : (int) $row['stock'],
			'image_url'   => (string) ( $row['image_url'] ?? '' ),
			'sort_order'  => (int) ( $row['sort_order'] ?? 0 ),
			'room_ids'    => is_array( $room_ids ) ? array_map( 'absint', $room_ids ) : array(),
			'active'      => (bool) $row['active'],
		);
	}
}
