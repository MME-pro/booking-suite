<?php
/**
 * Plugin bootstrapper.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite;

use BookingSuite\Backend\APIs\ApartmentsController;
use BookingSuite\Backend\APIs\BlocksController;
use BookingSuite\Backend\APIs\BookingsController;
use BookingSuite\Backend\APIs\CustomersController;
use BookingSuite\Backend\APIs\EmailTemplatesController;
use BookingSuite\Backend\APIs\ExtrasController;
use BookingSuite\Backend\APIs\GuideController;
use BookingSuite\Backend\APIs\HolidaysController;
use BookingSuite\Backend\APIs\IcalController;
use BookingSuite\Backend\APIs\PaymentsController;
use BookingSuite\Backend\Installer;
use BookingSuite\Backend\Support\BookingLifecycle;
use BookingSuite\Backend\Support\IcalFeed;
use BookingSuite\Backend\Support\IcalSync;
use BookingSuite\Backend\Support\Pwa;
use BookingSuite\Backend\Migrations\MetaToTableMigration;
use BookingSuite\Backend\Migrations\RoomsToPostsMigration;
use BookingSuite\Backend\Integrations\ElementorTags;
use BookingSuite\Backend\PostTypes\ApartmentMetaBox;
use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Frontend\Admin\Assets as AdminAssets;
use BookingSuite\Frontend\Admin\Menu as AdminMenu;
use BookingSuite\Backend\APIs\PublicApartmentsController;
use BookingSuite\Backend\APIs\PublicBookingController;
use BookingSuite\Backend\APIs\ReportsController;
use BookingSuite\Backend\APIs\SettingsController;
use BookingSuite\Backend\APIs\SystemController;
use BookingSuite\Frontend\Site\Assets as SiteAssets;
use BookingSuite\Frontend\Site\Shortcodes as SiteShortcodes;
use BookingSuite\Backend\Support\Updater;

defined( 'ABSPATH' ) || exit;

/**
 * Central entry point — wires up the plugin's hooks.
 */
final class Plugin {

	private static ?Plugin $instance = null;

	private bool $booted = false;

	private function __construct() {}

	public static function instance(): Plugin {
		return self::$instance ??= new self();
	}

	/**
	 * Register hooks. Safe to call more than once.
	 */
	public function boot(): void {
		if ( $this->booted ) {
			return;
		}

		$this->booted = true;

		ApartmentPostType::register();
		ElementorTags::register();

		if ( is_admin() ) {
			ApartmentMetaBox::register();
		}

		add_action( 'init', array( $this, 'load_textdomain' ) );
		add_action( 'admin_init', array( Installer::class, 'maybe_upgrade' ) );

		// The recurring pull of subscribed portal calendars.
		IcalSync::register();

		// And the hourly sweep that settles bookings whose window has closed.
		BookingLifecycle::register();

		// And the public URL the portals read this site's own calendar from.
		// Not admin-only: nothing fetching it is ever logged in.
		IcalFeed::register();

		// The manifest and worker that let the admin be installed to a phone.
		Pwa::register();

		/*
		 * Updates come from this plugin's own GitHub releases, since it will
		 * never be on wordpress.org. Registered outside is_admin(): the
		 * quarter-hourly check runs under cron, which is not an admin request.
		 */
		Updater::register();

		// Runs after the post type exists, and only until it has migrated.
		add_action( 'admin_init', array( RoomsToPostsMigration::class, 'run' ), 20 );
		add_action( 'admin_init', array( MetaToTableMigration::class, 'run' ), 21 );

		ApartmentsController::register();
		BlocksController::register();
		BookingsController::register();
		CustomersController::register();
		EmailTemplatesController::register();
		ExtrasController::register();
		GuideController::register();
		HolidaysController::register();
		IcalController::register();
		PaymentsController::register();
		ReportsController::register();
		SettingsController::register();
		SystemController::register();
		PublicApartmentsController::register();
		PublicBookingController::register();

		if ( is_admin() ) {
			AdminMenu::register();
			AdminAssets::register();
		}

		SiteAssets::register();
		SiteShortcodes::register();
	}

	public function load_textdomain(): void {
		load_plugin_textdomain(
			TEXT_DOMAIN,
			false,
			dirname( plugin_basename( PLUGIN_FILE ) ) . '/languages'
		);
	}
}
