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

		/*
		 * The code, not only the sentence. A caller that wants to RECOVER
		 * from a particular refusal — an address whose proof has lapsed, say
		 * — cannot do it by matching on a message that is translated.
		 */
		error.code = payload?.code ?? '';
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

	/**
	 * The nights this apartment cannot be booked for, so the picker can
	 * refuse them instead of offering them and then objecting.
	 *
	 * @param {Object}      range             The window to ask about.
	 * @param {number}      range.apartmentId The apartment.
	 * @param {string}      range.from        First night, 'YYYY-MM-DD'.
	 * @param {string}      range.to          Last night, 'YYYY-MM-DD'.
	 * @param {AbortSignal} [signal]          Cancels the request.
	 * @return {Promise<Object>} { from, to, taken }.
	 */
	nights: ( { apartmentId, from, to }, signal ) =>
		request(
			`public/nights?apartmentId=${ apartmentId }&from=${ from }&to=${ to }`,
			{ signal }
		),

	quote: ( payload, signal ) =>
		request( 'public/quote', { method: 'POST', body: payload, signal } ),

	book: ( payload, signal ) =>
		request( 'public/bookings', { method: 'POST', body: payload, signal } ),

	/**
	 * Tell the owner the transfer is on its way.
	 *
	 * The token is the whole credential — see PaymentLink on the server — so
	 * this works from a link in an email, with no session and no login.
	 *
	 * @param {string}      token    The booking's payment token.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The payment payload, as it now stands.
	 */
	declareTransfer: ( token, signal ) =>
		request( `public/payment/${ token }/declared`, {
			method: 'POST',
			signal,
		} ),

	/**
	 * The payment page for a booking, opened from its link.
	 *
	 * @param {string}      token    The booking's payment token.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The payment payload.
	 */
	payment: ( token, signal ) =>
		request( `public/payment/${ token }`, { signal } ),

	/**
	 * Post a one-time code to an address the guest has just typed.
	 *
	 * @param {string}      email    Where to send it.
	 * @param {AbortSignal} [signal] Cancels the request.
	 * @return {Promise<Object>} { sent, expiresIn, resendIn }.
	 */
	requestCode: ( email, signal ) =>
		request( 'public/verify', {
			method: 'POST',
			body: { email },
			signal,
		} ),

	/**
	 * Hand the code back; the reply carries the token the booking needs.
	 *
	 * @param {string}      email    The address being proved.
	 * @param {string}      code     What the guest typed.
	 * @param {AbortSignal} [signal] Cancels the request.
	 * @return {Promise<Object>} { verified, token, expiresIn }.
	 */
	confirmCode: ( email, code, signal ) =>
		request( 'public/verify/confirm', {
			method: 'POST',
			body: { email, code },
			signal,
		} ),
};
