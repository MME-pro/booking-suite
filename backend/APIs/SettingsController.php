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

	/**
	 * Setting key → the repository key it is stored under.
	 *
	 * There is deliberately no language setting. The plugin follows the
	 * WordPress site language through its own translation catalogue, so a
	 * control here could only ever disagree with Settings → General.
	 */
	private const KEYS = array(
		'currency' => SettingsRepository::CURRENCY,
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
						'currency' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => self::CURRENCIES,
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
			'currency' => in_array( $currency, self::CURRENCIES, true )
				? $currency
				: 'EUR',
		);
	}

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( self::payload(), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		foreach ( self::KEYS as $key => $stored_key ) {
			$value = $request->get_param( $key );

			if ( null !== $value ) {
				SettingsRepository::set( $stored_key, (string) $value );
			}
		}

		return new WP_REST_Response( self::payload(), 200 );
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
			),
		);
	}
}
