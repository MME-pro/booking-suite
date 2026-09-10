/**
 * Display helpers for bookings.
 */

import { settings } from '../../../settings';
import { toDate } from '../../../lib/dates';

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

/*
 * Booking times are the property's wall clock, not an instant — see
 * lib/dates.js. toDate keeps them that way; this used to append 'Z' and shift
 * every booking on the list by the viewer's own offset.
 */
export function formatDateTime( value ) {
	const date = toDate( value );

	if ( ! date ) {
		return value ? String( value ) : '';
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
