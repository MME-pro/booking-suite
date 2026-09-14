/**
 * Payments API.
 *
 * The REST layer already returns camelCase for payments, so unlike apartments
 * there is no name translation to do here.
 */

import { http } from './http';

const RESOURCE = 'payments';

export const paymentService = {
	/**
	 * @param {Object}      [params]
	 * @param {string}      [params.status] Restrict to one payment status.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} Payments, stats and the allowed vocabularies.
	 */
	async list( params = {}, signal ) {
		const payload = await http.get( RESOURCE, params, { signal } );

		return {
			payments: payload?.payments ?? [],
			stats: payload?.stats ?? {},
			statuses: payload?.statuses ?? [],
			methods: payload?.methods ?? [],
		};
	},

	get: ( id, signal ) => http.get( `${ RESOURCE }/${ id }`, {}, { signal } ),

	/**
	 * Write down money that has arrived against a booking.
	 *
	 * The booking's own payment status is re-derived on the server from every
	 * payment against it, so recording part of what is owed leaves the booking
	 * reading "partial" without this having to say so.
	 *
	 * @param {Object}      values
	 * @param {number}      values.bookingId
	 * @param {number}      values.amount    Negative for a refund.
	 * @param {string}      [values.method]  transfer | cash | card
	 * @param {string}      [values.paidAt]  YYYY-MM-DD, site time.
	 * @param {string}      [values.notes]
	 * @param {AbortSignal} [signal]
	 */
	record: ( values, signal ) => http.post( RESOURCE, values, { signal } ),

	/**
	 * Move a payment along. The booking's own payment status follows on the
	 * server, so the bookings screen never disagrees with this one.
	 *
	 * @param {number}      id
	 * @param {string}      status   One of the statuses from list().
	 * @param {AbortSignal} [signal]
	 */
	setStatus: ( id, status, signal ) =>
		http.put( `${ RESOURCE }/${ id }`, { status }, { signal } ),

	/**
	 * Remove a payment.
	 *
	 * The booking's own payment status is re-derived on the server, so a
	 * booking never stays marked paid for money no longer recorded.
	 *
	 * @param {number}      id
	 * @param {AbortSignal} [signal]
	 */
	async remove( id, signal ) {
		return http.delete( `${ RESOURCE }/${ id }`, { signal } );
	},
};

export default paymentService;
