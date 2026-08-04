/**
 * Formatting helpers.
 */

// WordPress locales are de_DE; Intl wants de-DE.
const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

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

// Whole nights between two yyyy-mm-dd strings; 0 when the range is invalid.
export function countNights( checkIn, checkOut ) {
	if ( ! checkIn || ! checkOut ) {
		return 0;
	}

	const start = new Date( `${ checkIn }T00:00:00` );
	const end = new Date( `${ checkOut }T00:00:00` );

	if ( Number.isNaN( start.getTime() ) || Number.isNaN( end.getTime() ) ) {
		return 0;
	}

	const nights = Math.round( ( end - start ) / 86400000 );

	return nights > 0 ? nights : 0;
}
