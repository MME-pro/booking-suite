/**
 * The public holidays falling in a displayed month.
 *
 * Asks for the whole month either side of its edges, because a calendar grid
 * shows the last days of the previous month and the first of the next, and a
 * holiday sitting in that overhang should still be marked.
 */

import { useEffect, useState } from 'react';

import { holidayService } from '../services';

/**
 * Y-m-d in local time; toISOString would shift the day west of UTC.
 *
 * @param {Date} date
 * @return {string} The date as Y-m-d.
 */
const iso = ( date ) => {
	const pad = ( n ) => String( n ).padStart( 2, '0' );

	return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad(
		date.getDate()
	) }`;
};

/**
 * @param {Date} month Any date within the month on screen.
 * @return {Object} Date (Y-m-d) => holiday name.
 */
export function useHolidays( month ) {
	const [ holidays, setHolidays ] = useState( {} );

	// Primitive, so the effect does not re-run on every new Date object with
	// the same month in it.
	const key = month ? `${ month.getFullYear() }-${ month.getMonth() }` : '';

	useEffect( () => {
		if ( ! key ) {
			return undefined;
		}

		const [ year, index ] = key.split( '-' ).map( Number );

		// A week either side covers the grid's overhang in every locale.
		const from = new Date( year, index, 1 );
		const to = new Date( year, index + 1, 0 );

		from.setDate( from.getDate() - 7 );
		to.setDate( to.getDate() + 7 );

		const controller = new AbortController();

		holidayService
			.range( iso( from ), iso( to ), controller.signal )
			.then( setHolidays )
			.catch( () => {
				// A calendar without holiday labels is still a calendar.
				setHolidays( {} );
			} );

		return () => controller.abort();
	}, [ key ] );

	return holidays;
}

export default useHolidays;
