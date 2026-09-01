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

use BookingSuite\Backend\Repositories\ApartmentsRepository;
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
	 * Somewhere else to go when the chosen day is full.
	 *
	 * A guest who asks for Saturday and is told "nothing free" leaves. So when
	 * the requested date has nothing, the picker is handed the next thing that
	 * does, in the order a guest would ask for it themselves:
	 *
	 *   1. the same apartment on the soonest later day that has room
	 *   2. failing that, other apartments — starting on the day originally
	 *      asked for, then working forward
	 *
	 * Only apartments that actually take the party are offered; suggesting a
	 * two-person studio to a family of four is another dead end with an extra
	 * click in front of it.
	 *
	 * One busy_windows() call covers every candidate over the whole horizon.
	 * The obvious implementation — for_date() per apartment per day — is around
	 * fifty availability queries a day each, which at fourteen days and three
	 * apartments is a couple of thousand round trips to draw one panel.
	 *
	 * @param array<string, mixed> $apartment The one the guest is looking at.
	 * @param string               $date      The date that came up empty.
	 *
	 * @return array{sameApartment: array<string, mixed>|null, otherApartments: array<int, array<string, mixed>>}
	 */
	public static function alternatives(
		array $apartment,
		string $date,
		float $hours,
		int $guests,
		int $horizon = 14,
		int $limit = 3
	): array {
		$empty = array(
			'sameApartment'   => null,
			'otherApartments' => array(),
		);

		$start_day = DateTimeImmutable::createFromFormat( 'Y-m-d', $date );

		if ( ! $start_day ) {
			return $empty;
		}

		$this_id = (int) $apartment['id'];

		// Candidates: this apartment for later days, plus every other active
		// one big enough for the party.
		$others = array();

		foreach ( ApartmentsRepository::all( array( 'active' => true ) ) as $row ) {
			if ( (int) $row['id'] === $this_id ) {
				continue;
			}

			$capacity = (int) ( $row['capacity'] ?? 0 );

			if ( $capacity > 0 && $guests > $capacity ) {
				continue;
			}

			$others[ (int) $row['id'] ] = $row;
		}

		$ids  = array_merge( array( $this_id ), array_keys( $others ) );
		$last = $start_day->modify( '+' . max( 1, $horizon ) . ' days' );

		$busy = BookingsRepository::busy_windows(
			$ids,
			$start_day->format( 'Y-m-d' ) . ' 00:00:00',
			$last->format( 'Y-m-d' ) . ' 23:59:59'
		);

		$same   = null;
		$picked = array();

		for ( $offset = 0; $offset <= $horizon; $offset++ ) {
			$day = $start_day->modify( '+' . $offset . ' days' )->format( 'Y-m-d' );

			// The requested day is already known to be empty for this
			// apartment — that is why we are here — so it only starts being a
			// candidate for itself from the following day.
			if ( null === $same && $offset > 0 ) {
				$free = self::free_starts(
					$apartment,
					$day,
					$hours,
					$guests,
					$busy[ $this_id ] ?? array()
				);

				if ( $free ) {
					$same = array(
						'date'  => $day,
						'slots' => $free,
					);
				}
			}

			foreach ( $others as $id => $row ) {
				if ( count( $picked ) >= $limit || isset( $picked[ $id ] ) ) {
					continue;
				}

				$free = self::free_starts(
					$row,
					$day,
					$hours,
					$guests,
					$busy[ $id ] ?? array()
				);

				if ( $free ) {
					$picked[ $id ] = array(
						'id'    => $id,
						'name'  => (string) $row['name'],
						// A name and a price is not an offer. Being sent to a
						// different apartment than the one you came for is
						// exactly the moment a guest wants to see it.
						'image' => ApartmentsRepository::image( $row, 'medium' ),
						'date'  => $day,
						'slots' => $free,
					);
				}
			}

			if ( null !== $same && count( $picked ) >= $limit ) {
				break;
			}
		}

		return array(
			'sameApartment'   => $same,
			'otherApartments' => array_values( $picked ),
		);
	}

	/**
	 * The free starts on one day, tested against windows already in hand.
	 *
	 * The same grid for_date() walks, checked in PHP rather than a query per
	 * start. The windows arrive from busy_windows(), which has already grown
	 * each one by that apartment's cleaning turnaround, so nothing here has to
	 * know about the buffer.
	 *
	 * @param array<string, mixed>                    $apartment
	 * @param array<int, array{0: string, 1: string}> $busy
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function free_starts(
		array $apartment,
		string $date,
		float $hours,
		int $guests,
		array $busy,
		int $limit = 6
	): array {
		$step = max( 15, (int) SettingsRepository::number( SettingsRepository::SLOT_STEP ) );

		$open  = new DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_START ) );
		$close = new DateTimeImmutable( $date . ' ' . SettingsRepository::get( SettingsRepository::DAY_END ) );
		$now   = new DateTimeImmutable( current_time( 'mysql' ) );

		$duration = (int) round( $hours * HOUR_IN_SECONDS );
		$found    = array();

		for ( $start = $open; $start <= $close; $start = $start->modify( "+$step minutes" ) ) {
			if ( count( $found ) >= $limit ) {
				break;
			}

			if ( $start <= $now ) {
				continue;
			}

			$end = $start->modify( '+' . $duration . ' seconds' );

			$starts_at = $start->format( 'Y-m-d H:i:s' );
			$ends_at   = $end->format( 'Y-m-d H:i:s' );

			foreach ( $busy as $window ) {
				// Touching ranges do not overlap: one may end exactly as the
				// other begins.
				if ( $window[0] < $ends_at && $window[1] > $starts_at ) {
					continue 2;
				}
			}

			$quote = RateCalculator::quote( $apartment, $starts_at, $ends_at, $guests );

			$found[] = array(
				'start'    => $start->format( 'H:i' ),
				'end'      => $end->format( 'H:i' ),
				'startsAt' => $starts_at,
				'endsAt'   => $ends_at,
				'total'    => $quote['subtotal'],
			);
		}

		return $found;
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
			$guest = RateCalculator::guest_surcharge( $apartment, $guests );

			$options[] = array(
				'hours'    => $hours,
				'total'    => round( $price['total'] + $guest['total'], 2 ),
				'discount' => $price['discount'],
			);
		}

		return $options;
	}
}
