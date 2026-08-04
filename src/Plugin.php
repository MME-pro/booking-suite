<?php
/**
 * Plugin bootstrapper.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite;

use BookingSuite\Backend\APIs\ApartmentsController;
use BookingSuite\Backend\APIs\BookingsController;
use BookingSuite\Backend\Installer;
use BookingSuite\Backend\Migrations\MetaToTableMigration;
use BookingSuite\Backend\Migrations\RoomsToPostsMigration;
use BookingSuite\Backend\Integrations\ElementorTags;
use BookingSuite\Backend\PostTypes\ApartmentMetaBox;
use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Frontend\Admin\Assets as AdminAssets;
use BookingSuite\Frontend\Admin\Menu as AdminMenu;
use BookingSuite\Backend\APIs\PublicApartmentsController;
use BookingSuite\Backend\APIs\PublicBookingController;
use BookingSuite\Backend\APIs\SettingsController;
use BookingSuite\Frontend\Site\Assets as SiteAssets;
use BookingSuite\Frontend\Site\Shortcodes as SiteShortcodes;

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

		// Runs after the post type exists, and only until it has migrated.
		add_action( 'admin_init', array( RoomsToPostsMigration::class, 'run' ), 20 );
		add_action( 'admin_init', array( MetaToTableMigration::class, 'run' ), 21 );

		ApartmentsController::register();
		BookingsController::register();
		SettingsController::register();
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
