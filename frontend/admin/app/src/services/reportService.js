/**
 * Reports API.
 *
 * Every figure is aggregated server-side, so the screen and a printed copy of
 * it can never disagree about what a number means.
 */

import { http } from './http';

const RESOURCE = 'reports';

export const reportService = {
	/**
	 * @param {Object}      params
	 * @param {string}      params.from        'YYYY-MM-DD'.
	 * @param {string}      params.to          'YYYY-MM-DD'.
	 * @param {string}      params.granularity day | week | month.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The whole report.
	 */
	async get( params, signal ) {
		const payload = await http.get( RESOURCE, params, { signal } );

		return {
			range: payload?.range ?? {},
			currency: payload?.currency ?? 'EUR',
			totals: payload?.totals ?? {},
			trend: payload?.trend ?? [],
			rooms: payload?.rooms ?? [],
			statuses: payload?.statuses ?? [],
			peakHours: payload?.peakHours ?? [],
			customers: payload?.customers ?? {},
		};
	},
};

export default reportService;
