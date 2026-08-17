/**
 * Calendar import and synchronisation API.
 *
 * The .ics file is read in the browser and posted as text — see the note in
 * IcalController for why it does not go through the media library.
 *
 * `preview` and `apply` call the same endpoint; the only difference is the
 * dry-run flag, so what the screen shows before importing is produced by the
 * code that does the importing.
 */

import { __ } from '@wordpress/i18n';

import { http } from './http';

const RESOURCE = 'ical';

/** Anything larger is not a listing export. Matches the REST guard. */
const MAX_BYTES = 2097152;

const emptyReport = () => ( {
	events: [],
	orphans: [],
	conflicts: [],
	counts: {
		total: 0,
		added: 0,
		updated: 0,
		unchanged: 0,
		skipped: 0,
		removed: 0,
		orphans: 0,
	},
} );

export const icalService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} Subscriptions, apartments and the schedule.
	 */
	async list( signal ) {
		const payload = await http.get( RESOURCE, {}, { signal } );

		return {
			feeds: payload?.feeds ?? [],
			apartments: payload?.apartments ?? [],
			sources: payload?.sources ?? [],
			schedule: payload?.schedule ?? { nextRun: '' },
		};
	},

	/**
	 * Read a File the operator picked into the text the API expects.
	 *
	 * @param {File} file
	 * @return {Promise<string>} The file's contents.
	 */
	readFile( file ) {
		if ( file.size > MAX_BYTES ) {
			return Promise.reject(
				new Error(
					__(
						'That file is too large to be a calendar export.',
						'booking-suite'
					)
				)
			);
		}

		return new Promise( ( resolve, reject ) => {
			// Reached through `window` to match how this app takes its other
			// browser globals, and because the lint config does not carry it.
			const reader = new window.FileReader();

			reader.onload = () => resolve( String( reader.result ?? '' ) );
			reader.onerror = () =>
				reject(
					new Error(
						__( 'That file could not be read.', 'booking-suite' )
					)
				);

			reader.readAsText( file );
		} );
	},

	/**
	 * @param {Object}      values   apartmentId, content, removeMissing, skipPast.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} What the import would do. Nothing is written.
	 */
	async preview( values, signal ) {
		const payload = await http.post(
			`${ RESOURCE }/import`,
			{ ...values, dryRun: true },
			{ signal }
		);

		return payload?.report ?? emptyReport();
	},

	/**
	 * @param {Object}      values   The same values the preview was taken with.
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} What the import did.
	 */
	async apply( values, signal ) {
		const payload = await http.post(
			`${ RESOURCE }/import`,
			{ ...values, dryRun: false },
			{ signal }
		);

		return payload?.report ?? emptyReport();
	},

	async createFeed( values, signal ) {
		const payload = await http.post( `${ RESOURCE }/feeds`, values, {
			signal,
		} );

		return payload?.feed ?? null;
	},

	async updateFeed( id, values, signal ) {
		const payload = await http.put( `${ RESOURCE }/feeds/${ id }`, values, {
			signal,
		} );

		return payload?.feed ?? null;
	},

	removeFeed: ( id, removeBlocks = false ) =>
		http.delete(
			`${ RESOURCE }/feeds/${ id }?removeBlocks=${
				removeBlocks ? 'true' : 'false'
			}`
		),

	async syncFeed( id, signal ) {
		const payload = await http.post(
			`${ RESOURCE }/feeds/${ id }/sync`,
			{},
			{ signal }
		);

		return {
			report: payload?.report ?? emptyReport(),
			feed: payload?.feed ?? null,
		};
	},

	async syncAll( signal ) {
		const payload = await http.post( `${ RESOURCE }/sync`, {}, { signal } );

		return {
			results: payload?.results ?? [],
			feeds: payload?.feeds ?? [],
		};
	},
};

export default icalService;
