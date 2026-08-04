<?php
/**
 * Loads WordPress for the CLI tools in this directory.
 *
 * Walks up from the plugin folder looking for wp-load.php, so the tools work
 * on any install without hardcoded paths.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

define( 'WP_USE_THEMES', false );

$dir = __DIR__;

while ( true ) {
	if ( is_readable( $dir . '/wp-load.php' ) ) {
		require_once $dir . '/wp-load.php';
		break;
	}

	$parent = dirname( $dir );

	if ( $parent === $dir ) {
		exit( 'Could not locate wp-load.php above ' . __DIR__ . PHP_EOL );
	}

	$dir = $parent;
}
