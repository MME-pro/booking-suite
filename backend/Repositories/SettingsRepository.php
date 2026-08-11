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

	/** The brand colour the guest-facing booking flow is drawn in. */
	public const ACCENT_COLOUR = 'accent_colour';

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

	/*
	 * The invoice. Everything the PDF prints that is not taken from the booking
	 * itself is stored here, so the wording, the sender block and the logo are
	 * the owner's to change without a developer.
	 */

	/** Attachment ID of the logo printed at the top of the invoice. */
	public const INVOICE_LOGO = 'invoice_logo';

	/** The sender block, printed on the right. One line per line. */
	public const INVOICE_SENDER = 'invoice_sender';

	/** Prefix of the generated invoice number: PREFIX-YYYY-NNNN. */
	public const INVOICE_PREFIX = 'invoice_prefix';

	/** Days from the invoice date to the Fälligkeitsdatum. */
	public const INVOICE_DUE_DAYS = 'invoice_due_days';

	/** The closing lines under the total. */
	public const INVOICE_THANKS = 'invoice_thanks';

	public const INVOICE_PHONE = 'invoice_phone';

	public const INVOICE_EMAIL = 'invoice_email';

	/** Printed after a bold "Hinweis:" label. */
	public const INVOICE_NOTICE = 'invoice_notice';

	/** Used until the Settings screen says otherwise. */
	private const DEFAULTS = array(
		self::CURRENCY         => 'EUR',
		self::ACCENT_COLOUR    => '#2563eb',
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
		self::INVOICE_LOGO     => '',
		self::INVOICE_SENDER   => '',
		self::INVOICE_PREFIX   => 'INV',
		self::INVOICE_DUE_DAYS => '30',
		self::INVOICE_THANKS   => 'Vielen Dank für Ihr Vertrauen! Bei Fragen zu dieser Rechnung kontaktieren Sie uns bitte',
		self::INVOICE_PHONE    => '',
		self::INVOICE_EMAIL    => '',
		self::INVOICE_NOTICE   => '',
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

	/**
	 * The guest-facing accent colour, always a usable 6-digit hex.
	 *
	 * Guarded rather than trusted: the value reaches the database through a REST
	 * field, and a malformed colour would not merely look wrong — it would take
	 * the custom property with it and leave every button, focus ring and
	 * selected state in the booking flow unpainted.
	 */
	public static function accent_colour(): string {
		$colour = sanitize_hex_color( trim( self::get( self::ACCENT_COLOUR ) ) );

		if ( null === $colour || '' === $colour ) {
			return self::DEFAULTS[ self::ACCENT_COLOUR ];
		}

		// Expand #abc so the shade maths below has three whole channels.
		if ( 4 === strlen( $colour ) ) {
			$colour = '#' . $colour[1] . $colour[1] . $colour[2] . $colour[2] . $colour[3] . $colour[3];
		}

		return strtolower( $colour );
	}

	/**
	 * The accent plus the shades derived from it.
	 *
	 * The palette is generated rather than configured. Asking an owner for five
	 * related colours invites a set that does not agree with itself; asking for
	 * one and deriving the rest keeps hover darker than rest, and the soft tint
	 * light enough to carry text, whatever they pick.
	 *
	 * @return array<string, string>
	 */
	public static function accent_palette(): array {
		$hex = self::accent_colour();

		[ $r, $g, $b ] = array(
			(int) hexdec( substr( $hex, 1, 2 ) ),
			(int) hexdec( substr( $hex, 3, 2 ) ),
			(int) hexdec( substr( $hex, 5, 2 ) ),
		);

		/** Mix a channel towards black (negative) or white (positive). */
		$shift = static function ( int $channel, float $amount ): int {
			$target = $amount < 0 ? 0 : 255;

			return (int) round( $channel + ( ( $target - $channel ) * abs( $amount ) ) );
		};

		$mix = static function ( float $amount ) use ( $r, $g, $b, $shift ): string {
			return sprintf(
				'#%02x%02x%02x',
				$shift( $r, $amount ),
				$shift( $g, $amount ),
				$shift( $b, $amount )
			);
		};

		/*
		 * White text has to stay legible on the accent, so a very light choice
		 * gets a darker fill for anything that carries a label.
		 */
		$luminance = ( ( 0.299 * $r ) + ( 0.587 * $g ) + ( 0.114 * $b ) ) / 255;
		$base      = $luminance > 0.75 ? $mix( -0.35 ) : $hex;

		return array(
			'brand'     => $base,
			'hover'     => $luminance > 0.75 ? $mix( -0.5 ) : $mix( -0.18 ),
			'active'    => $luminance > 0.75 ? $mix( -0.62 ) : $mix( -0.32 ),
			'soft'      => $mix( 0.92 ),
			'glow'      => sprintf( 'rgba(%d, %d, %d, 0.16)', $r, $g, $b ),
			'on_accent' => '#ffffff',
		);
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
