<?php
/**
 * Public endpoints for proving an email address.
 *
 * POST /booking-suite/v1/public/verify          ask for a code
 * POST /booking-suite/v1/public/verify/confirm  hand the code back
 *
 * Open to anyone, because the guest making the booking is logged out by
 * definition. Everything that keeps that from being abused — how often one
 * address may be written to, how many guesses a code survives, how long either
 * lasts — lives in EmailVerification, so it cannot be argued with by adding a
 * second caller here.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Support\EmailVerification;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class PublicVerificationController {

	public const NAMESPACE = 'booking-suite/v1';

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/public/verify',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'request_code' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'email' => array(
							'type'     => 'string',
							'required' => true,
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/public/verify/confirm',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'confirm_code' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'email' => array(
							'type'     => 'string',
							'required' => true,
						),
						'code'  => array(
							'type'     => 'string',
							'required' => true,
						),
					),
				),
			)
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function request_code( WP_REST_Request $request ) {
		if ( ! EmailVerification::is_enabled() ) {
			return self::off();
		}

		$result = EmailVerification::request( (string) $request->get_param( 'email' ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		/*
		 * Deliberately says nothing about the address beyond "sent". Whether
		 * one has booked here before, or exists at all, is not something an
		 * endpoint anyone can call should be willing to report.
		 */
		return new WP_REST_Response( array( 'sent' => true ) + $result, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function confirm_code( WP_REST_Request $request ) {
		if ( ! EmailVerification::is_enabled() ) {
			return self::off();
		}

		$result = EmailVerification::confirm(
			(string) $request->get_param( 'email' ),
			(string) $request->get_param( 'code' )
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( array( 'verified' => true ) + $result, 200 );
	}

	/**
	 * Verification is switched off site-wide.
	 *
	 * A 200 rather than an error: the modal asks before it shows the step, so
	 * reaching here at all means the answer changed underneath a guest who is
	 * part-way through. Telling them the booking can simply go ahead is right;
	 * failing them is not.
	 */
	private static function off(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'enabled' => false,
				'sent'    => false,
			),
			200
		);
	}
}
