<?php
/**
 * REST route for public holidays.
 *
 * GET /booking-suite/v1/holidays?from=Y-m-d&to=Y-m-d
 *
 * The dates are worked out rather than stored, so this is a read of a
 * calculation and not of a table. It exists because the admin calendar needs to
 * mark the days that price at the weekend rate, and repeating the Easter
 * arithmetic in JavaScript would be a second implementation to keep in step
 * with the one the prices are actually calculated from.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Pricing\HesseHolidays;
use DateTimeImmutable;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class HolidaysController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'holidays';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/** A calendar asks for one month; anything beyond a few years is a mistake. */
	private const MAX_YEARS = 5;

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( self::class, 'index' ),
				'permission_callback' => array( self::class, 'can_manage' ),
				'args'                => array(
					'from' => array(
						'type'     => 'string',
						'required' => true,
					),
					'to'   => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	/**
	 * Every holiday between two dates, inclusive.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function index( WP_REST_Request $request ) {
		$from = self::date( (string) $request->get_param( 'from' ) );
		$to   = self::date( (string) $request->get_param( 'to' ) );

		if ( null === $from || null === $to || $to < $from ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Give a start and an end date.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'from',
				)
			);
		}

		$first = (int) $from->format( 'Y' );
		$last  = (int) $to->format( 'Y' );

		if ( $last - $first >= self::MAX_YEARS ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Ask for a shorter range.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'to',
				)
			);
		}

		$start = $from->format( 'Y-m-d' );
		$end   = $to->format( 'Y-m-d' );

		$holidays = array();

		// A calendar month shows days either side of it, so the range can
		// straddle a year boundary — hence a year at a time rather than one.
		for ( $year = $first; $year <= $last; $year++ ) {
			foreach ( HesseHolidays::for_year( $year ) as $date => $name ) {
				if ( $date >= $start && $date <= $end ) {
					$holidays[ $date ] = $name;
				}
			}
		}

		ksort( $holidays );

		return new WP_REST_Response(
			array(
				// An object keyed by date, so the calendar can look a day up
				// rather than search a list for every cell it draws.
				'holidays' => (object) $holidays,
				'region'   => __( 'Hesse', 'booking-suite' ),
			),
			200
		);
	}

	private static function date( string $value ): ?DateTimeImmutable {
		if ( 1 !== preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}

		try {
			return new DateTimeImmutable( $value );
		} catch ( \Exception $e ) {
			return null;
		}
	}
}
