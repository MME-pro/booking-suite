/**
 * Bootstrap data handed over by frontend/admin/Assets.php.
 *
 * Read through this module rather than touching the global directly, so the
 * shape stays in one place and defaults exist when the app runs outside WP.
 */

const defaults = {
	view: '',
	version: '',
	adminUrl: '',
	siteUrl: '',
	menuSlug: 'booking-suite',
	apartmentsUrl: '',
	restUrl: '',
	nonce: '',
	locale: 'en_US',
	/** The site's timezone; every booking time is this clock. */
	timezone: '',
	assetsUrl: '',
	workerUrl: '',
	adminPath: '/wp-admin/',
	/** Portal options for a calendar subscription; see Assets.php. */
	icalSources: [],
	/**
	 * What this user may do, as yes/no answers keyed by capability.
	 *
	 * Empty by default, and every read below treats a missing answer as no —
	 * so a screen loaded before this arrived draws nothing it should not have,
	 * rather than everything.
	 */
	can: {},
};

export const settings = {
	...defaults,
	...( typeof window !== 'undefined' ? window.bookingSuiteAdmin ?? {} : {} ),
};

/**
 * Whether this user may do something.
 *
 * Only decides what is worth drawing. Every route asks WordPress the same
 * question again, so this is never the thing standing between a user and an
 * action — it is what stops the screen offering one that will be refused.
 *
 * @param {string} capability Name from Capabilities::current_user_map().
 * @return {boolean} Whether to offer it.
 */
export const can = ( capability ) =>
	true === ( settings.can ?? {} )[ capability ];
