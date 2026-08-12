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

	/**
	 * The finished email as HTML, without sending it.
	 *
	 * The unsaved subject and body are posted, so the preview shows the edit in
	 * progress rather than what is currently stored.
	 *
	 * @param {string}      key      Template key.
	 * @param {Object}      values   subject and body as currently edited.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} `{ html }`, rendered by the sending code.
	 */
	preview: ( key, values, signal ) =>
		http.post( `${ RESOURCE }/${ key }/preview`, values, { signal } ),
};

export default emailTemplateService;
