<?php
/**
 * REST route behind Reports & Analytics.
 *
 * GET /booking-suite/v1/reports?from=Y-m-d&to=Y-m-d&granularity=day|week|month
 *
 * Every figure is computed here rather than in the browser, so the screen and
 * a printed report cannot disagree, and so the definitions live in one place.
 *
 * Two different dates are in play and the distinction matters:
 *
 *   · Bookings and revenue are counted by when the booking was TAKEN
 *     (created_at) — that is what "we sold this much in March" means.
 *   · Occupancy is measured by when the stay HAPPENS (starts_at/ends_at),
 *     overlapped with the window, because a room is only occupied while
 *     someone is in it.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
use DateTimeImmutable;
use DateTimeZone;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class ReportsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'reports';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/**
	 * Statuses counted as real business.
	 *
	 * Pending requests are included: they were taken, and excluding them would
	 * understate a month that is still being worked through.
	 */
	private const COUNTED = array( 'pending', 'reserved', 'confirmed', 'completed' );

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
					'callback'            => array( self::class, 'index' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'from'        => array(
							'type'     => 'string',
							'required' => false,
						),
						'to'          => array(
							'type'     => 'string',
							'required' => false,
						),
						'granularity' => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => array( 'day', 'week', 'month' ),
						),
					),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	public static function index( WP_REST_Request $request ): WP_REST_Response {
		$utc = new DateTimeZone( 'UTC' );

		$from = self::date( (string) $request->get_param( 'from' ) )
			?? new DateTimeImmutable( 'first day of this month 00:00:00', $utc );

		$to = self::date( (string) $request->get_param( 'to' ) )
			?? new DateTimeImmutable( 'now', $utc );

		// A backwards range is a slip, not an empty report.
		if ( $to < $from ) {
			list( $from, $to ) = array( $to, $from );
		}

		$to          = $to->setTime( 23, 59, 59 );
		$granularity = (string) $request->get_param( 'granularity' ) ?: 'day';

		$taken      = self::bookings_taken( $from, $to );
		$overlaps   = self::bookings_overlapping( $from, $to );
		$apartments = ApartmentsRepository::all();

		return new WP_REST_Response(
			array(
				'range'      => array(
					'from' => $from->format( 'Y-m-d' ),
					'to'   => $to->format( 'Y-m-d' ),
				),
				'currency'   => SettingsRepository::currency(),
				'totals'     => self::totals( $taken, $overlaps, $apartments, $from, $to ),
				'trend'      => self::trend( $taken, $from, $to, $granularity ),
				'rooms'      => self::rooms( $taken, $overlaps, $apartments, $from, $to ),
				'statuses'   => self::statuses( $taken ),
				'peakHours'  => self::peak_hours( $taken ),
				'customers'  => self::customers( $taken ),
			),
			200
		);
	}

	/**
	 * Bookings TAKEN in the window — the sales view.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function bookings_taken( DateTimeImmutable $from, DateTimeImmutable $to ): array {
		global $wpdb;

		$table = BookingsTable::table();

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE created_at BETWEEN %s AND %s",
				$from->format( 'Y-m-d H:i:s' ),
				$to->format( 'Y-m-d H:i:s' )
			),
			ARRAY_A
		) ?: array();
	}

	/**
	 * Stays that TOUCH the window — the occupancy view.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function bookings_overlapping( DateTimeImmutable $from, DateTimeImmutable $to ): array {
		global $wpdb;

		$table = BookingsTable::table();

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE starts_at < %s AND ends_at > %s",
				$to->format( 'Y-m-d H:i:s' ),
				$from->format( 'Y-m-d H:i:s' )
			),
			ARRAY_A
		) ?: array();
	}

	/**
	 * @param array<int, array<string, mixed>> $taken
	 * @param array<int, array<string, mixed>> $overlaps
	 * @param array<int, array<string, mixed>> $apartments
	 *
	 * @return array<string, mixed>
	 */
	private static function totals(
		array $taken,
		array $overlaps,
		array $apartments,
		DateTimeImmutable $from,
		DateTimeImmutable $to
	): array {
		$revenue   = 0.0;
		$customers = array();

		foreach ( $taken as $booking ) {
			if ( ! in_array( $booking['status'], self::COUNTED, true ) ) {
				continue;
			}

			// Refunded money was handed back; it is not revenue.
			if ( 'refunded' !== $booking['payment_status'] ) {
				$revenue += (float) $booking['total_amount'];
			}

			if ( $booking['customer_id'] ) {
				$customers[ (int) $booking['customer_id'] ] = true;
			}
		}

		return array(
			'bookings'  => count( $taken ),
			'revenue'   => round( $revenue, 2 ),
			'occupancy' => self::occupancy( $overlaps, count( $apartments ), $from, $to ),
			'customers' => count( $customers ),
		);
	}

	/**
	 * Occupancy as a percentage of the hours available in the window.
	 *
	 * Available hours are apartments × the length of the window, so a month
	 * with three apartments offers three times the month in hours. Only the
	 * part of each stay that falls INSIDE the window counts, which is why a
	 * stay spanning the month boundary does not inflate it.
	 *
	 * @param array<int, array<string, mixed>> $overlaps
	 */
	private static function occupancy(
		array $overlaps,
		int $apartment_count,
		DateTimeImmutable $from,
		DateTimeImmutable $to
	): float {
		$window = $to->getTimestamp() - $from->getTimestamp();

		if ( $window <= 0 || $apartment_count < 1 ) {
			return 0.0;
		}

		$occupied = 0;

		foreach ( $overlaps as $booking ) {
			if ( ! in_array( $booking['status'], self::COUNTED, true ) ) {
				continue;
			}

			$starts = strtotime( $booking['starts_at'] . ' UTC' );
			$ends   = strtotime( $booking['ends_at'] . ' UTC' );

			if ( ! $starts || ! $ends ) {
				continue;
			}

			$occupied += max(
				0,
				min( $ends, $to->getTimestamp() ) - max( $starts, $from->getTimestamp() )
			);
		}

		return round( ( $occupied / ( $window * $apartment_count ) ) * 100, 2 );
	}

	/**
	 * Bookings and revenue per bucket, with empty buckets kept.
	 *
	 * @param array<int, array<string, mixed>> $taken
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function trend(
		array $taken,
		DateTimeImmutable $from,
		DateTimeImmutable $to,
		string $granularity
	): array {
		$format = array(
			'day'   => 'Y-m-d',
			'week'  => 'o-\WW',
			'month' => 'Y-m',
		)[ $granularity ] ?? 'Y-m-d';

		$step = array(
			'day'   => '+1 day',
			'week'  => '+1 week',
			'month' => '+1 month',
		)[ $granularity ] ?? '+1 day';

		$buckets = array();
		$cursor  = $from;

		// A gap in a time axis reads as "no data collected" rather than "none".
		for ( $guard = 0; $guard < 400 && $cursor <= $to; $guard++ ) {
			$buckets[ $cursor->format( $format ) ] = array(
				'key'      => $cursor->format( $format ),
				'bookings' => 0,
				'revenue'  => 0.0,
			);

			$cursor = $cursor->modify( $step );
		}

		foreach ( $taken as $booking ) {
			$created = strtotime( $booking['created_at'] . ' UTC' );

			if ( ! $created ) {
				continue;
			}

			$key = gmdate( $format, $created );

			if ( ! isset( $buckets[ $key ] ) ) {
				continue;
			}

			$buckets[ $key ]['bookings']++;

			if ( 'refunded' !== $booking['payment_status'] ) {
				$buckets[ $key ]['revenue'] += (float) $booking['total_amount'];
			}
		}

		return array_values(
			array_map(
				static function ( array $bucket ): array {
					$bucket['revenue'] = round( $bucket['revenue'], 2 );

					return $bucket;
				},
				$buckets
			)
		);
	}

	/**
	 * Per-apartment performance.
	 *
	 * @param array<int, array<string, mixed>> $taken
	 * @param array<int, array<string, mixed>> $overlaps
	 * @param array<int, array<string, mixed>> $apartments
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function rooms(
		array $taken,
		array $overlaps,
		array $apartments,
		DateTimeImmutable $from,
		DateTimeImmutable $to
	): array {
		$rows = array();

		foreach ( $apartments as $apartment ) {
			$id = (int) $apartment['id'];

			$mine = array_values(
				array_filter(
					$taken,
					static fn( array $b ): bool => (int) $b['room_id'] === $id
				)
			);

			$revenue = 0.0;

			foreach ( $mine as $booking ) {
				if ( 'refunded' !== $booking['payment_status'] ) {
					$revenue += (float) $booking['total_amount'];
				}
			}

			$stays = array_values(
				array_filter(
					$overlaps,
					static fn( array $b ): bool => (int) $b['room_id'] === $id
				)
			);

			$rows[] = array(
				'id'        => $id,
				'name'      => (string) $apartment['name'],
				'colour'    => (string) $apartment['colour'],
				'bookings'  => count( $mine ),
				'revenue'   => round( $revenue, 2 ),
				// One apartment's own occupancy, not the estate's.
				'occupancy' => self::occupancy( $stays, 1, $from, $to ),
			);
		}

		usort(
			$rows,
			static fn( array $a, array $b ): int => $b['revenue'] <=> $a['revenue']
		);

		return $rows;
	}

	/**
	 * @param array<int, array<string, mixed>> $taken
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function statuses( array $taken ): array {
		$counts = array_fill_keys( self::COUNTED, 0 );

		foreach ( $taken as $booking ) {
			$status = (string) $booking['status'];

			if ( isset( $counts[ $status ] ) ) {
				$counts[ $status ]++;
			}
		}

		$rows = array();

		foreach ( $counts as $status => $count ) {
			$rows[] = array(
				'status' => $status,
				'count'  => $count,
			);
		}

		return $rows;
	}

	/**
	 * When stays start, bucketed by hour.
	 *
	 * Only hours that actually saw a booking are returned — a table of 24 rows
	 * where 23 read zero says less than a table of the ones that happened.
	 *
	 * @param array<int, array<string, mixed>> $taken
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function peak_hours( array $taken ): array {
		$hours = array();

		foreach ( $taken as $booking ) {
			$starts = strtotime( $booking['starts_at'] . ' UTC' );

			if ( ! $starts ) {
				continue;
			}

			$hour           = (int) wp_date( 'G', $starts );
			$hours[ $hour ] = ( $hours[ $hour ] ?? 0 ) + 1;
		}

		$total = array_sum( $hours );
		$rows  = array();

		foreach ( $hours as $hour => $count ) {
			$rows[] = array(
				'slot'       => sprintf( '%02d:00-%02d:00', $hour, ( $hour + 1 ) % 24 ),
				'hour'       => $hour,
				'bookings'   => $count,
				'percentage' => $total ? round( ( $count / $total ) * 100, 1 ) : 0.0,
			);
		}

		usort(
			$rows,
			static fn( array $a, array $b ): int => $b['bookings'] <=> $a['bookings']
		);

		return $rows;
	}

	/**
	 * The customer-shaped figures.
	 *
	 * `cancellationRate` is measured on refunded payments. This system has no
	 * cancelled status — a released booking goes back to pending and its dates
	 * simply free up — so a refund is the only durable record that a booking
	 * was undone.
	 *
	 * @param array<int, array<string, mixed>> $taken
	 *
	 * @return array<string, float>
	 */
	private static function customers( array $taken ): array {
		global $wpdb;

		$table    = BookingsTable::table();
		$revenue  = 0.0;
		$counted  = 0;
		$seconds  = 0;
		$refunded = 0;
		$ids      = array();

		foreach ( $taken as $booking ) {
			if ( 'refunded' === $booking['payment_status'] ) {
				$refunded++;
			} else {
				$revenue += (float) $booking['total_amount'];
			}

			$starts = strtotime( $booking['starts_at'] . ' UTC' );
			$ends   = strtotime( $booking['ends_at'] . ' UTC' );

			if ( $starts && $ends && $ends > $starts ) {
				$seconds += $ends - $starts;
				$counted++;
			}

			if ( $booking['customer_id'] ) {
				$ids[ (int) $booking['customer_id'] ] = true;
			}
		}

		$total = count( $taken );

		/*
		 * "Repeat" is judged on a customer's whole history, not just this
		 * window: someone who stayed last year and again this month is a
		 * returning customer, even though the window holds one of their stays.
		 */
		$repeat = 0;

		foreach ( array_keys( $ids ) as $customer_id ) {
			$all_time = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM $table WHERE customer_id = %d",
					$customer_id
				)
			);

			if ( $all_time > 1 ) {
				$repeat++;
			}
		}

		return array(
			'averageValue'     => $total ? round( $revenue / $total, 2 ) : 0.0,
			'repeatRate'       => $ids ? round( ( $repeat / count( $ids ) ) * 100, 1 ) : 0.0,
			'averageHours'     => $counted ? round( $seconds / $counted / 3600, 1 ) : 0.0,
			'cancellationRate' => $total ? round( ( $refunded / $total ) * 100, 1 ) : 0.0,
		);
	}

	private static function date( string $value ): ?DateTimeImmutable {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}

		$date = DateTimeImmutable::createFromFormat(
			'Y-m-d H:i:s',
			$value . ' 00:00:00',
			new DateTimeZone( 'UTC' )
		);

		return $date ?: null;
	}
}
