/**
 * Settings API.
 *
 * The endpoint returns the stored values together with the choices behind
 * them, so the screen never keeps its own copy of the allowed options.
 */

import { http } from './http';

const RESOURCE = 'settings';

const unwrap = ( payload ) => ( {
	settings: payload?.settings ?? {},
	choices: {
		currencies: payload?.choices?.currencies ?? [],
		accents: payload?.choices?.accents ?? [],
	},
	palette: payload?.palette ?? {},
	logo: payload?.logo ?? null,
} );

export const settingsService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The settings and the choices behind them.
	 */
	async get( signal ) {
		return unwrap( await http.get( RESOURCE, {}, { signal } ) );
	},

	/**
	 * @param {Object}      values   Only the keys being changed.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The settings as stored.
	 */
	async update( values, signal ) {
		return unwrap( await http.put( RESOURCE, values, { signal } ) );
	},

	/**
	 * Send the daily summary now, for the day it would cover.
	 *
	 * Deliberately separate from update(): sending is not saving, and an
	 * owner pressing Save should never post mail as a side effect.
	 *
	 * @param {string}      [date]   Y-m-d. Defaults to the day the schedule
	 *                               would report on.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} How many recipients it went to, and the
	 *                           figures it carried.
	 */
	async sendDailySummary( date, signal ) {
		return http.post(
			RESOURCE + '/daily-summary',
			date ? { date } : {},
			{ signal }
		);
	},
};

export default settingsService;
