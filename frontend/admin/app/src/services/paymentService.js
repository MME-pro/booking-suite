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
	 * Move a payment along. The booking's own payment status follows on the
	 * server, so the bookings screen never disagrees with this one.
	 *
	 * @param {number}      id
	 * @param {string}      status   One of the statuses from list().
	 * @param {AbortSignal} [signal]
	 */
	setStatus: ( id, status, signal ) =>
		http.put( `${ RESOURCE }/${ id }`, { status }, { signal } ),
};

export default paymentService;
