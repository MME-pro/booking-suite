<?php
/**
 * Builds the selectable time slots for an hourly booking.
 *
 * A slot is a start time plus the chosen duration. Each one is priced and
 * checked for availability here, so the browser never has to work either out.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Pricing;

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

final class SlotGenerator {

	/**
	 * Durations offered as suggestions, in hours.
	 *
	 * Only suggestions: a guest may enter any length they like.
	 *
	 * @return int[]
	 */
	public static function durations(): array {
		$min = max( 1, (int) SettingsRepository::number( SettingsRepository::MIN_HOURS ) );
		$max = max( $min, (int) SettingsRepository::number( SettingsRepository::MAX_HOURS ) );

		return range( $min, $max );
	}

	/**
	 * Every start time on a date at which the given duration still fits inside
	 * the opening hours.
	 *
	 * @param array<string, mixed> $apartment
	 * @param int                  $guests  Only affects the price, not the fit.
	 * @param array<string, mixed> $options includePast: offer times that have
	 *                                      already gone, which the admin needs
	 *                                      in order to record a walk-in after
	 *                                      the event. ignoreBookingId: the
	 *                                      booking being edited, so its own
	 *                                      window does not read as taken.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function for_date(
		array $apartment,
		string $date,
		float $hours,
		int $guests,
		array $options = array()
	): array {
		$include_past = (bool) ( $options['includePast'] ?? false );
		$ignore       = isset( $options['ignoreBookingId'] ) ? (int) $options['ignoreBookingId'] : null;
		$step = max( 15, (int) SettingsRepository::number( SettingsRepository::SLOT_STEP ) );

		$open  = new DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_START ) );
		$close = new DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_END ) );

		$now      = new DateTimeImmutable( current_time( 'mysql' ) );
		$duration = (int) round( $hours * MINUTE_IN_SECONDS * 60 );

		$slots = array();

		// Start times run across the day; a long booking is allowed to finish
		// after closing rather than disappearing from the picker.
		for ( $start = $open; $start <= $close; $start = $start->modify( "+$step minutes" ) ) {
			$end = $start->modify( '+' . $duration . ' seconds' );

			// Never offer a time that has already passed — unless the caller is
			// the admin, recording something that has already happened.
			if ( ! $include_past && $start <= $now ) {
				continue;
			}

			$starts_at = $start->format( 'Y-m-d H:i:s' );
			$ends_at   = $end->format( 'Y-m-d H:i:s' );

			$quote = RateCalculator::quote( $apartment, $starts_at, $ends_at, $guests );

			$slots[] = array(
				'start'     => $start->format( 'H:i' ),
				'end'       => $end->format( 'H:i' ),
				'startsAt'  => $starts_at,
				'endsAt'    => $ends_at,
				'available' => BookingsRepository::is_available(
					(int) $apartment['id'],
					$starts_at,
					$ends_at,
					$ignore
				),
				'past'      => $start <= $now,
				'total'     => $quote['subtotal'],
			);
		}

		return $slots;
	}

	/**
	 * What each duration costs on a date, so the picker can show "6 h — save
	 * €20" before a start time is chosen.
	 *
	 * @param array<string, mixed> $apartment
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function duration_options( array $apartment, string $date, int $guests ): array {
		$options = array();

		foreach ( self::durations() as $hours ) {
			$price = RateCalculator::duration_price( $apartment, $date . ' 12:00:00', (float) $hours );
			$guest = RateCalculator::guest_surcharge( $guests );

			$options[] = array(
				'hours'    => $hours,
				'total'    => round( $price['total'] + $guest['total'], 2 ),
				'discount' => $price['discount'],
			);
		}

		return $options;
	}
}
