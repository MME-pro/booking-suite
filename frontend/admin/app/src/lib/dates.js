/**
 * Date helpers shared across the admin.
 *
 * Booking timestamps arrive as 'Y-m-d H:i:s' in UTC (the convention in
 * pages/Bookings/data/format.js) and are bucketed by LOCAL day everywhere, so
 * the calendar, the dashboard charts and the formatted times all agree on which
 * day a booking belongs to.
 */

/**
 * @param {string} value A 'Y-m-d H:i:s' UTC timestamp.
 * @return {Date|null} The parsed date, or null when unparseable.
 */
export function toDate( value ) {
	if ( ! value ) {
		return null;
	}

	const date = new Date( String( value ).replace( ' ', 'T' ) + 'Z' );

	return Number.isNaN( date.getTime() ) ? null : date;
}

/**
 * Local 'YYYY-MM-DD' key for a Date.
 *
 * @param {Date} date The date to key.
 * @return {string} The day key.
 */
export function dayKey( date ) {
	const year = date.getFullYear();
	const month = String( date.getMonth() + 1 ).padStart( 2, '0' );
	const day = String( date.getDate() ).padStart( 2, '0' );

	return `${ year }-${ month }-${ day }`;
}

/**
 * Midnight local, `offset` days from today.
 *
 * @param {number} offset Days from today; negative reaches into the past.
 * @return {Date} Midnight on that day.
 */
export function dayOffset( offset ) {
	const date = new Date();

	date.setHours( 0, 0, 0, 0 );
	date.setDate( date.getDate() + offset );

	return date;
}
