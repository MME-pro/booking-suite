<?php
/**
 * Data access for price rules.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\PriceRulesTable;

defined( 'ABSPATH' ) || exit;

final class PriceRulesRepository {

	/**
	 * Cheapest publicly bookable price per room.
	 *
	 * Prices live inside the `package_prices` JSON object, so the minimum is
	 * worked out in PHP rather than SQL. Rooms without a public rule are
	 * absent from the result.
	 *
	 * @param int[] $room_ids
	 *
	 * @return array<int, float> room id => lowest price
	 */
	public static function lowest_public_price( array $room_ids ): array {
		global $wpdb;

		$room_ids = array_values( array_filter( array_map( 'absint', $room_ids ) ) );

		if ( ! $room_ids ) {
			return array();
		}

		$table        = PriceRulesTable::table();
		$placeholders = implode( ',', array_fill( 0, count( $room_ids ), '%d' ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT room_id, package_prices FROM $table
				WHERE active = 1 AND visibility = 'public' AND room_id IN ($placeholders)",
				$room_ids
			),
			ARRAY_A
		) ?: array();

		$lowest = array();

		foreach ( $rows as $row ) {
			$room_id = (int) $row['room_id'];
			$prices  = json_decode( (string) $row['package_prices'], true );

			if ( ! is_array( $prices ) ) {
				continue;
			}

			// Accept both { "1_night": 89 } and [ 89, 120 ].
			foreach ( $prices as $price ) {
				if ( ! is_numeric( $price ) ) {
					continue;
				}

				$price = (float) $price;

				if ( $price <= 0 ) {
					continue;
				}

				if ( ! isset( $lowest[ $room_id ] ) || $price < $lowest[ $room_id ] ) {
					$lowest[ $room_id ] = $price;
				}
			}
		}

		return $lowest;
	}
}
