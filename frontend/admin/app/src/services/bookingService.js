/**
 * Bookings API.
 *
 * The REST layer already returns camelCase for bookings, so unlike apartments
 * there is no name translation to do here.
 */

import { http } from './http';

const RESOURCE = 'bookings';

export const bookingService = {
	/**
	 * @param {Object}      [params]
	 * @param {string}      [params.search] Reference, apartment, guest or email.
	 * @param {string}      [params.status] Restrict to one booking status.
	 * @param {AbortSignal} [signal]
	 */
	async list( params = {}, signal ) {
		const payload = await http.get( RESOURCE, params, { signal } );

		return {
			bookings: payload?.bookings ?? [],
			counts: payload?.counts ?? {},
			statuses: payload?.statuses ?? [],
			payments: payload?.payments ?? [],
		};
	},

	get: ( id, signal ) => http.get( `${ RESOURCE }/${ id }`, {}, { signal } ),

	// Take a booking on the guest's behalf.
	create: ( values, signal ) =>
		http.post( `${ RESOURCE }/create`, values, { signal } ),

	/**
	 * Move a booking along.
	 *
	 * @param {number}      id
	 * @param {Object}      changes  status and/or payment_status
	 * @param {AbortSignal} [signal]
	 */
	update: ( id, changes, signal ) =>
		http.put( `${ RESOURCE }/${ id }`, changes, { signal } ),
};

export default bookingService;
