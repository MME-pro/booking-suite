<?php
/**
 * Database helpers shared by every table definition.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend;

defined( 'ABSPATH' ) || exit;

final class Db {

	/**
	 * Table-name prefix applied on top of WordPress' own $table_prefix.
	 */
	public const PREFIX = 'mmebk_';

	/**
	 * Fully-qualified table name, e.g. 'rooms' → 'wp_mmebk_rooms'.
	 */
	public static function table( string $name ): string {
		global $wpdb;

		return $wpdb->prefix . self::PREFIX . $name;
	}

	/**
	 * Charset/collation clause for CREATE TABLE.
	 */
	public static function collate(): string {
		global $wpdb;

		return $wpdb->get_charset_collate();
	}
}
