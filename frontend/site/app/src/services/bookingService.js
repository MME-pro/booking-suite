/**
 * Guest-facing booking API.
 */

import { settings } from './apartmentService';

const request = async ( path, { method = 'GET', body, signal } = {} ) => {
	const base = settings.restUrl.replace( /\/$/, '' );

	const headers = { Accept: 'application/json' };

	if ( body ) {
		headers[ 'Content-Type' ] = 'application/json';
	}

	if ( settings.nonce ) {
		headers[ 'X-WP-Nonce' ] = settings.nonce;
	}

	const response = await fetch( `${ base }/${ path }`, {
		method,
		headers,
		credentials: 'same-origin',
		signal,
		body: body ? JSON.stringify( body ) : undefined,
	} );

	const text = await response.text();
	const payload = text ? JSON.parse( text ) : null;

	if ( ! response.ok ) {
		const error = new Error(
			payload?.message ?? 'Something went wrong. Please try again.'
		);

		error.field = payload?.data?.field ?? '';
		error.status = response.status;

		throw error;
	}

	return payload;
};

export const bookingService = {
	context: ( apartmentId, signal ) =>
		request( `public/booking-context/${ apartmentId }`, { signal } ),

	slots: ( { apartmentId, date, hours, guests }, signal ) =>
		request(
			`public/slots?apartmentId=${ apartmentId }&date=${ date }&hours=${ hours }&guests=${ guests }`,
			{ signal }
		),

	quote: ( payload, signal ) =>
		request( 'public/quote', { method: 'POST', body: payload, signal } ),

	book: ( payload, signal ) =>
		request( 'public/bookings', { method: 'POST', body: payload, signal } ),
};
