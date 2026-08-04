/**
 * Display helpers for bookings.
 */

import { settings } from '../../../settings';

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

// Booking times are stored as 'Y-m-d H:i:s' in UTC.
export function formatDateTime( value ) {
	if ( ! value ) {
		return '';
	}

	const date = new Date( value.replace( ' ', 'T' ) + 'Z' );

	if ( Number.isNaN( date.getTime() ) ) {
		return value;
	}

	return new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		dateStyle: 'medium',
		timeStyle: 'short',
		// 24-hour throughout, as the brief asks.
		hour12: false,
	} ).format( date );
}

export function formatMoney( amount, currency = 'EUR' ) {
	try {
		return new Intl.NumberFormat( toBcp47( settings.locale ), {
			style: 'currency',
			currency,
		} ).format( amount );
	} catch ( error ) {
		return `${ amount } ${ currency }`;
	}
}
