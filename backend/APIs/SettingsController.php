<?php
/**
 * REST routes for plugin settings.
 *
 * GET /booking-suite/v1/settings   read
 * PUT /booking-suite/v1/settings   update
 *
 * Settings live in a single option rather than one option per key, so adding a
 * setting later needs no migration.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

use const BookingSuite\PREFIX;

defined( 'ABSPATH' ) || exit;

final class SettingsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'settings';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/** The single option every setting is stored under. */
	private const OPTION = PREFIX . 'settings';

	/** Currencies the booking flow can price in. */
	public const CURRENCIES = array( 'EUR', 'USD', 'GBP', 'CHF' );

	/** Languages the guest-facing flow is offered in. */
	public const LANGUAGES = array( 'en', 'de' );

	private const DEFAULTS = array(
		'currency' => 'EUR',
		'language' => 'de',
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
						'language' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => self::LANGUAGES,
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
		$stored = get_option( self::OPTION, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$settings = array_merge( self::DEFAULTS, $stored );

		// A value that is no longer offered falls back rather than sticking.
		if ( ! in_array( $settings['currency'], self::CURRENCIES, true ) ) {
			$settings['currency'] = self::DEFAULTS['currency'];
		}

		if ( ! in_array( $settings['language'], self::LANGUAGES, true ) ) {
			$settings['language'] = self::DEFAULTS['language'];
		}

		return array_intersect_key( $settings, self::DEFAULTS );
	}

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( self::payload(), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$settings = self::all();

		foreach ( array_keys( self::DEFAULTS ) as $key ) {
			$value = $request->get_param( $key );

			if ( null !== $value ) {
				$settings[ $key ] = (string) $value;
			}
		}

		update_option( self::OPTION, $settings );

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
				'languages'  => self::LANGUAGES,
			),
		);
	}
}
