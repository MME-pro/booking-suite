/**
 * Calendar occupancy.
 *
 * Turns the flat bookings list into "which bookings touch which day", which is
 * what both the month grid and the day table below it read from.
 *
 * A stay is indexed from its arrival day through its departure day INCLUSIVE.
 * The departure day is not an occupied night, but an operator looking at a date
 * still needs to see who is leaving that morning — so it is included and tagged
 * as a departure rather than silently dropped.
 */

import { dayKey, toDate } from '../../../lib/dates';

/** How a booking relates to the day being looked at. */
export const ARRIVAL = 'arrival';
export const DEPARTURE = 'departure';
export const STAYING = 'staying';

/**
 * Index bookings by local day.
 *
 * @param {Array<Object>} bookings Bookings from the REST layer.
 * @return {Map<string, Array<Object>>} Day key → entries, each
 *                                      { booking, role } sorted arrivals first.
 */
export function buildOccupancy( bookings = [] ) {
	const days = new Map();

	for ( const booking of bookings ) {
		const start = toDate( booking.startsAt );
		const end = toDate( booking.endsAt );

		if ( ! start ) {
			continue;
		}

		const startKey = dayKey( start );
		const endKey = end ? dayKey( end ) : startKey;

		// Walk local midnights so daylight-saving shifts cannot skip a day.
		const cursor = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate()
		);

		// A runaway guard: no stay in this system is years long, and a bad
		// timestamp should not spin here forever.
		for ( let guard = 0; guard < 400; guard++ ) {
			const key = dayKey( cursor );

			let role = STAYING;

			if ( key === startKey ) {
				role = ARRIVAL;
			} else if ( key === endKey ) {
				role = DEPARTURE;
			}

			if ( ! days.has( key ) ) {
				days.set( key, [] );
			}

			days.get( key ).push( { booking, role } );

			if ( key === endKey ) {
				break;
			}

			cursor.setDate( cursor.getDate() + 1 );
		}
	}

	// Arrivals first, then guests in residence, then departures — the order an
	// operator works through a day.
	const weight = { [ ARRIVAL ]: 0, [ STAYING ]: 1, [ DEPARTURE ]: 2 };

	for ( const entries of days.values() ) {
		entries.sort( ( a, b ) => weight[ a.role ] - weight[ b.role ] );
	}

	return days;
}

/**
 * The entries for one day, filtered to the apartments currently shown.
 *
 * @param {Map<string, Array<Object>>} occupancy    From buildOccupancy().
 * @param {Date|null}                  date         The selected day.
 * @param {Set<number>|null}           apartmentIds Apartments to include, or
 *                                                  null for all of them.
 * @return {Array<Object>} The day's entries.
 */
export function entriesForDay( occupancy, date, apartmentIds = null ) {
	if ( ! date ) {
		return [];
	}

	const entries = occupancy.get( dayKey( date ) ) ?? [];

	if ( ! apartmentIds ) {
		return entries;
	}

	return entries.filter( ( entry ) =>
		apartmentIds.has( entry.booking.apartmentId )
	);
}
