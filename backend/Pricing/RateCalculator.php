<?php
/**
 * Works out what a stay costs.
 *
 * Today it knows one rule: a night is charged by the day it starts on, at the
 * weekend rate for Friday and Saturday and the weekday rate otherwise. The
 * remaining factors — Hesse holidays, time-based rates, guest and hour
 * surcharges, package prices — will be layered on here.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Pricing;

use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Schemas\ApartmentsTable;
use DateTimeImmutable;
use DateTimeInterface;

defined( 'ABSPATH' ) || exit;

final class RateCalculator {

	/**
	 * Durations billed as fewer hours than were booked.
	 *
	 * Six hours is charged as five, so booking the longer block is cheaper per
	 * hour than the five-hour one. Kept as a map so further breaks can be added
	 * without touching the arithmetic.
	 *
	 * @var array<int, int>
	 */
	public const BILLING_BREAKS = array( 6 => 5 );

	/**
	 * Per-night breakdown between two yyyy-mm-dd dates.
	 *
	 * The check-out day is not charged: three nights from Friday means Fri,
	 * Sat, Sun.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<int, array{date: string, weekend: bool, rate: float}>
	 */
	public static function nights( array $apartment, string $check_in, string $check_out ): array {
		$start = new DateTimeImmutable( $check_in );
		$end   = new DateTimeImmutable( $check_out );

		$nights = array();

		for ( $day = $start; $day < $end; $day = $day->modify( '+1 day' ) ) {
			$date = $day->format( 'Y-m-d' );

			// Each night is its own 16:00–11:00 block, priced by the hourly
			// rules: the base rate covers the first hours, the rest are
			// charged per hour.
			$price = self::duration_price( $apartment, $date . ' 00:00:00', self::overnight_hours() );

			$nights[] = array(
				'date'       => $date,
				'weekend'    => $price['weekend'],
				'holiday'    => ! empty( $apartment['holiday_hesse'] )
					&& HesseHolidays::is_holiday_or_eve( $date ),
				'baseRate'   => $price['baseRate'],
				'extraHours' => $price['extraHours'],
				'extraTotal' => $price['extraTotal'],
				'rate'       => $price['total'],
			);
		}

		return $nights;
	}

	/**
	 * Length of the fixed overnight window, in hours.
	 */
	public static function overnight_hours(): float {
		return self::overnight_window( '2000-01-01' )['hours'];
	}

	/**
	 * Accommodation total for the stay.
	 *
	 * @param array<int, array{rate: float}> $nights
	 */
	public static function total( array $nights ): float {
		return round(
			array_sum( array_column( $nights, 'rate' ) ),
			2
		);
	}

	/**
	 * Whether a date is charged at the weekend rate.
	 *
	 * Friday and Saturday always are. When the apartment follows Hesse public
	 * holidays, so are a holiday and the day before one.
	 *
	 * @param array<string, mixed> $apartment
	 */
	public static function is_weekend_rate( array $apartment, string $date ): bool {
		$date = substr( $date, 0, 10 );
		$day  = (int) ( new DateTimeImmutable( $date ) )->format( 'w' );

		if ( in_array( $day, ApartmentsTable::WEEKEND_DAYS, true ) ) {
			return true;
		}

		return ! empty( $apartment['holiday_hesse'] )
			&& HesseHolidays::is_holiday_or_eve( $date );
	}

	/**
	 * The base rate for a booking starting on this date.
	 *
	 * @param array<string, mixed> $apartment
	 */
	public static function base_rate( array $apartment, string $starts_at ): float {
		return self::is_weekend_rate( $apartment, $starts_at )
			? (float) ( $apartment['weekend_rate'] ?? 0 )
			: (float) ( $apartment['weekday_rate'] ?? 0 );
	}

	/**
	 * What extra guests add.
	 *
	 * The base rate covers INCLUDED_GUESTS people; each one beyond that adds
	 * the guest surcharge.
	 */
	public static function guest_surcharge( int $guests ): array {
		$included  = max( 0, (int) SettingsRepository::number( SettingsRepository::INCLUDED_GUESTS ) );
		$per_guest = max( 0, SettingsRepository::number( SettingsRepository::GUEST_SURCHARGE ) );

		$extra = max( 0, $guests - $included );

		return array(
			'includedGuests' => $included,
			'extraGuests'    => $extra,
			'perGuest'       => round( $per_guest, 2 ),
			'total'          => round( $extra * $per_guest, 2 ),
		);
	}

	/**
	 * Hours actually charged for.
	 *
	 * A started hour counts as a whole one, then the billing breaks apply — so
	 * six booked hours are billed as five.
	 */
	public static function billable_hours( float $hours ): int {
		$whole = (int) max( 1, ceil( round( $hours, 4 ) ) );

		return self::BILLING_BREAKS[ $whole ] ?? $whole;
	}

	/**
	 * Price one block of time.
	 *
	 * The base rate covers the first BASE_HOURS hours; every hour beyond that
	 * adds the hourly surcharge.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<string, mixed>
	 */
	public static function duration_price( array $apartment, string $starts_at, float $hours ): array {
		$base_hours = max( 1, (int) SettingsRepository::number( SettingsRepository::BASE_HOURS ) );
		$surcharge  = max( 0, SettingsRepository::number( SettingsRepository::HOURLY_SURCHARGE ) );

		$base     = self::base_rate( $apartment, $starts_at );
		$booked   = (int) max( 1, ceil( round( $hours, 4 ) ) );
		$billable = self::billable_hours( $hours );

		$extra_hours = max( 0, $billable - $base_hours );
		$extra_total = $extra_hours * $surcharge;

		// What the same block would cost without the break, for display.
		$undiscounted = $base + max( 0, $booked - $base_hours ) * $surcharge;
		$total        = $base + $extra_total;

		return array(
			'weekend'        => self::is_weekend_rate( $apartment, $starts_at ),
			'baseHours'      => $base_hours,
			'baseRate'       => round( $base, 2 ),
			'bookedHours'    => $booked,
			'billableHours'  => $billable,
			'extraHours'     => $extra_hours,
			'hourlySurcharge' => round( $surcharge, 2 ),
			'extraTotal'     => round( $extra_total, 2 ),
			'discount'       => round( max( 0, $undiscounted - $total ), 2 ),
			'total'          => round( $total, 2 ),
		);
	}

	/**
	 * The fixed overnight window for a given arrival date.
	 *
	 * An overnight stay always runs 16:00 to 11:00 the next morning, whatever
	 * the guest picks, and occupies the apartment for that whole window — which
	 * is what stops an hourly booking sitting inside it.
	 *
	 * @return array{starts_at: string, ends_at: string, hours: float}
	 */
	public static function overnight_window( string $arrival_date ): array {
		$start_time = SettingsRepository::get( SettingsRepository::OVERNIGHT_START );
		$end_time   = SettingsRepository::get( SettingsRepository::OVERNIGHT_END );

		$starts = new DateTimeImmutable( substr( $arrival_date, 0, 10 ) . ' ' . $start_time );
		$ends   = ( new DateTimeImmutable( substr( $arrival_date, 0, 10 ) . ' ' . $end_time ) )
			->modify( '+1 day' );

		return array(
			'starts_at' => $starts->format( 'Y-m-d H:i:s' ),
			'ends_at'   => $ends->format( 'Y-m-d H:i:s' ),
			'hours'     => round( ( $ends->getTimestamp() - $starts->getTimestamp() ) / HOUR_IN_SECONDS, 2 ),
		);
	}

	/**
	 * Whether a window covers a whole overnight stay, and so must be priced as
	 * one rather than by the hour.
	 */
	public static function is_overnight( DateTimeInterface $starts, DateTimeInterface $ends ): bool {
		$window = self::overnight_window( $starts->format( 'Y-m-d' ) );

		return $starts->format( 'Y-m-d H:i' ) === substr( $window['starts_at'], 0, 16 )
			&& $ends->format( 'Y-m-d H:i' ) === substr( $window['ends_at'], 0, 16 );
	}

	/**
	 * Price a whole stay.
	 *
	 * Overnight wins: any window covering at least one 16:00–11:00 night is
	 * charged per night at the base rate, with no hourly surcharge. Shorter
	 * windows fall through to the hourly rules. The guest charge is added once
	 * for the stay, whatever its length.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<string, mixed>
	 */
	public static function quote( array $apartment, string $starts_at, string $ends_at, int $guests ): array {
		$check_in  = substr( $starts_at, 0, 10 );
		$check_out = substr( $ends_at, 0, 10 );

		$nights = self::nights( $apartment, $check_in, $check_out );

		if ( $nights ) {
			$accommodation = self::total( $nights );
			$mode          = 'overnight';
			$duration      = null;
		} else {
			$hours    = ( strtotime( $ends_at ) - strtotime( $starts_at ) ) / HOUR_IN_SECONDS;
			$duration = self::duration_price( $apartment, $starts_at, (float) $hours );

			$accommodation = $duration['total'];
			$mode          = 'hourly';
		}

		$guest_charge = self::guest_surcharge( $guests );

		return array(
			'mode'          => $mode,
			'nights'        => count( $nights ),
			'nightBreakdown' => $nights,
			'duration'      => $duration,
			'accommodation' => round( $accommodation, 2 ),
			'guestCharge'   => $guest_charge,
			'subtotal'      => round( $accommodation + $guest_charge['total'], 2 ),
			'priced'        => self::is_priced( $apartment ),
		);
	}

	/**
	 * Whether the apartment has any rate at all.
	 *
	 * @param array<string, mixed> $apartment
	 */
	public static function is_priced( array $apartment ): bool {
		return (float) ( $apartment['weekday_rate'] ?? 0 ) > 0
			|| (float) ( $apartment['weekend_rate'] ?? 0 ) > 0;
	}

	/**
	 * The "from" price shown on a card: the cheapest of the two rates,
	 * ignoring one that has not been set.
	 *
	 * @param array<string, mixed> $apartment
	 */
	public static function lowest_rate( array $apartment ): ?float {
		$rates = array_filter(
			array(
				(float) ( $apartment['weekday_rate'] ?? 0 ),
				(float) ( $apartment['weekend_rate'] ?? 0 ),
			),
			static fn( float $rate ): bool => $rate > 0
		);

		return $rates ? min( $rates ) : null;
	}
}
