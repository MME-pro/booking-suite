<?php
/**
 * Plugin settings, stored in mmebk_settings.
 *
 * Values are read through here rather than hardcoded, so the Settings screen
 * can change them without touching the code that consumes them.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\SettingsTable;

defined( 'ABSPATH' ) || exit;

final class SettingsRepository {

	public const CURRENCY = 'currency';

	/*
	 * There was a LANGUAGE setting here. It was removed: the plugin follows the
	 * WordPress site language through its own translation catalogue, and a
	 * second control could only ever disagree with Settings → General. Any row
	 * left in the settings table under 'language' is simply ignored.
	 */

	/** Hours the base rate covers. */
	public const BASE_HOURS = 'base_hours';

	/** Charged for each hour beyond the base. */
	public const HOURLY_SURCHARGE = 'hourly_surcharge';

	/** Guests the base rate covers. */
	public const INCLUDED_GUESTS = 'included_guests';

	/** Charged for each guest beyond that. */
	public const GUEST_SURCHARGE = 'guest_surcharge';

	/** The fixed overnight window. */
	public const OVERNIGHT_START = 'overnight_start';

	public const OVERNIGHT_END = 'overnight_end';

	/** Earliest and latest an hourly booking may run. */
	public const DAY_START = 'day_start';

	public const DAY_END = 'day_end';

	/** Minutes between one possible start time and the next. */
	public const SLOT_STEP = 'slot_step';

	/** Bounds on how long an hourly booking may be. */
	public const MIN_HOURS = 'min_hours';

	public const MAX_HOURS = 'max_hours';

	/** Used until the Settings screen says otherwise. */
	private const DEFAULTS = array(
		self::CURRENCY         => 'EUR',
		self::BASE_HOURS       => '3',
		self::HOURLY_SURCHARGE => '20',
		// The base rate covers two guests; only those beyond it are charged,
		// so four guests add two lots of the surcharge.
		self::INCLUDED_GUESTS  => '2',
		self::GUEST_SURCHARGE  => '20',
		self::OVERNIGHT_START  => '16:00',
		self::OVERNIGHT_END    => '11:00',
		self::DAY_START        => '08:00',
		self::DAY_END          => '22:00',
		self::SLOT_STEP        => '30',
		self::MIN_HOURS        => '1',
		self::MAX_HOURS        => '8',
	);

	/**
	 * Cached for the request; settings are read on nearly every price.
	 *
	 * @var array<string, string>|null
	 */
	private static ?array $cache = null;

	public static function get( string $key, ?string $fallback = null ): string {
		$settings = self::all();

		return $settings[ $key ]
			?? $fallback
			?? self::DEFAULTS[ $key ]
			?? '';
	}

	/**
	 * ISO-4217 code every price is expressed in.
	 */
	public static function currency(): string {
		$currency = strtoupper( trim( self::get( self::CURRENCY ) ) );

		return 3 === strlen( $currency ) ? $currency : self::DEFAULTS[ self::CURRENCY ];
	}

	public static function number( string $key ): float {
		return (float) self::get( $key );
	}

	public static function set( string $key, string $value, string $group = 'general', string $locale = '' ): void {
		global $wpdb;

		$table = SettingsTable::table();
		$now   = current_time( 'mysql', true );

		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO $table (option_group, option_key, option_value, locale, autoload, created_at, updated_at)
				VALUES (%s, %s, %s, %s, 1, %s, %s)
				ON DUPLICATE KEY UPDATE option_value = VALUES(option_value), option_group = VALUES(option_group), updated_at = VALUES(updated_at)",
				$group,
				$key,
				$value,
				$locale,
				$now,
				$now
			)
		);

		self::$cache = null;
	}

	/**
	 * Every shared (non-translated) setting.
	 *
	 * @return array<string, string>
	 */
	public static function all(): array {
		global $wpdb;

		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$table = SettingsTable::table();

		// A missing table simply means defaults apply.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			self::$cache = array();

			return self::$cache;
		}

		$rows = $wpdb->get_results(
			"SELECT option_key, option_value FROM $table WHERE locale = ''",
			ARRAY_A
		) ?: array();

		self::$cache = wp_list_pluck( $rows, 'option_value', 'option_key' );

		return self::$cache;
	}
}
