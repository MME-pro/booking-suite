<?php
/**
 * Admin menu registration.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Frontend\Admin;

use BookingSuite\Backend\PostTypes\ApartmentPostType;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the "Booking Suite" menu and its sub-pages.
 *
 * Every page renders the same empty root element; the React app decides what
 * to show from the `page` value handed over in Assets::enqueue().
 */
final class Menu {

	/**
	 * Top-level slug. Doubles as the Dashboard page slug so WordPress does not
	 * add a sub-menu entry duplicating the parent title.
	 */
	public const SLUG_DASHBOARD = 'booking-suite';

	public const SLUG_APARTMENTS = 'booking-suite-apartments';

	public const SLUG_BOOKINGS = 'booking-suite-bookings';

	public const SLUG_SETTINGS = 'booking-suite-settings';

	public const CAPABILITY = 'manage_options';

	/**
	 * Screen ids that host the React app, mapped to the view the app renders.
	 *
	 * @return array<string, string>
	 */
	public static function pages(): array {
		return array(
			self::SLUG_DASHBOARD  => 'dashboard',
			self::SLUG_APARTMENTS => 'apartments',
			self::SLUG_BOOKINGS   => 'bookings',
			self::SLUG_SETTINGS   => 'settings',
		);
	}

	public static function register(): void {
		add_action( 'admin_menu', array( self::class, 'add_pages' ) );
	}

	public static function add_pages(): void {
		add_menu_page(
			__( 'Booking Suite', 'booking-suite' ),
			__( 'Booking Suite', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_DASHBOARD,
			array( self::class, 'render_root' ),
			'dashicons-calendar-alt',
			26
		);

		// Renames the auto-generated first sub-menu item from "Booking Suite"
		// to "Dashboard" instead of leaving a duplicate of the parent.
		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Dashboard', 'booking-suite' ),
			__( 'Dashboard', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_DASHBOARD,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Apartments', 'booking-suite' ),
			__( 'Apartments', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_APARTMENTS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Bookings', 'booking-suite' ),
			__( 'Bookings', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_BOOKINGS,
			array( self::class, 'render_root' )
		);

		// Apartments are posts, so their pages are designed in the editor —
		// this is the way through to Elementor.
		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Apartments', 'booking-suite' ),
			__( 'Apartments', 'booking-suite' ),
			self::CAPABILITY,
			'edit.php?post_type=' . ApartmentPostType::POST_TYPE
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Settings', 'booking-suite' ),
			__( 'Settings', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_SETTINGS,
			array( self::class, 'render_root' )
		);

		// Only one Apartments entry belongs in the menu, and that is the post
		// list above. The React apartments screen is registered earlier and then
		// hidden rather than dropped: it stays reachable by URL, so the
		// Dashboard's "Manage apartments" button and existing bookmarks keep
		// working.
		remove_submenu_page( self::SLUG_DASHBOARD, self::SLUG_APARTMENTS );
	}

	/**
	 * Mount point for the React app. Kept deliberately bare — no markup is
	 * rendered server-side.
	 */
	public static function render_root(): void {
		echo '<div id="booking-suite-admin-root" class="bks-root"></div>';
	}
}
