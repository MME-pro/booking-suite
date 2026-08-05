/**
 * System status API.
 *
 * Everything it reports is measured server-side — tables looked up in the
 * database, mail state read from the templates — so the widget never claims
 * something is fine on the strength of a default.
 */

import { http } from './http';

const RESOURCE = 'system-status';

export const systemService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} Database, email and plugin state.
	 */
	async get( signal ) {
		const payload = await http.get( RESOURCE, {}, { signal } );

		return {
			database: payload?.database ?? {},
			email: payload?.email ?? {},
			plugin: payload?.plugin ?? {},
		};
	},
};

export default systemService;
