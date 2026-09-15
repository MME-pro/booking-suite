/**
 * Date helpers shared across the admin.
 *
 * Every booking time in this plugin is the PROPERTY'S wall clock. A stay booked
 * for 15:30 is 15:30 at the apartment: it is the time the guest arrives, the
 * time on the confirmation email, and the time the cleaner is told. It is not
 * an instant that should be re-expressed wherever the screen happens to be
 * open — an owner checking the calendar from another country wants to read the
 * same 15:30 their guest was told, not their own local translation of it.
 *
 * So `starts_at` and friends are stored, sent and read as a plain 'Y-m-d H:i:s'
 * in the site's timezone, and parsed here into a Date whose LOCAL components
 * are exactly those digits. Nothing converts. Formatting them back out with the
 * browser's local formatter therefore returns the digits it was given, on any
 * machine in any timezone.
 *
 * The one thing that genuinely is an instant is "now", which is why siteNow()
 * exists: it answers "what time is it at the property", so the now line on the
 * calendar and the highlight on today's cell mean what they say.
 */

import { settings } from '../settings';

/** 'Y-m-d H:i(:s)', with the seconds optional and 'T' tolerated. */
const STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * A stored timestamp as a Date carrying those exact wall-clock digits.
 *
 * Built from the parts rather than handed to `new Date( string )`, because that
 * reads a bare 'Y-m-dTH:i:s' as local on one engine and as UTC on another, and
 * appending 'Z' — which this used to do — declares the property's clock to be
 * UTC and shifts every time on screen by the viewer's own offset.
 *
 * @param {string} value A 'Y-m-d H:i:s' timestamp in the site's timezone.
 * @return {Date|null} The parsed date, or null when unparseable.
 */
export function toDate( value ) {
	if ( ! value ) {
		return null;
	}

	const parts = STAMP.exec( String( value ) );

	if ( ! parts ) {
		// Something else entirely — an ISO instant, say. Let the engine try.
		const loose = new Date( value );

		return Number.isNaN( loose.getTime() ) ? null : loose;
	}

	const date = new Date(
		Number( parts[ 1 ] ),
		Number( parts[ 2 ] ) - 1,
		Number( parts[ 3 ] ),
		Number( parts[ 4 ] ),
		Number( parts[ 5 ] ),
		Number( parts[ 6 ] ?? 0 )
	);

	return Number.isNaN( date.getTime() ) ? null : date;
}

/**
 * Now, on the property's clock, as a Date with those wall-clock components.
 *
 * Deliberately the same shape as everything toDate() returns, so the two can be
 * compared and subtracted without either one being converted. Falls back to the
 * viewer's clock when the site has no timezone to offer or names one this
 * browser has never heard of — a slightly wrong now line beats none.
 *
 * @return {Date} The site's current wall clock.
 */
export function siteNow() {
	const zone = settings.timezone;

	if ( ! zone ) {
		return new Date();
	}

	try {
		const parts = new Intl.DateTimeFormat( 'en-CA', {
			timeZone: zone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		} ).formatToParts( new Date() );

		const at = ( type ) =>
			Number( parts.find( ( part ) => part.type === type )?.value );

		return new Date(
			at( 'year' ),
			at( 'month' ) - 1,
			at( 'day' ),
			// Some engines render midnight as hour 24 under hour12:false.
			at( 'hour' ) % 24,
			at( 'minute' ),
			at( 'second' )
		);
	} catch ( error ) {
		return new Date();
	}
}

/**
 * 'YYYY-MM-DD' key for a Date, read from its local components.
 *
 * Which is the site's day, because that is what toDate() and siteNow() put
 * there.
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
 * Midnight, `offset` days from the property's today.
 *
 * @param {number} offset Days from today; negative reaches into the past.
 * @return {Date} Midnight on that day.
 */
export function dayOffset( offset ) {
	const date = siteNow();

	date.setHours( 0, 0, 0, 0 );
	date.setDate( date.getDate() + offset );

	return date;
}

/**
 * A stored timestamp as a 24-hour clock time.
 *
 * 24-hour throughout, per the plugin's own convention — an 11:00 checkout read
 * as "11:00 PM" is a whole day's difference to whoever is cleaning.
 *
 * @param {string} value A 'Y-m-d H:i:s' timestamp in the site's timezone.
 * @return {string} The time as HH:MM, or '' when unparseable.
 */
export function formatTime( value ) {
	const date = toDate( value );

	return date ? formatClock( date ) : '';
}

/**
 * A Date as a 24-hour clock time.
 *
 * Formatted in the browser's own zone on purpose: the Date it is given already
 * carries the site's wall clock in its local components, so this hands back the
 * digits that went in.
 *
 * @param {Date} date The moment to format.
 * @return {string} The time as HH:MM.
 */
export function formatClock( date ) {
	return new Intl.DateTimeFormat(
		String( settings.locale || 'de_DE' ).replace( '_', '-' ),
		{ hour: '2-digit', minute: '2-digit', hour12: false }
	).format( date );
}

/**
 * The `lang` a time input must carry to show a 24-hour clock.
 *
 * `<input type="time">` has no attribute for this. Browsers pick the clock
 * from the element's language, and an admin whose browser is set to US English
 * gets an AM/PM field with a third box to tab through — in a plugin whose
 * every other time, from the calendar to the invoices, is 24-hour. The stored
 * value is "14:30" either way; only what the operator types is different.
 *
 * The site's own locale is used where it is already a 24-hour one, so a German
 * admin gets a German field. Where it is not, en-GB stands in: still English,
 * still 24-hour.
 *
 * @return {string} A BCP-47 tag for the input's lang attribute.
 */
export function clockLang() {
	const locale = String( settings.locale || 'de_DE' ).replace( '_', '-' );

	try {
		const { hour12 } = new Intl.DateTimeFormat( locale, {
			hour: 'numeric',
		} ).resolvedOptions();

		return hour12 ? 'en-GB' : locale;
	} catch ( error ) {
		return 'en-GB';
	}
}
