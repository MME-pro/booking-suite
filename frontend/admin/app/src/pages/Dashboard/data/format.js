/**
 * Dashboard display helpers.
 */

import { settings } from '../../../settings';

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

/**
 * Axis and tooltip label for a 'YYYY-MM-DD' day key.
 *
 * @param {string}  key       The day key produced by metrics.dayKey().
 * @param {boolean} [verbose] Include the weekday — used in tooltips, where
 *                            there is room for it.
 */
export function formatDayLabel( key, verbose = false ) {
	const date = new Date( `${ key }T00:00:00` );

	if ( Number.isNaN( date.getTime() ) ) {
		return key;
	}

	return new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		day: 'numeric',
		month: 'short',
		...( verbose ? { weekday: 'short' } : {} ),
	} ).format( date );
}

/**
 * Compact money for axis ticks, where the full currency string is too wide.
 *
 * @param {number} value      The amount.
 * @param {string} [currency] ISO currency code.
 * @return {string} The formatted amount.
 */
export function formatCompactMoney( value, currency = 'EUR' ) {
	try {
		return new Intl.NumberFormat( toBcp47( settings.locale ), {
			style: 'currency',
			currency,
			notation: 'compact',
			maximumFractionDigits: 0,
		} ).format( value );
	} catch ( error ) {
		return String( value );
	}
}
