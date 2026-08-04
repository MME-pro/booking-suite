<?php
/**
 * Data access for extras.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\ExtrasTable;

defined( 'ABSPATH' ) || exit;

final class ExtrasRepository {

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
			"SELECT * FROM $table WHERE active = 1 ORDER BY name ASC",
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
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		return array(
			'id'          => (int) $row['id'],
			'name'        => (string) $row['name'],
			'description' => (string) ( $row['description'] ?? '' ),
			'price'       => (float) $row['price'],
			'stock'       => null === $row['stock'] ? null : (int) $row['stock'],
			'active'      => (bool) $row['active'],
		);
	}
}
