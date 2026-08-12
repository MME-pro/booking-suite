/**
 * Public holidays.
 *
 * Read from the server rather than worked out here: the same calculation
 * decides which days are charged at the weekend rate, and a second
 * implementation in the browser would eventually disagree with the prices.
 */

import { http } from './http';

const RESOURCE = 'holidays';

export const holidayService = {
	/**
	 * Every holiday between two dates, inclusive.
	 *
	 * @param {string}      from     Y-m-d.
	 * @param {string}      to       Y-m-d.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} Date => holiday name.
	 */
	async range( from, to, signal ) {
		const payload = await http.get( RESOURCE, { from, to }, { signal } );

		return payload?.holidays ?? {};
	},
};

export default holidayService;
