/**
 * Email templates API.
 */

import { http } from './http';

const RESOURCE = 'email-templates';

export const emailTemplateService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The templates and the placeholders they accept.
	 */
	async list( signal ) {
		const payload = await http.get( RESOURCE, {}, { signal } );

		return {
			templates: payload?.templates ?? [],
			placeholders: payload?.placeholders ?? {},
		};
	},

	/**
	 * @param {string}      key      Template key.
	 * @param {Object}      values   subject, body and/or enabled.
	 * @param {AbortSignal} [signal]
	 */
	save: ( key, values, signal ) =>
		http.put( `${ RESOURCE }/${ key }`, values, { signal } ),

	/**
	 * Drops the stored copy so the shipped default applies again.
	 *
	 * @param {string}      key      Template key.
	 * @param {AbortSignal} [signal]
	 */
	reset: ( key, signal ) =>
		http.post( `${ RESOURCE }/${ key }/reset`, {}, { signal } ),

	/**
	 * Sends the template to one address, filled from the latest booking.
	 *
	 * @param {string}      key      Template key.
	 * @param {string}      email    Where to send the test.
	 * @param {AbortSignal} [signal]
	 */
	test: ( key, email, signal ) =>
		http.post( `${ RESOURCE }/${ key }/test`, { email }, { signal } ),
};

export default emailTemplateService;
