<?php
/**
 * Data access for availability locks.
 *
 * A lock is a row in `mmebk_blocks`, and the two id columns say what it covers:
 *
 *   room_id = X, extra_id NULL    one apartment
 *   both NULL                     every apartment — the apartment Master Lock
 *   extra_id = X                  one extra
 *
 * An extras Master Lock is written as one row per extra rather than a single
 * "all extras" row, because a row with both columns NULL already means the
 * apartment-wide lock and cannot mean two things. The cost is that extras added
 * afterwards are not covered by an earlier master lock.
 *
 * Locks need no separate enforcement: BookingsRepository::is_available() and
 * ExtrasRepository::availability() both consult this table.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BlocksTable;
use BookingSuite\Backend\Schemas\ExtrasTable;

defined( 'ABSPATH' ) || exit;

final class BlocksRepository {

	/** What a lock covers. */
	public const SCOPE_APARTMENT = 'apartment';

	public const SCOPE_EXTRA = 'extra';

	/**
	 * Locks overlapping a window, soonest first.
	 *
	 * @param string $from  'Y-m-d H:i:s' UTC.
	 * @param string $to    'Y-m-d H:i:s' UTC.
	 * @param string $scope Which side of the board to look at.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function in_window(
		string $from,
		string $to,
		string $scope = self::SCOPE_APARTMENT
	): array {
		global $wpdb;

		return self::query(
			$wpdb->prepare(
				' AND b.starts_at < %s AND b.ends_at > %s',
				$to,
				$from
			),
			$scope
		);
	}

	/**
	 * @param string $scope Which side of the board to look at.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all( string $scope = self::SCOPE_APARTMENT ): array {
		return self::query( '', $scope );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private static function query( string $extra_where, string $scope ): array {
		global $wpdb;

		$blocks = BlocksTable::table();
		$posts  = $wpdb->posts;
		$extras = ExtrasTable::table();

		// The id columns are what separate the two kinds of lock.
		$scope_where = self::SCOPE_EXTRA === $scope
			? 'b.extra_id IS NOT NULL'
			: 'b.extra_id IS NULL';

		$rows = $wpdb->get_results(
			"SELECT b.*, p.post_title AS apartment_name, e.name AS extra_name
			FROM $blocks b
			LEFT JOIN $posts p ON p.ID = b.room_id
			LEFT JOIN $extras e ON e.id = b.extra_id
			WHERE $scope_where" . $extra_where . '
			ORDER BY b.starts_at ASC',
			ARRAY_A
		) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * Extras that are locked for a window, as ids.
	 *
	 * @return array<int, true> Extra id → true, for a cheap lookup.
	 */
	public static function locked_extras( string $from, string $to ): array {
		global $wpdb;

		$blocks = BlocksTable::table();

		$rows = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT extra_id FROM $blocks
				WHERE extra_id IS NOT NULL
					AND starts_at < %s
					AND ends_at > %s",
				$to,
				$from
			)
		) ?: array();

		return array_fill_keys( array_map( 'absint', $rows ), true );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$blocks = BlocksTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $blocks WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Locks one apartment, or the whole property when $apartment_id is null.
	 *
	 * @return int|null The new id, or null when the insert failed.
	 */
	public static function create(
		?int $apartment_id,
		string $starts_at,
		string $ends_at,
		string $reason,
		?int $extra_id = null
	): ?int {
		global $wpdb;

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			BlocksTable::table(),
			array(
				'room_id'    => $apartment_id,
				'extra_id'   => $extra_id,
				'starts_at'  => $starts_at,
				'ends_at'    => $ends_at,
				'reason'     => $reason,
				'created_at' => $now,
				'updated_at' => $now,
			)
		);

		return false === $inserted ? null : (int) $wpdb->insert_id;
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( BlocksTable::table(), array( 'id' => $id ) );
	}

	/**
	 * Bookings already sitting inside a proposed lock.
	 *
	 * Locking does not cancel anything — it stops NEW bookings. Anything
	 * already taken for those dates stays, so the operator is told rather than
	 * left to discover it.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function bookings_inside(
		?int $apartment_id,
		string $starts_at,
		string $ends_at
	): array {
		global $wpdb;

		$bookings = \BookingSuite\Backend\Schemas\BookingsTable::table();
		$posts    = $wpdb->posts;

		$sql = "SELECT b.id, b.reference, b.starts_at, b.ends_at, b.status,
				p.post_title AS apartment_name
			FROM $bookings b
			LEFT JOIN $posts p ON p.ID = b.room_id
			WHERE b.starts_at < %s
				AND b.ends_at > %s
				AND b.status IN ('pending','reserved','confirmed')";

		$params = array( $ends_at, $starts_at );

		if ( null !== $apartment_id ) {
			$sql     .= ' AND b.room_id = %d';
			$params[] = $apartment_id;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare( $sql . ' ORDER BY b.starts_at ASC', ...$params ),
			ARRAY_A
		) ?: array();

		return array_map(
			static fn( array $row ): array => array(
				'id'            => (int) $row['id'],
				'reference'     => (string) ( $row['reference'] ?? '' ),
				'apartmentName' => (string) ( $row['apartment_name'] ?? '' ),
				'status'        => (string) $row['status'],
				'startsAt'      => (string) $row['starts_at'],
				'endsAt'        => (string) $row['ends_at'],
			),
			$rows
		);
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$room_id  = null === $row['room_id'] ? null : (int) $row['room_id'];
		$extra_id = empty( $row['extra_id'] ) ? null : (int) $row['extra_id'];

		return array(
			'id'            => (int) $row['id'],
			'apartmentId'   => $room_id,
			'apartmentName' => (string) ( $row['apartment_name'] ?? '' ),
			'extraId'       => $extra_id,
			'extraName'     => (string) ( $row['extra_name'] ?? '' ),
			'scope'         => $extra_id ? self::SCOPE_EXTRA : self::SCOPE_APARTMENT,
			// Only an apartment lock can be estate-wide; see the class comment.
			'isMaster'      => null === $room_id && null === $extra_id,
			'startsAt'      => (string) $row['starts_at'],
			'endsAt'        => (string) $row['ends_at'],
			'reason'        => (string) ( $row['reason'] ?? '' ),
			'createdAt'     => (string) $row['created_at'],
		);
	}
}
