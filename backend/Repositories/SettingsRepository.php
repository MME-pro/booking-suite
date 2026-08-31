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

	/** Guests the base rate covers. */
	public const INCLUDED_GUESTS = 'included_guests';

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

	/** The next invoice number to issue, when it should not simply follow on. */
	public const INVOICE_COUNTER = 'invoice_counter';

	/** VAT rate as a percentage. 0 means prices are shown without any. */
	public const TAX_RATE = 'tax_rate';

	/*
	 * Who the business is. These feed the invoice's sender block and the header
	 * of every guest email, so the details are entered once rather than typed
	 * into each document.
	 */
	public const COMPANY_NAME = 'company_name';

	public const COMPANY_ADDRESS = 'company_address';

	public const COMPANY_PHONE = 'company_phone';

	public const COMPANY_EMAIL = 'company_email';

	public const COMPANY_LOGO = 'company_logo';

	/** Where notifications for the owner go. */
	public const ADMIN_EMAIL = 'admin_email';

	/*
	 * The account guests transfer to, printed on the invoice. Held as separate
	 * fields rather than one block of text: an IBAN is the thing a guest copies
	 * into their banking app, and it has to be reliably formatted rather than
	 * however someone happened to type it.
	 */
	public const BANK_HOLDER = 'bank_holder';

	public const BANK_NAME = 'bank_name';

	public const BANK_IBAN = 'bank_iban';

	public const BANK_BIC = 'bank_bic';

	/** Anything else about the account, kept from before the fields above. */
	public const BANK_DETAILS = 'bank_details';

	/** The master switch for guest email. Off stops every template. */
	public const EMAIL_NOTIFICATIONS = 'email_notifications';

	/** Linked from the booking flow. */
	public const TERMS_URL = 'terms_url';

	public const PRIVACY_URL = 'privacy_url';

	/** Used until the Settings screen says otherwise. */
	private const DEFAULTS = array(
		self::CURRENCY         => 'EUR',
		self::ACCENT_COLOUR    => '#2563eb',
		self::BASE_HOURS       => '3',
		// The base rate covers two guests; only those beyond it are charged,
		// so four guests add two lots of the surcharge.
		self::INCLUDED_GUESTS  => '2',
		self::OVERNIGHT_START  => '16:00',
		self::OVERNIGHT_END    => '11:00',
		/*
		 * The whole day, in half-hour steps: 00:00 through 23:30, which is 48
		 * start times. The window is what SlotGenerator walks, and the last
		 * start it offers is DAY_END itself — so 23:30 rather than 00:00, which
		 * would be the following midnight.
		 *
		 * A booking may still finish after the window closes; only the start
		 * has to fall inside it.
		 */
		self::DAY_START        => '00:00',
		self::DAY_END          => '23:30',
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
		self::INVOICE_COUNTER  => '',
		self::TAX_RATE         => '0',
		self::COMPANY_NAME     => '',
		self::COMPANY_ADDRESS  => '',
		self::COMPANY_PHONE    => '',
		self::COMPANY_EMAIL    => '',
		self::COMPANY_LOGO     => '',
		self::ADMIN_EMAIL      => '',
		self::BANK_HOLDER      => '',
		self::BANK_NAME        => '',
		self::BANK_IBAN        => '',
		self::BANK_BIC         => '',
		self::BANK_DETAILS     => '',
		self::EMAIL_NOTIFICATIONS => '1',
		self::TERMS_URL        => '',
		self::PRIVACY_URL      => '',
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

	/**
	 * The logo used on the invoice and in email headers.
	 *
	 * Falls back to the older `invoice_logo` key so a logo uploaded before the
	 * setting was renamed keeps working without anyone re-uploading it.
	 */
	public static function logo_id(): int {
		$id = (int) self::get( self::COMPANY_LOGO );

		return $id > 0 ? $id : (int) self::get( self::INVOICE_LOGO );
	}

	/**
	 * The sender block for the invoice, built from the company details.
	 *
	 * Falls back to the free-text block that used to hold this, so an install
	 * that filled that in keeps its wording until the company fields are set.
	 *
	 * @return string[]
	 */
	public static function sender_lines(): array {
		$lines = array(
			self::get( self::COMPANY_NAME ),
			self::get( self::COMPANY_ADDRESS ),
		);

		$phone = self::get( self::COMPANY_PHONE );
		$email = self::get( self::COMPANY_EMAIL );

		if ( '' !== $phone ) {
			/* translators: %s: the company's telephone number. */
			$lines[] = sprintf( __( 'Tel: %s', 'booking-suite' ), $phone );
		}

		if ( '' !== $email ) {
			/* translators: %s: the company's email address. */
			$lines[] = sprintf( __( 'E-Mail: %s', 'booking-suite' ), $email );
		}

		// One entry per line, so a multi-line address stays multi-line.
		$out = array();

		foreach ( $lines as $line ) {
			foreach ( preg_split( '/\R/', (string) $line ) ?: array() as $part ) {
				$part = trim( $part );

				if ( '' !== $part ) {
					$out[] = $part;
				}
			}
		}

		if ( $out ) {
			return $out;
		}

		return array_values(
			array_filter(
				array_map( 'trim', preg_split( '/\R/', self::get( self::INVOICE_SENDER ) ) ?: array() )
			)
		);
	}

	/**
	 * The bank block for the invoice, one entry per line.
	 *
	 * The IBAN is printed in groups of four, the way it is written on a bank
	 * statement, so a guest can read it across without losing their place.
	 *
	 * @return string[]
	 */
	public static function bank_lines(): array {
		$lines  = array();
		$holder = self::get( self::BANK_HOLDER );
		$name   = self::get( self::BANK_NAME );
		$iban   = self::get( self::BANK_IBAN );
		$bic    = self::get( self::BANK_BIC );

		if ( '' !== $holder ) {
			$lines[] = $holder;
		}

		if ( '' !== $name ) {
			$lines[] = $name;
		}

		if ( '' !== $iban ) {
			/* translators: %s: the IBAN, in groups of four. */
			$lines[] = sprintf( __( 'IBAN: %s', 'booking-suite' ), self::format_iban( $iban ) );
		}

		if ( '' !== $bic ) {
			/* translators: %s: the bank's BIC. */
			$lines[] = sprintf( __( 'BIC: %s', 'booking-suite' ), strtoupper( trim( $bic ) ) );
		}

		// Anything typed into the free-text field before these existed.
		foreach ( preg_split( '/\R/', self::get( self::BANK_DETAILS ) ) ?: array() as $extra ) {
			$extra = trim( $extra );

			if ( '' !== $extra ) {
				$lines[] = $extra;
			}
		}

		return $lines;
	}

	/** DE02120300000000202051 → DE02 1203 0000 0000 2020 51 */
	public static function format_iban( string $iban ): string {
		$compact = strtoupper( preg_replace( '/\s+/', '', $iban ) ?? $iban );

		return trim( chunk_split( $compact, 4, ' ' ) );
	}

	/** VAT rate as a fraction: 19 becomes 0.19. */
	public static function tax_fraction(): float {
		return max( 0.0, min( 100.0, (float) self::get( self::TAX_RATE ) ) ) / 100;
	}

	/** Whether guest email is switched on at all. */
	public static function emails_enabled(): bool {
		return '0' !== self::get( self::EMAIL_NOTIFICATIONS );
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
