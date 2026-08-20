<?php
/**
 * The Apartment post type.
 *
 * Apartments are posts, not rows in a custom table: that is what gives each
 * one a real permalink, an Elementor single template, and dynamic tags that
 * read the fields below. Everything else — price rules, bookings, blocks —
 * references the post id.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\PostTypes;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;

defined( 'ABSPATH' ) || exit;

final class ApartmentPostType {

	public const POST_TYPE = 'bks_apartment';

	/**
	 * Legacy meta keys.
	 *
	 * These fields now live in the mmebk_apartments table; the map is kept so
	 * MetaToTableMigration can find and clear the old values.
	 */
	public const META = array(
		'capacity'            => 'bks_capacity',
		'colour'              => 'bks_colour',
		'cleaning_min'        => 'bks_cleaning_min',
		'holiday_hesse'       => 'bks_holiday_hesse',
		'active'              => 'bks_active',
		'internal_short_link' => 'bks_internal_short_link',
		'booking_short_link'  => 'bks_booking_short_link',
		'images'              => 'bks_gallery',
	);

	public static function register(): void {
		add_action( 'init', array( self::class, 'register_post_type' ) );

		// Keep the table in step with posts created or removed outside the
		// Booking Suite screens — straight from wp-admin, an import, or WP-CLI.
		add_action( 'wp_insert_post', array( self::class, 'on_insert' ), 10, 2 );
		add_action( 'deleted_post', array( self::class, 'on_delete' ), 10, 2 );
	}

	/**
	 * @param int      $post_id Post id.
	 * @param \WP_Post $post    Post object.
	 */
	public static function on_insert( int $post_id, $post ): void {
		if ( ! $post instanceof \WP_Post || self::POST_TYPE !== $post->post_type ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		ApartmentsRepository::ensure_row( $post_id );
	}

	/**
	 * @param int      $post_id Post id.
	 * @param \WP_Post $post    Post object.
	 */
	public static function on_delete( int $post_id, $post = null ): void {
		if ( $post instanceof \WP_Post && self::POST_TYPE !== $post->post_type ) {
			return;
		}

		ApartmentsRepository::delete_row( $post_id );

		/*
		 * The calendar subscriptions go too. They are the one thing hanging off
		 * an apartment that keeps working after it is gone: the scheduled sync
		 * would go on pulling them, writing locks for a room nobody can see,
		 * and no screen lists them because every screen lists them under the
		 * apartment they belong to.
		 */
		IcalFeedsRepository::delete_for_apartment( $post_id );
	}

	public static function register_post_type(): void {
		register_post_type(
			self::POST_TYPE,
			array(
				'labels'             => array(
					'name'               => __( 'Apartments', 'booking-suite' ),
					'singular_name'      => __( 'Apartment', 'booking-suite' ),
					'add_new_item'       => __( 'Add Apartment', 'booking-suite' ),
					'edit_item'          => __( 'Edit Apartment', 'booking-suite' ),
					'new_item'           => __( 'New Apartment', 'booking-suite' ),
					'view_item'          => __( 'View Apartment', 'booking-suite' ),
					'search_items'       => __( 'Search Apartments', 'booking-suite' ),
					'not_found'          => __( 'No apartments found.', 'booking-suite' ),
					'all_items'          => __( 'All Apartments', 'booking-suite' ),
				),
				'public'             => true,
				'has_archive'        => true,
				'publicly_queryable' => true,
				'show_ui'            => true,

				// Reachable from the Booking Suite menu rather than its own
				// top-level entry, so the admin keeps one home.
				'show_in_menu'       => false,
				'show_in_rest'       => true,
				'menu_icon'          => 'dashicons-building',
				'rewrite'            => array( 'slug' => 'apartment' ),
				'supports'           => array(
					'title',
					'editor',
					'excerpt',
					'thumbnail',
					'revisions',
					'custom-fields',
					'page-attributes',
				),
			)
		);
	}

}
