<?php
/**
 * Moves apartment fields out of wp_postmeta and into mmebk_apartments.
 *
 * Runs once. The old meta is deleted afterwards so there is no second copy to
 * drift out of step.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Migrations;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Schemas\ApartmentsTable;

defined( 'ABSPATH' ) || exit;

final class MetaToTableMigration {

	private const DONE_OPTION = 'bksuite_meta_migrated';

	public static function run(): void {
		global $wpdb;

		if ( get_option( self::DONE_OPTION ) ) {
			return;
		}

		$table = ApartmentsTable::table();

		// The table has to exist before anything can be written to it.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return;
		}

		$posts = get_posts(
			array(
				'post_type'      => ApartmentPostType::POST_TYPE,
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);

		$meta = ApartmentPostType::META;

		foreach ( $posts as $post_id ) {
			$post_id = (int) $post_id;

			ApartmentsRepository::ensure_row( $post_id );

			$images = get_post_meta( $post_id, $meta['images'], true );

			ApartmentsRepository::update(
				$post_id,
				array(
					'capacity'            => (int) ( get_post_meta( $post_id, $meta['capacity'], true ) ?: 1 ),
					'colour'              => (string) ( get_post_meta( $post_id, $meta['colour'], true ) ?: ApartmentsTable::DEFAULT_COLOUR ),
					'cleaning_min'        => (int) ( get_post_meta( $post_id, $meta['cleaning_min'], true ) ?: 30 ),
					'holiday_hesse'       => (bool) get_post_meta( $post_id, $meta['holiday_hesse'], true ),
					'active'              => (bool) get_post_meta( $post_id, $meta['active'], true ),
					'internal_short_link' => (string) get_post_meta( $post_id, $meta['internal_short_link'], true ),
					'booking_short_link'  => (string) get_post_meta( $post_id, $meta['booking_short_link'], true ),
					'images'              => is_array( $images ) ? $images : array(),
				)
			);

			// One source of truth from here on.
			foreach ( $meta as $key ) {
				delete_post_meta( $post_id, $key );
			}
		}

		update_option( self::DONE_OPTION, 1, false );
	}
}
