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

	/**
	 * Erase a booking, its extras and its payments.
	 *
	 * A hard delete with nothing behind it — the screen confirms first, because
	 * there is no undo and no archive to fish the booking back out of.
	 *
	 * @param {number}      id
	 * @param {AbortSignal} [signal]
	 */
	remove: ( id, signal ) =>
		http.delete( `${ RESOURCE }/${ id }`, { signal } ),

	/**
	 * Start times for a date, with the price of each.
	 *
	 * The admin's own endpoint, not the guest one: it offers times that have
	 * already passed, so a walk-in can be recorded after the fact.
	 *
	 * @param {Object}      params             apartmentId, date, hours, guests.
	 * @param {number}      [params.excludeId] Booking being edited, so its own
	 *                                         window does not read as taken.
	 * @param {AbortSignal} [signal]
	 */
	slots: ( params, signal ) =>
		http.get( `${ RESOURCE }/slots`, params, { signal } ),

	/**
	 * What a stay costs, itemised, before it is saved.
	 *
	 * @param {Object}      values   The stay as currently entered.
	 * @param {AbortSignal} [signal]
	 */
	quote: ( values, signal ) =>
		http.post( `${ RESOURCE }/quote`, values, { signal } ),
};

export default bookingService;
