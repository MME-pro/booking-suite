/**
 * Turning locks into bars on a month grid.
 *
 * A lock is a RANGE, and the board used to draw it as a chip in every day it
 * touched: a week closed for maintenance was seven identical boxes saying the
 * same thing seven times, and nothing on screen said they were one lock. What
 * an operator needs to see is the shape of the closure — where it starts,
 * where it ends, how much of the month it eats.
 *
 * So a lock becomes a bar. The awkward part, and the reason this is a module
 * with tests rather than a few lines in the component, is that a bar cannot
 * always be one box: a range crossing a Sunday covers cells that are not
 * beside each other any more, so it has to break at the week edge and pick up
 * again on the next row. Getting the break, the length or the rounded ends
 * wrong is the difference between a calendar and a smear.
 */

import { addDays, differenceInCalendarDays, startOfWeek } from 'date-fns';

import { dayKey, toDate } from '../../../lib/dates';

/** Days in a grid row. */
const WEEK = 7;

/** A runaway guard: a lock can run for months, but not for years. */
const MAX_DAYS = 400;

/**
 * Which locks cover which day, and which days each lock covers.
 *
 * Both come out of the same walk so they cannot disagree. A bar that covered
 * different days from the shading under it would be worse than no bar at all.
 *
 * The end day is INCLUSIVE, which is what the board has always shaded: a lock
 * is written by the operator as "closed from the 1st to the 7th" and means the
 * 7th.
 *
 * @param {Array<Object>} blocks Locks from the REST layer.
 * @return {{days: Map<string, Array<Object>>, spans: Map<number, Object>}}
 *         Day key → locks, and lock id → { keys, first, last }.
 */
export function buildCoverage( blocks = [] ) {
	const days = new Map();
	const spans = new Map();

	for ( const block of blocks ) {
		const start = toDate( block.startsAt );
		const end = toDate( block.endsAt );

		if ( ! start || ! end ) {
			continue;
		}

		// Walked from local midnight so a daylight-saving shift cannot skip a
		// day out of the middle of a range.
		const cursor = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate()
		);

		const keys = [];

		for ( let guard = 0; guard < MAX_DAYS; guard++ ) {
			const key = dayKey( cursor );

			if ( ! days.has( key ) ) {
				days.set( key, [] );
			}

			days.get( key ).push( block );
			keys.push( key );

			cursor.setDate( cursor.getDate() + 1 );

			if ( cursor > end ) {
				break;
			}
		}

		spans.set( block.id, {
			keys: new Set( keys ),
			first: keys[ 0 ],
			last: keys[ keys.length - 1 ],
		} );
	}

	return { days, spans };
}

/**
 * Which row each lock's bar sits on, for the whole month.
 *
 * Assigned once rather than per cell, because a bar has to stay on the same
 * line all the way across: work it out cell by cell and a lock would step up
 * or down a row wherever an overlapping one starts or ends.
 *
 * Earliest first, longest first among those, then the first row whose previous
 * occupant has finished — ordinary greedy packing, which keeps the long
 * closures on the top rows where the eye follows them.
 *
 * @param {Array<Object>}       blocks The locks to place.
 * @param {Map<number, Object>} spans  From buildCoverage().
 * @return {Map<number, number>} Lock id → row index.
 */
export function assignLanes( blocks = [], spans ) {
	const lanes = new Map();

	/** The last day currently occupied on each row. */
	const occupied = [];

	const ordered = [ ...blocks ]
		.filter( ( block ) => spans.has( block.id ) )
		.sort( ( a, b ) => {
			const first = spans
				.get( a.id )
				.first.localeCompare( spans.get( b.id ).first );

			return (
				first ||
				spans.get( b.id ).last.localeCompare( spans.get( a.id ).last )
			);
		} );

	for ( const block of ordered ) {
		const span = spans.get( block.id );

		// Day keys sort as dates do, so a plain comparison is enough.
		let lane = occupied.findIndex( ( end ) => end < span.first );

		if ( -1 === lane ) {
			lane = occupied.length;
		}

		occupied[ lane ] = span.last;
		lanes.set( block.id, lane );
	}

	return lanes;
}

/**
 * The stretch of a lock that BEGINS on this day, or null.
 *
 * A run starts either where the lock does or at the left edge of a week, and
 * stops at the lock's end or the right edge, whichever comes first. Every
 * other covered day returns null — the bar is already drawn, hanging over this
 * cell from an earlier one.
 *
 * `isStart` and `isEnd` are about the LOCK, not the run: they say which ends
 * are real, so a range carrying on into the next week is drawn square there
 * and rounded only where it truly begins and finishes.
 *
 * @param {Map<number, Object>} spans  From buildCoverage().
 * @param {Object}              block  The lock.
 * @param {Date}                date   The day being drawn.
 * @param {Object}              locale A date-fns locale; decides which day
 *                                     opens the week.
 * @return {{length: number, isStart: boolean, isEnd: boolean}|null} The run.
 */
export function runFrom( spans, block, date, locale ) {
	const span = spans.get( block.id );
	const key = dayKey( date );

	if ( ! span || ! span.keys.has( key ) ) {
		return null;
	}

	const column = differenceInCalendarDays(
		date,
		startOfWeek( date, { locale } )
	);

	const isStart = key === span.first;

	// Anything else is a day the bar passes over, not one it begins on.
	if ( ! isStart && 0 !== column ) {
		return null;
	}

	let length = 1;

	while ( column + length < WEEK ) {
		if ( ! span.keys.has( dayKey( addDays( date, length ) ) ) ) {
			break;
		}

		length++;
	}

	return {
		length,
		isStart,
		isEnd: dayKey( addDays( date, length - 1 ) ) === span.last,
	};
}
