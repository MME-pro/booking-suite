<?php
/**
 * Exports every Booking Suite table to a single JSON file.
 *
 * Run from the plugin directory:
 *
 *   php tools/export-mock-data.php
 *   php tools/export-mock-data.php my-fixtures.json
 *
 * Images are exported as attachment ids plus their source URLs, so the
 * importer can re-download them into the destination media library.
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

$target = $argv[1] ?? __DIR__ . '/mock-data.json';

$export = array(
	'generated_at' => gmdate( 'c' ),
	'db_version'   => Installer::DB_VERSION,
	'site_url'     => home_url(),
	'tables'       => array(),
	'attachments'  => array(),
);

$attachment_ids = array();

foreach ( Installer::table_classes() as $class ) {
	$table = $class::table();
	$name  = $class::NAME;

	$rows = $wpdb->get_results( "SELECT * FROM $table", ARRAY_A ) ?: array();

	$export['tables'][ $name ] = $rows;

	printf( '  %-16s %d row(s)%s', $name, count( $rows ), PHP_EOL );

	// Collect attachment ids referenced by JSON image columns.
	foreach ( $rows as $row ) {
		foreach ( array( 'images', 'room_ids' ) as $column ) {
			if ( 'images' !== $column || ! isset( $row[ $column ] ) ) {
				continue;
			}

			$ids = json_decode( (string) $row[ $column ], true );

			if ( is_array( $ids ) ) {
				$attachment_ids = array_merge( $attachment_ids, $ids );
			}
		}
	}
}

foreach ( array_unique( array_map( 'absint', $attachment_ids ) ) as $id ) {
	$url = wp_get_attachment_url( $id );

	if ( ! $url ) {
		continue;
	}

	$export['attachments'][] = array(
		'id'    => $id,
		'url'   => $url,
		'title' => get_the_title( $id ),
		'alt'   => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
	);
}

file_put_contents( $target, wp_json_encode( $export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );

printf(
	'%swrote %s (%d attachments referenced)%s',
	PHP_EOL,
	$target,
	count( $export['attachments'] ),
	PHP_EOL
);
