/**
 * Calendar segments — what the week and day time grids are drawn from.
 *
 * The month grid asks "which bookings touch this day" (data/occupancy.js). A
 * time grid asks something narrower: "where inside this day does each booking
 * sit". A stay that runs Friday 15:00 to Monday 11:00 is not one block on a
 * time grid — it is a Friday afternoon, two solid days, and a Monday morning.
 * So each booking is CLIPPED to the day it is being drawn in, and the clipping
 * is what makes check-in and check-out times visible at all: the operator can
 * see 15:00 and 11:00 on the right columns instead of a bar with no edges.
 *
 * Positions are minutes from local midnight, which is the one unit both grids
 * and the "now" line can share without re-deriving dates.
 */

import { addDays, startOfWeek } from 'date-fns';

import { toDate } from '../../../lib/dates';

/** A day, in the unit the grids position with. */
export const MINUTES_IN_DAY = 1440;

/**
 * The shortest segment the grid will draw.
 *
 * A booking that ends at 00:15 would otherwise be a hairline no one can click,
 * and a zero-length one — which bad data does produce — would vanish entirely.
 */
const MIN_MINUTES = 30;

/**
 * Local midnight starting the day `date` falls in.
 *
 * @param {Date} date Any moment in the day.
 * @return {Date} That day's midnight.
 */
const midnight = ( date ) =>
	new Date( date.getFullYear(), date.getMonth(), date.getDate() );

/**
 * Minutes from `from` to `date`, clamped into a single day.
 *
 * @param {Date} date The moment to place.
 * @param {Date} from The day's midnight.
 * @return {number} Minutes into the day, 0–1440.
 */
const minutesInto = ( date, from ) =>
	Math.max( 0, Math.min( MINUTES_IN_DAY, ( date - from ) / 60000 ) );

/**
 * The seven days of the week `date` falls in.
 *
 * The locale decides which day opens the week — Monday for German, Sunday for
 * English — the same way it does for the month grid's weekday headings, so the
 * two views never disagree about where a week begins.
 *
 * @param {Date}   date   Any day in the week.
 * @param {Object} locale A date-fns locale.
 * @return {Array<Date>} The week's days, in order.
 */
export function weekDays( date, locale ) {
	const first = startOfWeek( date, { locale } );

	return Array.from( { length: 7 }, ( _, index ) =>
		midnight( addDays( first, index ) )
	);
}

/**
 * Bookings clipped to one day.
 *
 * @param {Array<Object>}    bookings     Bookings from the REST layer.
 * @param {Date}             date         The day to clip to.
 * @param {Set<number>|null} apartmentIds Apartments to include, or null for
 *                                        all of them.
 * @return {Array<Object>} Segments, earliest first, each carrying the booking,
 *                         its minute span inside this day, and whether the
 *                         real start and end fall on this day.
 */
export function segmentsForDay( bookings = [], date, apartmentIds = null ) {
	if ( ! date ) {
		return [];
	}

	const dayStart = midnight( date );
	const dayEnd = addDays( dayStart, 1 );

	const segments = [];

	for ( const booking of bookings ) {
		if ( apartmentIds && ! apartmentIds.has( booking.apartmentId ) ) {
			continue;
		}

		const start = toDate( booking.startsAt );

		if ( ! start ) {
			continue;
		}

		let end = toDate( booking.endsAt );

		// An unusable end still has to be visible — an hour is enough to see
		// and click, and the drawer behind it tells the real story.
		if ( ! end || end <= start ) {
			end = new Date( start.getTime() + 3600000 );
		}

		/*
		 * A stay that ends at exactly midnight belongs to the day before it,
		 * not to this one — the same exclusive-end rule the availability query
		 * and the lock index already use.
		 */
		if ( end <= dayStart || start >= dayEnd ) {
			continue;
		}

		const startsHere = start >= dayStart;
		const endsHere = end <= dayEnd;

		const from = startsHere ? minutesInto( start, dayStart ) : 0;
		const to = endsHere ? minutesInto( end, dayStart ) : MINUTES_IN_DAY;

		segments.push( {
			booking,
			startsHere,
			endsHere,
			startMinutes: from,
			endMinutes: Math.min(
				MINUTES_IN_DAY,
				Math.max( to, from + MIN_MINUTES )
			),
		} );
	}

	/*
	 * Earliest first, and the longer of two that start together first — which
	 * is the order the lane packing below needs to put the long stay on the
	 * left and the short one beside it, rather than the other way round.
	 */
	segments.sort(
		( a, b ) =>
			a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes
	);

	return segments;
}

/**
 * Share the column's width between segments that overlap in time.
 *
 * Overlaps are the normal case here, not the exception: a week column is the
 * whole estate on one day, so five apartments occupied at once is five
 * segments covering the same hours. They are grouped into clusters of
 * transitively-overlapping segments and each cluster splits the width, so a
 * quiet morning still draws full-width blocks instead of every block in the
 * day being squeezed to the width of the busiest hour.
 *
 * @param {Array<Object>} segments From segmentsForDay(), already sorted.
 * @return {Array<Object>} The same segments with `lane` and `lanes` added.
 */
export function layoutSegments( segments = [] ) {
	const placed = [];

	let cluster = [];
	let clusterEnd = -1;

	const flush = () => {
		if ( 0 === cluster.length ) {
			return;
		}

		/** The end of the segment currently occupying each lane. */
		const laneEnds = [];

		for ( const segment of cluster ) {
			let lane = laneEnds.findIndex(
				( end ) => end <= segment.startMinutes
			);

			if ( -1 === lane ) {
				lane = laneEnds.length;
			}

			laneEnds[ lane ] = segment.endMinutes;
			segment.lane = lane;
		}

		for ( const segment of cluster ) {
			placed.push( { ...segment, lanes: laneEnds.length } );
		}

		cluster = [];
		clusterEnd = -1;
	};

	for ( const segment of segments ) {
		if ( cluster.length > 0 && segment.startMinutes >= clusterEnd ) {
			flush();
		}

		cluster.push( { ...segment } );
		clusterEnd = Math.max( clusterEnd, segment.endMinutes );
	}

	flush();

	return placed;
}

/**
 * A day's segments, clipped and laid out in one step.
 *
 * @param {Array<Object>}    bookings     Bookings from the REST layer.
 * @param {Date}             date         The day to draw.
 * @param {Set<number>|null} apartmentIds Apartments to include, or null.
 * @return {Array<Object>} Positioned segments.
 */
export function daySegments( bookings, date, apartmentIds = null ) {
	return layoutSegments( segmentsForDay( bookings, date, apartmentIds ) );
}

/**
 * Minutes from midnight to now, or null when `date` is not today.
 *
 * @param {Date} date The day a column is drawing.
 * @param {Date} now  The current moment.
 * @return {number|null} Where the now line goes, or null for no line.
 */
export function nowMinutes( date, now = new Date() ) {
	if (
		! date ||
		date.getFullYear() !== now.getFullYear() ||
		date.getMonth() !== now.getMonth() ||
		date.getDate() !== now.getDate()
	) {
		return null;
	}

	return now.getHours() * 60 + now.getMinutes();
}
