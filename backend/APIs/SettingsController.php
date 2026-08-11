<?php
/**
 * REST routes for plugin settings.
 *
 * GET /booking-suite/v1/settings   read
 * PUT /booking-suite/v1/settings   update
 *
 * Values are read and written through SettingsRepository (the `mmebk_settings`
 * table), which is the same store the pricing engine and PaymentsRepository
 * read from — so changing the currency here actually changes what guests are
 * charged in.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\SettingsRepository;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class SettingsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'settings';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/** Currencies the booking flow can price in. */
	public const CURRENCIES = array( 'EUR', 'USD', 'GBP', 'CHF' );

	/** Offered as swatches. Any hex is accepted; these are only shortcuts. */
	public const ACCENT_PRESETS = array( '#2563eb', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#0f172a' );

	/**
	 * Setting key → the repository key it is stored under.
	 *
	 * There is deliberately no language setting. The plugin follows the
	 * WordPress site language through its own translation catalogue, so a
	 * control here could only ever disagree with Settings → General.
	 */
	private const KEYS = array(
		'currency'       => SettingsRepository::CURRENCY,
		'accentColour'   => SettingsRepository::ACCENT_COLOUR,
		'invoiceLogo'    => SettingsRepository::INVOICE_LOGO,
		'invoiceSender'  => SettingsRepository::INVOICE_SENDER,
		'invoicePrefix'  => SettingsRepository::INVOICE_PREFIX,
		'invoiceDueDays' => SettingsRepository::INVOICE_DUE_DAYS,
		'invoiceThanks'  => SettingsRepository::INVOICE_THANKS,
		'invoicePhone'   => SettingsRepository::INVOICE_PHONE,
		'invoiceEmail'   => SettingsRepository::INVOICE_EMAIL,
		'invoiceNotice'  => SettingsRepository::INVOICE_NOTICE,
	);

	/** Free-text invoice fields: stored as written, escaped when drawn. */
	private const TEXT_KEYS = array(
		'invoiceSender',
		'invoiceThanks',
		'invoiceNotice',
	);

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'show' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'currency'     => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => self::CURRENCIES,
						),
						'accentColour' => array(
							'type'              => 'string',
							'required'          => false,
							// Refused at the door rather than sanitised into
							// something the caller did not ask for.
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value ) && 1 === preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', trim( $value ) ),
						),
						'invoiceLogo'    => array(
							'type'              => 'integer',
							'required'          => false,
							// 0 clears it; anything else has to be real media.
							'validate_callback' => static fn( $value ): bool =>
								is_numeric( $value )
								&& ( 0 === (int) $value || 'attachment' === get_post_type( (int) $value ) ),
						),
						'invoiceSender'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoicePrefix'  => array(
							'type'              => 'string',
							'required'          => false,
							// It becomes part of a filename and of a sort key.
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value ) && 1 === preg_match( '/^[A-Za-z0-9]{1,10}$/', trim( $value ) ),
						),
						'invoiceDueDays' => array(
							'type'     => 'integer',
							'required' => false,
							'minimum'  => 0,
							'maximum'  => 365,
						),
						'invoiceThanks'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoicePhone'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoiceEmail'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoiceNotice'  => array(
							'type'     => 'string',
							'required' => false,
						),
					),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	/**
	 * The stored settings, with defaults filled in and unknown keys dropped.
	 *
	 * @return array<string, string>
	 */
	public static function all(): array {
		$currency = SettingsRepository::currency();

		// A value that is no longer offered falls back rather than sticking.
		return array(
			'currency'     => in_array( $currency, self::CURRENCIES, true )
				? $currency
				: 'EUR',
			'accentColour'   => SettingsRepository::accent_colour(),
			'invoiceLogo'    => (int) SettingsRepository::get( SettingsRepository::INVOICE_LOGO ),
			'invoiceSender'  => SettingsRepository::get( SettingsRepository::INVOICE_SENDER ),
			'invoicePrefix'  => SettingsRepository::get( SettingsRepository::INVOICE_PREFIX ),
			'invoiceDueDays' => (int) SettingsRepository::get( SettingsRepository::INVOICE_DUE_DAYS ),
			'invoiceThanks'  => SettingsRepository::get( SettingsRepository::INVOICE_THANKS ),
			'invoicePhone'   => SettingsRepository::get( SettingsRepository::INVOICE_PHONE ),
			'invoiceEmail'   => SettingsRepository::get( SettingsRepository::INVOICE_EMAIL ),
			'invoiceNotice'  => SettingsRepository::get( SettingsRepository::INVOICE_NOTICE ),
		);
	}

	/**
	 * The logo, ready for the Settings screen to show what is currently set.
	 *
	 * @return array<string, mixed>|null
	 */
	private static function logo(): ?array {
		$id = (int) SettingsRepository::get( SettingsRepository::INVOICE_LOGO );

		if ( ! $id || 'attachment' !== get_post_type( $id ) ) {
			return null;
		}

		return array(
			'id'  => $id,
			'url' => (string) wp_get_attachment_image_url( $id, 'medium' ),
		);
	}

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( self::payload(), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		foreach ( self::KEYS as $key => $stored_key ) {
			$value = $request->get_param( $key );

			if ( null === $value ) {
				continue;
			}

			/*
			 * The invoice's free-text fields keep their line breaks — the sender
			 * block is several lines and is printed line by line — so they take
			 * the textarea sanitiser rather than the single-line one.
			 */
			$value = in_array( $key, self::TEXT_KEYS, true )
				? sanitize_textarea_field( (string) $value )
				: (string) $value;

			SettingsRepository::set( $stored_key, $value );
		}

		self::purge_page_caches();

		return new WP_REST_Response( self::payload(), 200 );
	}

	/**
	 * Ask any page-caching plugin to drop its stored HTML.
	 *
	 * The accent colour is printed into the page as inline CSS, so a full-page
	 * cache keeps serving the old colour after it is changed — the setting saves
	 * correctly and the site looks untouched, which reads as a broken feature.
	 * Currency has the same problem wherever a price is cached.
	 *
	 * Each of these is the published way to clear that plugin's cache, and each
	 * is a no-op when the plugin is not installed.
	 */
	private static function purge_page_caches(): void {
		// LiteSpeed Cache.
		do_action( 'litespeed_purge_all' );

		// WP Super Cache.
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}

		// WP Rocket.
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}

		// W3 Total Cache.
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}

		// Cache Enabler.
		do_action( 'cache_enabler_clear_complete_cache' );
	}

	/**
	 * The values plus the choices behind them, so the screen never has to keep
	 * its own copy of the allowed options.
	 *
	 * @return array<string, mixed>
	 */
	private static function payload(): array {
		return array(
			'settings' => self::all(),
			'choices'  => array(
				'currencies' => self::CURRENCIES,
				// Sensible starting points; the field still takes any hex.
				'accents'    => self::ACCENT_PRESETS,
			),
			// The shades generated from the accent, so the screen can preview
			// exactly what the booking flow will use.
			'palette'  => SettingsRepository::accent_palette(),
			// So the screen can show the logo that is set without looking it up.
			'logo'     => self::logo(),
		);
	}
}
