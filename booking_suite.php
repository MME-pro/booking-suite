<?php
/**
 * Plugin Name:       Booking Suite
 * Plugin URI:        https://mme-pro.de/
 * Description:       Booking Suite plugin scaffold.
 * Version:           0.7.0
 * Requires at least: 6.6
 * Requires PHP:      8.1
 * Author:            MME-Pro
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       booking-suite
 * Domain Path:       /languages
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite;

defined( 'ABSPATH' ) || exit;

const VERSION     = '0.7.0';
const PREFIX      = 'bksuite_';
const TEXT_DOMAIN = 'booking-suite';

define( 'BookingSuite\PLUGIN_FILE', __FILE__ );
define( 'BookingSuite\PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BookingSuite\PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * PSR-4 autoloader.
 *
 * BookingSuite\Backend\*        → backend/*
 * BookingSuite\Frontend\Admin\* → frontend/admin/*
 * BookingSuite\Frontend\Site\*  → frontend/site/*
 * BookingSuite\*                → src/*
 *
 * Table definitions under backend/schemas/ are named after their table
 * (mmebk_rooms.php), not their class, so Installer requires them directly.
 */
spl_autoload_register(
	static function ( string $class ): void {
		$prefix = __NAMESPACE__ . '\\';

		if ( ! str_starts_with( $class, $prefix ) ) {
			return;
		}

		$relative = substr( $class, strlen( $prefix ) );

		/*
		 * Schema files are named after their table (mmebk_rooms.php) rather
		 * than their class, so a class name cannot be mapped to a path. Load
		 * the whole directory the first time a schema class is requested.
		 */
		if ( str_starts_with( $relative, 'Backend\\Schemas\\' ) ) {
			foreach ( glob( PLUGIN_DIR . 'backend/schemas/*.php' ) ?: array() as $schema ) {
				require_once $schema;
			}

			return;
		}

		$roots = array(
			'Backend\\'         => 'backend/',
			'Frontend\\Admin\\' => 'frontend/admin/',
			'Frontend\\Site\\'  => 'frontend/site/',
		);

		$dir = 'src/';

		foreach ( $roots as $sub_namespace => $folder ) {
			if ( str_starts_with( $relative, $sub_namespace ) ) {
				$dir      = $folder;
				$relative = substr( $relative, strlen( $sub_namespace ) );
				break;
			}
		}

		$path = PLUGIN_DIR . $dir . str_replace( '\\', '/', $relative ) . '.php';

		if ( is_readable( $path ) ) {
			require_once $path;
		}
	}
);

/**
 * Boot the plugin once all other plugins are loaded.
 */
add_action(
	'plugins_loaded',
	static function (): void {
		Plugin::instance()->boot();
	}
);

register_activation_hook(
	__FILE__,
	static function (): void {
		/*
		 * update_option, not add_option: the latter only writes when the option
		 * is absent, so an install activated at 0.1.0 would keep reporting 0.1.0
		 * through every release afterwards.
		 */
		update_option( PREFIX . 'version', VERSION, false );
		Backend\Installer::install();
		Backend\Support\IcalSync::schedule();
		Backend\Support\BookingLifecycle::schedule();

		// So the calendar export URL resolves from the first request onwards.
		Backend\Support\IcalFeed::add_rewrite();
		flush_rewrite_rules();
	}
);

register_deactivation_hook(
	__FILE__,
	static function (): void {
		// Nothing should keep pulling portal calendars for a plugin that is
		// switched off; the subscriptions themselves stay in the database.
		Backend\Support\IcalSync::unschedule();

		// Nor should a switched-off plugin keep asking GitHub about itself.
		Backend\Support\Updater::unschedule();

		// A plugin that is off has no business rewriting booking statuses.
		Backend\Support\BookingLifecycle::unschedule();
		flush_rewrite_rules();
	}
);
