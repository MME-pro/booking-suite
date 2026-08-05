/**
 * Customers API.
 *
 * The REST layer already returns camelCase for guests, so there is no name
 * translation to do here.
 */

import { http } from './http';

const RESOURCE = 'customers';

export const customerService = {
	/**
	 * @param {Object}      [params]
	 * @param {string}      [params.search] Name, email, phone or city.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The guests and the headline figures.
	 */
	async list( params = {}, signal ) {
		const payload = await http.get( RESOURCE, params, { signal } );

		return {
			customers: payload?.customers ?? [],
			stats: payload?.stats ?? {},
		};
	},

	get: ( id, signal ) => http.get( `${ RESOURCE }/${ id }`, {}, { signal } ),

	/**
	 * One guest's stays, newest first.
	 *
	 * @param {number}      id
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Array>} The bookings.
	 */
	async bookings( id, signal ) {
		const payload = await http.get(
			`${ RESOURCE }/${ id }/bookings`,
			{},
			{ signal }
		);

		return payload?.bookings ?? [];
	},
};

export default customerService;
