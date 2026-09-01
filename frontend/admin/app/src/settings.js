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
	assetsUrl: '',
	workerUrl: '',
	adminPath: '/wp-admin/',
	/** Portal options for a calendar subscription; see Assets.php. */
	icalSources: [],
};

export const settings = {
	...defaults,
	...( typeof window !== 'undefined' ? window.bookingSuiteAdmin ?? {} : {} ),
};
