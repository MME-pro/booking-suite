<?php
/**
 * Public holidays in Hesse.
 *
 * Worked out rather than looked up, so no list needs maintaining. Easter is
 * computed with the anonymous Gregorian algorithm instead of easter_date(),
 * which needs the calendar extension that is not always compiled in.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Pricing;

use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

final class HesseHolidays {

	/**
	 * Cached per year; a stay spans two years at most.
	 *
	 * @var array<int, array<string, string>>
	 */
	private static array $cache = array();

	/**
	 * Every Hesse public holiday in a year, as Y-m-d => name.
	 *
	 * @return array<string, string>
	 */
	public static function for_year( int $year ): array {
		if ( isset( self::$cache[ $year ] ) ) {
			return self::$cache[ $year ];
		}

		$easter = self::easter( $year );

		$moveable = array(
			$easter->modify( '-2 days' )->format( 'Y-m-d' )  => 'Karfreitag',
			$easter->format( 'Y-m-d' )                       => 'Ostersonntag',
			$easter->modify( '+1 day' )->format( 'Y-m-d' )   => 'Ostermontag',
			$easter->modify( '+39 days' )->format( 'Y-m-d' ) => 'Christi Himmelfahrt',
			$easter->modify( '+49 days' )->format( 'Y-m-d' ) => 'Pfingstsonntag',
			$easter->modify( '+50 days' )->format( 'Y-m-d' ) => 'Pfingstmontag',
			$easter->modify( '+60 days' )->format( 'Y-m-d' ) => 'Fronleichnam',
		);

		$fixed = array(
			$year . '-01-01' => 'Neujahr',
			$year . '-05-01' => 'Tag der Arbeit',
			$year . '-10-03' => 'Tag der Deutschen Einheit',
			$year . '-12-25' => '1. Weihnachtstag',
			$year . '-12-26' => '2. Weihnachtstag',
		);

		$holidays = $fixed + $moveable;

		ksort( $holidays );

		self::$cache[ $year ] = $holidays;

		return $holidays;
	}

	public static function is_holiday( string $date ): bool {
		$year = (int) substr( $date, 0, 4 );

		return isset( self::for_year( $year )[ $date ] );
	}

	public static function name( string $date ): string {
		$year = (int) substr( $date, 0, 4 );

		return self::for_year( $year )[ $date ] ?? '';
	}

	/**
	 * Whether the date is a holiday, or the day before one.
	 *
	 * Both are charged at the weekend rate: the evening before a holiday is as
	 * much in demand as the holiday itself.
	 */
	public static function is_holiday_or_eve( string $date ): bool {
		if ( self::is_holiday( $date ) ) {
			return true;
		}

		$next = ( new DateTimeImmutable( $date ) )->modify( '+1 day' )->format( 'Y-m-d' );

		return self::is_holiday( $next );
	}

	/**
	 * Easter Sunday, anonymous Gregorian algorithm.
	 */
	private static function easter( int $year ): DateTimeImmutable {
		$a = $year % 19;
		$b = intdiv( $year, 100 );
		$c = $year % 100;
		$d = intdiv( $b, 4 );
		$e = $b % 4;
		$f = intdiv( $b + 8, 25 );
		$g = intdiv( $b - $f + 1, 3 );
		$h = ( 19 * $a + $b - $d - $g + 15 ) % 30;
		$i = intdiv( $c, 4 );
		$k = $c % 4;
		$l = ( 32 + 2 * $e + 2 * $i - $h - $k ) % 7;
		$m = intdiv( $a + 11 * $h + 22 * $l, 451 );

		$month = intdiv( $h + $l - 7 * $m + 114, 31 );
		$day   = ( ( $h + $l - 7 * $m + 114 ) % 31 ) + 1;

		return new DateTimeImmutable( sprintf( '%04d-%02d-%02d', $year, $month, $day ) );
	}
}
