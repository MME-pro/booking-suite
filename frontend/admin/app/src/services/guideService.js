/**
 * Developer guide API.
 *
 * The endpoint list is introspected server-side from the routes that are
 * actually registered, so nothing here needs maintaining as the API grows.
 */

import { http } from './http';

const RESOURCE = 'guide';

export const guideService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} Shortcodes, endpoints and the REST base URL.
	 */
	async get( signal ) {
		const payload = await http.get( RESOURCE, {}, { signal } );

		return {
			shortcodes: payload?.shortcodes ?? [],
			endpoints: payload?.endpoints ?? [],
			restBase: payload?.restBase ?? '',
		};
	},
};

export default guideService;
