/**
 * Formatting helpers.
 */

import { fromKey, wpFormat } from './date';
import { settings } from '../services/apartmentService';

// WordPress locales are de_DE; Intl wants de-DE.
const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

/**
 * A 'yyyy-mm-dd' date, written the way Settings → General says.
 *
 * Returns the input unchanged when it will not parse, so a malformed value
 * shows as itself rather than as "Invalid Date" in the middle of a booking
 * summary.
 *
 * @param {string} key A 'yyyy-mm-dd' date.
 * @return {string} The formatted date.
 */
export function formatWpDate( key ) {
	const date = fromKey( key );

	return date
		? wpFormat( date, settings.dateFormat || 'j F Y', settings.locale )
		: String( key ?? '' );
}

/**
 * An 'HH:MM' time, written the way Settings → General says.
 *
 * @param {string} time An 'HH:MM' time.
 * @return {string} The formatted time.
 */
export function formatWpTime( time ) {
	const parts = /^([01]?\d|2[0-3]):([0-5]\d)/.exec( String( time ?? '' ) );

	if ( ! parts ) {
		return String( time ?? '' );
	}

	// The date carries no meaning here; only the clock parts are formatted.
	const date = new Date(
		2000,
		0,
		1,
		Number( parts[ 1 ] ),
		Number( parts[ 2 ] )
	);

	/*
	 * Always 24-hour, rather than following Settings → General.
	 *
	 * The slot buttons come from the server already formatted as HH:MM, so a
	 * site whose WordPress clock is set to 'g:i a' would show "2:30 pm" in the
	 * summary beside a button reading "14:30" — the same time twice, in two
	 * conventions, on one screen. The brief asks for one clock throughout, and
	 * this is where it is decided.
	 */
	return wpFormat( date, 'H:i', settings.locale );
}

export function formatPrice( amount, currency = 'EUR', locale = 'de_DE' ) {
	try {
		return new Intl.NumberFormat( toBcp47( locale ), {
			style: 'currency',
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		} ).format( amount );
	} catch ( error ) {
		// An unknown currency or locale should not blank out the price.
		return `${ amount } ${ currency }`;
	}
}
