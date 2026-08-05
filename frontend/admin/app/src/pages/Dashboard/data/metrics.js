/**
 * Dashboard metrics.
 *
 * Pure derivations over the bookings/apartments payloads — no fetching, no
 * formatting. Kept separate from the components so the numbers can be reasoned
 * about (and corrected) in one place.
 *
 * Day bucketing lives in src/lib/dates.js, shared with the Calendar screen so
 * both agree on which local day a booking belongs to.
 */

import { dayKey, dayOffset, toDate } from '../../../lib/dates';

/** Booking statuses, in the order they progress. */
export const STATUS_ORDER = [ 'pending', 'reserved', 'confirmed', 'completed' ];

/** Payment states that count as money not yet in the bank. */
const OUTSTANDING_PAYMENTS = [ 'unpaid', 'partial' ];

export { dayKey, toDate };

/**
 * Headline numbers for the KPI row.
 *
 * @param {Array}  bookings   Bookings as returned by the REST layer.
 * @param {Array}  apartments Apartments as returned by the REST layer.
 * @param {Object} counts     Status counts from the bookings endpoint.
 */
export function summarise( bookings = [], apartments = [], counts = {} ) {
	const todayKey = dayKey( new Date() );
	const weekAhead = dayOffset( 7 );
	const now = new Date();

	let bookingsToday = 0;
	let revenue = 0;
	let outstanding = 0;
	let upcomingCheckIns = 0;
	let currency = 'EUR';

	for ( const booking of bookings ) {
		const created = toDate( booking.createdAt );
		const startsAt = toDate( booking.startsAt );
		const total = Number( booking.total ) || 0;

		if ( booking.currency ) {
			currency = booking.currency;
		}

		if ( created && dayKey( created ) === todayKey ) {
			bookingsToday++;
		}

		// Refunded bookings are money that went back out again.
		if ( 'refunded' !== booking.paymentStatus ) {
			revenue += total;
		}

		if ( OUTSTANDING_PAYMENTS.includes( booking.paymentStatus ) ) {
			outstanding += total;
		}

		if ( startsAt && startsAt >= now && startsAt <= weekAhead ) {
			upcomingCheckIns++;
		}
	}

	// counts comes straight from SQL and covers every booking, so it is the
	// more trustworthy source for status totals than the (filtered) list.
	const pending = Number( counts.pending ) || 0;
	const total = Number( counts.all ) || bookings.length;

	const activeApartments = apartments.filter( ( a ) => a.active ).length;

	return {
		bookingsToday,
		pending,
		confirmed: Number( counts.confirmed ) || 0,
		totalBookings: total,
		revenue,
		outstanding,
		upcomingCheckIns,
		currency,
		apartments: apartments.length,
		activeApartments,
	};
}

/**
 * Daily series for the charts.
 *
 * Every day in the window is emitted, including empty ones — gaps in a time
 * axis otherwise read as "no data collected" rather than "no bookings".
 *
 * @param {Array}  bookings
 * @param {number} days     Window length, ending today.
 * @return {Array<Object>} One row per day: { key, label, total, revenue, …statuses }
 */
export function dailySeries( bookings = [], days = 30 ) {
	const buckets = new Map();

	for ( let offset = days - 1; offset >= 0; offset-- ) {
		const date = dayOffset( -offset );
		const row = {
			key: dayKey( date ),
			date,
			total: 0,
			revenue: 0,
		};

		for ( const status of STATUS_ORDER ) {
			row[ status ] = 0;
		}

		buckets.set( row.key, row );
	}

	for ( const booking of bookings ) {
		const created = toDate( booking.createdAt );

		if ( ! created ) {
			continue;
		}

		const row = buckets.get( dayKey( created ) );

		if ( ! row ) {
			continue;
		}

		row.total++;

		if ( STATUS_ORDER.includes( booking.status ) ) {
			row[ booking.status ]++;
		}

		if ( 'refunded' !== booking.paymentStatus ) {
			row.revenue += Number( booking.total ) || 0;
		}
	}

	return [ ...buckets.values() ];
}

/**
 * Totals per status across a series, for the legend's visible values.
 *
 * @param {Array<Object>} series Rows from dailySeries().
 * @return {Object} Totals keyed by status.
 */
export function statusTotals( series = [] ) {
	const totals = {};

	for ( const status of STATUS_ORDER ) {
		totals[ status ] = series.reduce(
			( acc, row ) => acc + ( row[ status ] || 0 ),
			0
		);
	}

	return totals;
}
