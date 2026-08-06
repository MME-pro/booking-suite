/**
 * Availability locks API.
 *
 * A lock stops NEW bookings for a window; it never cancels one already taken.
 * Booking availability already refuses a window overlapping a lock, so nothing
 * else has to be told about them.
 */

import { http } from './http';

const RESOURCE = 'blocks';

export const blockService = {
	/**
	 * @param {Object}      [params]
	 * @param {string}      [params.scope] 'apartment' (default) or 'extra'.
	 * @param {string}      [params.from]  'YYYY-MM-DD'.
	 * @param {string}      [params.to]    'YYYY-MM-DD'.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The locks, and everything they could cover.
	 */
	async list( params = {}, signal ) {
		const payload = await http.get( RESOURCE, params, { signal } );

		return {
			blocks: payload?.blocks ?? [],
			apartments: payload?.apartments ?? [],
			extras: payload?.extras ?? [],
		};
	},

	/**
	 * @param {Object}      values   apartmentIds or master, startsAt, endsAt, reason.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The new locks, and any bookings already inside them.
	 */
	async create( values, signal ) {
		const payload = await http.post( RESOURCE, values, { signal } );

		return {
			blocks: payload?.blocks ?? [],
			affected: payload?.affected ?? [],
		};
	},

	remove: ( id, signal ) =>
		http.delete( `${ RESOURCE }/${ id }`, { signal } ),
};

export default blockService;
