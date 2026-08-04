<?php
/**
 * Imports a JSON file produced by export-mock-data.php.
 *
 *   php tools/import-mock-data.php                 # append to existing rows
 *   php tools/import-mock-data.php mock-data.json --fresh   # empty tables first
 *   php tools/import-mock-data.php mock-data.json --with-images
 *
 * --fresh        TRUNCATEs every Booking Suite table before importing.
 * --with-images  Side-loads the referenced attachments from the source site
 *                and rewrites the `images` columns to the new ids. Needs the
 *                source site to still be reachable.
 *
 * Rows keep their original ids, so relations between them survive.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

if ( 'cli' !== PHP_SAPI ) {
	exit( 'Run this from the command line.' . PHP_EOL );
}

require_once __DIR__ . '/bootstrap.php';

use BookingSuite\Backend\Installer;

global $wpdb;

$args    = array_slice( $argv, 1 );
$flags   = array_values( array_filter( $args, static fn( $a ) => str_starts_with( $a, '--' ) ) );
$paths   = array_values( array_filter( $args, static fn( $a ) => ! str_starts_with( $a, '--' ) ) );
$source  = $paths[0] ?? __DIR__ . '/mock-data.json';
$fresh   = in_array( '--fresh', $flags, true );
$images  = in_array( '--with-images', $flags, true );

if ( ! is_readable( $source ) ) {
	exit( 'Cannot read ' . $source . PHP_EOL );
}

$data = json_decode( (string) file_get_contents( $source ), true );

if ( ! is_array( $data ) || ! isset( $data['tables'] ) ) {
	exit( 'That file is not a Booking Suite export.' . PHP_EOL );
}

// Make sure the tables exist before writing to them.
Installer::install();

$classes = array();

foreach ( Installer::table_classes() as $class ) {
	$classes[ $class::NAME ] = $class;
}

/**
 * Old attachment id => new attachment id, filled in when --with-images runs.
 *
 * @var array<int, int> $image_map
 */
$image_map = array();

if ( $images && ! empty( $data['attachments'] ) ) {
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	foreach ( $data['attachments'] as $attachment ) {
		$new_id = media_sideload_image( $attachment['url'], 0, $attachment['title'] ?? null, 'id' );

		if ( is_wp_error( $new_id ) ) {
			printf( '  ! could not fetch %s (%s)%s', $attachment['url'], $new_id->get_error_message(), PHP_EOL );
			continue;
		}

		if ( ! empty( $attachment['alt'] ) ) {
			update_post_meta( $new_id, '_wp_attachment_image_alt', $attachment['alt'] );
		}

		$image_map[ (int) $attachment['id'] ] = (int) $new_id;

		printf( '  image %d → %d%s', $attachment['id'], $new_id, PHP_EOL );
	}
}

foreach ( $data['tables'] as $name => $rows ) {
	if ( ! isset( $classes[ $name ] ) ) {
		printf( '  ? skipping unknown table "%s"%s', $name, PHP_EOL );
		continue;
	}

	$table = $classes[ $name ]::table();

	if ( $fresh ) {
		$wpdb->query( "TRUNCATE TABLE $table" );
	}

	$imported = 0;

	foreach ( $rows as $row ) {
		// Point image references at the newly side-loaded attachments.
		if ( $image_map && isset( $row['images'] ) ) {
			$ids = json_decode( (string) $row['images'], true );

			if ( is_array( $ids ) ) {
				$row['images'] = wp_json_encode(
					array_values(
						array_map(
							static fn( $id ) => $image_map[ (int) $id ] ?? (int) $id,
							$ids
						)
					)
				);
			}
		}

		if ( false !== $wpdb->insert( $table, $row ) ) {
			++$imported;
		} elseif ( $wpdb->last_error ) {
			printf( '  ! %s: %s%s', $name, $wpdb->last_error, PHP_EOL );
		}
	}

	printf( '  %-16s %d/%d row(s)%s', $name, $imported, count( $rows ), PHP_EOL );
}

echo PHP_EOL . 'done' . PHP_EOL;
