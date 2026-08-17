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

/**
 * The days one lock covers, as day keys.
 *
 * Locks are indexed from their own strings rather than through toDate(), and
 * the reason is worth stating: toDate() reads a timestamp as UTC and then
 * buckets it by local day, which is right for a booking — a real instant — but
 * wrong for a lock. A lock is a wall-clock range, written by the operator as
 * plain dates or read out of a portal calendar as plain dates, and it means
 * those dates in the property's own reckoning. Sending it through a UTC parse
 * would drift it by an hour and, for anything at midnight, by a whole day.
 *
 * The end is EXCLUSIVE, which is both the iCalendar convention and the one the
 * availability query already uses (`starts_at < to AND ends_at > from`). So a
 * lock of 13 Sep 00:00 → 14 Sep 00:00 covers the 13th alone. A lock that ends
 * part-way through a day still covers that day, because for part of it the
 * apartment was unavailable.
 *
 * @param {Object} block A lock from the REST layer.
 * @return {Array<string>} The day keys it covers, in order.
 */
function daysCovered( block ) {
	const startsAt = String( block.startsAt ?? '' );

	if ( 10 > startsAt.length ) {
		return [];
	}

	const [ year, month, day ] = startsAt
		.slice( 0, 10 )
		.split( '-' )
		.map( Number );

	if ( ! year || ! month || ! day ) {
		return [];
	}

	const endsAt = String( block.endsAt ?? '' );

	// Built from local parts, so no timezone is ever applied to it.
	const cursor = new Date( year, month - 1, day );
	const startDay = startsAt.slice( 0, 10 );

	/*
	 * Midnight is where the exclusive end bites: an end of exactly 00:00 stops
	 * at the previous day, anything later still touches its own day.
	 */
	let lastDay = startDay;

	if ( 10 <= endsAt.length ) {
		lastDay =
			'00:00:00' === endsAt.slice( 11, 19 )
				? previousDay( endsAt.slice( 0, 10 ) )
				: endsAt.slice( 0, 10 );
	}

	// A zero-length or backwards lock still belongs to the day it starts on.
	if ( lastDay < startDay ) {
		lastDay = startDay;
	}

	const keys = [];

	// The same runaway guard buildOccupancy() uses: a lock can legitimately run
	// for months, but not for years, and bad data should not spin here.
	for ( let guard = 0; guard < 400; guard++ ) {
		const key = dayKey( cursor );

		keys.push( key );

		if ( key >= lastDay ) {
			break;
		}

		cursor.setDate( cursor.getDate() + 1 );
	}

	return keys;
}

/**
 * The day before a 'YYYY-MM-DD' key.
 *
 * @param {string} key The day key.
 * @return {string} The key of the day before it.
 */
function previousDay( key ) {
	const [ year, month, day ] = key.split( '-' ).map( Number );
	const date = new Date( year, month - 1, day );

	date.setDate( date.getDate() - 1 );

	return dayKey( date );
}

/**
 * Index availability locks by local day.
 *
 * @param {Array<Object>} blocks Locks from the REST layer.
 * @return {Map<string, Array<Object>>} Day key → the locks covering it.
 */
export function buildBlockDays( blocks = [] ) {
	const days = new Map();

	for ( const block of blocks ) {
		// Extras locks belong to the extras board, not the apartment calendar.
		if ( block.extraId ) {
			continue;
		}

		for ( const key of daysCovered( block ) ) {
			if ( ! days.has( key ) ) {
				days.set( key, [] );
			}

			days.get( key ).push( block );
		}
	}

	/*
	 * Estate-wide locks first: one of those closes everything, and it explains
	 * the per-apartment locks that may be sitting under it.
	 */
	for ( const entries of days.values() ) {
		entries.sort(
			( a, b ) =>
				Number( Boolean( b.isMaster ) ) -
				Number( Boolean( a.isMaster ) )
		);
	}

	return days;
}

/**
 * The locks on one day, filtered to the apartments currently shown.
 *
 * An estate-wide lock survives every filter — it covers whichever apartments
 * are on screen by definition, so hiding it with the others would be wrong.
 *
 * @param {Map<string, Array<Object>>} index        From buildBlockDays().
 * @param {Date|null}                  date         The day.
 * @param {Set<number>|null}           apartmentIds Apartments to include, or
 *                                                  null for all of them.
 * @return {Array<Object>} The day's locks.
 */
export function blocksForDay( index, date, apartmentIds = null ) {
	if ( ! date || ! index ) {
		return [];
	}

	const blocks = index.get( dayKey( date ) ) ?? [];

	if ( ! apartmentIds ) {
		return blocks;
	}

	return blocks.filter(
		( block ) => block.isMaster || apartmentIds.has( block.apartmentId )
	);
}
