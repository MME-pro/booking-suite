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

	public const SLUG_PAYMENTS = 'booking-suite-payments';

	public const SLUG_CUSTOMERS = 'booking-suite-customers';

	public const SLUG_REPORTS = 'booking-suite-reports';

	public const SLUG_AVAILABILITY = 'booking-suite-availability';

	public const SLUG_CALENDAR = 'booking-suite-calendar';

	public const SLUG_EXTRAS = 'booking-suite-extras';

	public const SLUG_EMAILS = 'booking-suite-email-templates';

	public const SLUG_GUIDE = 'booking-suite-guide';

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
			self::SLUG_PAYMENTS   => 'payments',
			self::SLUG_CUSTOMERS  => 'customers',
			self::SLUG_REPORTS    => 'reports',
			self::SLUG_EMAILS     => 'emailTemplates',
			self::SLUG_GUIDE      => 'guide',
			self::SLUG_CALENDAR   => 'calendar',
			self::SLUG_AVAILABILITY => 'availability',
			self::SLUG_EXTRAS     => 'extras',
			self::SLUG_SETTINGS   => 'settings',
		);
	}

	/**
	 * The plugin's own menu mark: a white outlined box on a blue rounded tile.
	 *
	 * The box is drawn at 24×24 and scaled to 14, which is why the stroke is
	 * set to 3 — it lands at 1.75 once scaled, matching the weight of the
	 * reference. Colours are baked in rather than left to the menu: WordPress
	 * recolours a *dashicon* per state, but renders a data-URI icon as a
	 * background image and leaves its colours alone, which is the trade for
	 * having more than one of them.
	 */
	private const ICON_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>"
		. "<rect width='24' height='24' rx='6' fill='#4361ee'/>"
		. "<g transform='translate(5 5) scale(.5833)' fill='none' stroke='#fff'"
		. " stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>"
		. "<path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z'/>"
		. "<path d='m3.3 7 8.7 5 8.7-5'/>"
		. "<path d='M12 22V12'/>"
		. '</g></svg>';

	public static function register(): void {
		add_action( 'admin_menu', array( self::class, 'add_pages' ) );
		add_action( 'admin_head', array( self::class, 'menu_icon_css' ) );
	}

	/**
	 * The menu icon as a data URI.
	 *
	 * Base64 rather than percent-encoded: WordPress only treats an icon as an
	 * SVG — giving it the right sizing class — when the value begins with
	 * `data:image/svg+xml;base64,`.
	 */
	private static function icon_uri(): string {
		return 'data:image/svg+xml;base64,' . base64_encode( self::ICON_SVG );
	}

	public static function add_pages(): void {
		add_menu_page(
			__( 'Booking Suite', 'booking-suite' ),
			__( 'Booking Suite', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_DASHBOARD,
			array( self::class, 'render_root' ),
			self::icon_uri(),
			26
		);

		/*
		 * WordPress lists sub-menu items in the order they are registered, so
		 * the order of these calls IS the order of the menu:
		 *
		 *   Dashboard · Bookings · Apartments · Calendar · Availability ·
		 *   Calendar Sync · Customers · Extras · Payments ·
		 *   Reports & Analytics · Email Templates · Settings · User Guide
		 */

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
			__( 'Calendar', 'booking-suite' ),
			__( 'Calendar', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_CALENDAR,
			array( self::class, 'render_root' )
		);

		// Next to the calendar: the same month, from the other direction.
		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Availability', 'booking-suite' ),
			__( 'Availability', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_AVAILABILITY,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Customers', 'booking-suite' ),
			__( 'Customers', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_CUSTOMERS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Extras', 'booking-suite' ),
			__( 'Extras', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_EXTRAS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Payments', 'booking-suite' ),
			__( 'Payments', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_PAYMENTS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Reports & Analytics', 'booking-suite' ),
			__( 'Reports & Analytics', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_REPORTS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Email Templates', 'booking-suite' ),
			__( 'Email Templates', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_EMAILS,
			array( self::class, 'render_root' )
		);

		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Settings', 'booking-suite' ),
			__( 'Settings', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_SETTINGS,
			array( self::class, 'render_root' )
		);

		// Last: reference material, not daily work.
		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'User Guide', 'booking-suite' ),
			__( 'User Guide', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_GUIDE,
			array( self::class, 'render_root' )
		);

		/*
		 * The React apartments screen is registered last and then hidden, so it
		 * never takes a place in the menu — only one Apartments entry belongs
		 * there, and that is the post list above. Registering it at all keeps
		 * it reachable by URL, so the Dashboard's "Manage apartments" button
		 * and existing bookmarks go on working.
		 */
		add_submenu_page(
			self::SLUG_DASHBOARD,
			__( 'Apartments', 'booking-suite' ),
			__( 'Apartments', 'booking-suite' ),
			self::CAPABILITY,
			self::SLUG_APARTMENTS,
			array( self::class, 'render_root' )
		);

		remove_submenu_page( self::SLUG_DASHBOARD, self::SLUG_APARTMENTS );
	}

	/**
	 * Keeps the icon at full strength.
	 *
	 * WordPress dims menu icons at rest and brightens them for the current
	 * screen, which is right for a one-colour glyph but leaves a coloured mark
	 * looking washed out. The colours are the point here, so they stay put.
	 */
	public static function menu_icon_css(): void {
		printf(
			'<style id="booking-suite-menu-icon">
				#toplevel_page_%1$s .wp-menu-image,
				#toplevel_page_%1$s .wp-menu-image img {
					opacity: 1;
				}
			</style>',
			esc_attr( self::SLUG_DASHBOARD )
		);
	}

	/**
	 * Mount point for the React app. Kept deliberately bare — no markup is
	 * rendered server-side.
	 */
	public static function render_root(): void {
		echo '<div id="booking-suite-admin-root" class="bks-root"></div>';
	}
}
