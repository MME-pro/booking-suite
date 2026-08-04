<?php
/**
 * Moves apartments out of the mmebk_rooms table and into bks_apartment posts.
 *
 * The table is left in place rather than dropped, so the original rows remain
 * recoverable; it simply stops being read. Rows that have already been
 * migrated are skipped, so this is safe to run more than once.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Migrations;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Schemas\PriceRulesTable;
use BookingSuite\Backend\Schemas\RoomsTable;

defined( 'ABSPATH' ) || exit;

final class RoomsToPostsMigration {

	/** Meta key holding the id the apartment used to have in mmebk_rooms. */
	public const LEGACY_ID_META = 'bks_legacy_room_id';

	private const DONE_OPTION = 'bksuite_rooms_migrated';

	public static function run(): void {
		global $wpdb;

		if ( get_option( self::DONE_OPTION ) ) {
			return;
		}

		$table = RoomsTable::table();

		// Nothing to do on a fresh install.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			update_option( self::DONE_OPTION, 1, false );
			return;
		}

		$rows = $wpdb->get_results( "SELECT * FROM $table", ARRAY_A ) ?: array();

		$map = array();

		foreach ( $rows as $row ) {
			$legacy_id = (int) $row['id'];

			$existing = get_posts(
				array(
					'post_type'      => ApartmentPostType::POST_TYPE,
					'post_status'    => 'any',
					'posts_per_page' => 1,
					'fields'         => 'ids',
					'no_found_rows'  => true,
					'meta_query'     => array(
						array(
							'key'   => self::LEGACY_ID_META,
							'value' => (string) $legacy_id,
						),
					),
				)
			);

			if ( $existing ) {
				$map[ $legacy_id ] = (int) $existing[0];
				continue;
			}

			$post_id = wp_insert_post(
				array(
					'post_type'     => ApartmentPostType::POST_TYPE,
					'post_status'   => 'publish',
					'post_title'    => (string) $row['name'],
					'post_content'  => (string) ( $row['description'] ?? '' ),
					'post_date_gmt' => (string) $row['created_at'],
				),
				true
			);

			if ( is_wp_error( $post_id ) ) {
				continue;
			}

			$post_id = (int) $post_id;
			$meta    = ApartmentPostType::META;
			$images  = json_decode( (string) ( $row['images'] ?? '' ), true );
			$images  = is_array( $images ) ? array_map( 'absint', $images ) : array();

			update_post_meta( $post_id, $meta['capacity'], (int) $row['capacity'] );
			update_post_meta( $post_id, $meta['colour'], (string) $row['colour'] );
			update_post_meta( $post_id, $meta['cleaning_min'], (int) $row['cleaning_min'] );
			update_post_meta( $post_id, $meta['holiday_hesse'], (int) $row['holiday_hesse'] );
			update_post_meta( $post_id, $meta['active'], (int) $row['active'] );
			update_post_meta( $post_id, $meta['internal_short_link'], (string) ( $row['internal_short_link'] ?? '' ) );
			update_post_meta( $post_id, $meta['booking_short_link'], (string) ( $row['booking_short_link'] ?? '' ) );
			update_post_meta( $post_id, $meta['images'], $images );
			update_post_meta( $post_id, self::LEGACY_ID_META, $legacy_id );

			if ( $images ) {
				set_post_thumbnail( $post_id, $images[0] );
			}

			$map[ $legacy_id ] = $post_id;
		}

		self::repoint_related_tables( $map );

		update_option( self::DONE_OPTION, 1, false );
	}

	/**
	 * Every table keyed by the old room id now points at the post id.
	 *
	 * @param array<int, int> $map legacy room id => post id
	 */
	private static function repoint_related_tables( array $map ): void {
		global $wpdb;

		if ( ! $map ) {
			return;
		}

		$tables = array( PriceRulesTable::table() );

		foreach ( $tables as $table ) {
			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
				continue;
			}

			foreach ( $map as $legacy_id => $post_id ) {
				if ( $legacy_id === $post_id ) {
					continue;
				}

				$wpdb->update(
					$table,
					array( 'room_id' => $post_id ),
					array( 'room_id' => $legacy_id ),
					array( '%d' ),
					array( '%d' )
				);
			}
		}
	}
}
