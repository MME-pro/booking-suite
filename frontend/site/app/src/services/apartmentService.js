/**
 * Guest-facing apartment API.
 *
 * Reads the public endpoint, which needs no authentication. The nonce is sent
 * when present so logged-in visitors get a fresh (uncached) response.
 */

const settings = {
	restUrl: '',
	nonce: '',
	locale: 'de_DE',

	// Mirrors the plugin's own defaults, so the bundle still behaves if the
	// bootstrap object is missing — a caching plugin stripping inline script,
	// for instance.
	minHours: 3,
	maxHours: 8,

	// WordPress's own defaults for Settings → General.
	dateFormat: 'F j, Y',
	timeFormat: 'g:i a',
	timezone: 'UTC',
	startOfWeek: 1,
	...( typeof window !== 'undefined' ? window.bookingSuiteSite ?? {} : {} ),
};

export { settings };

export async function fetchApartments( { guests = 0 } = {}, signal ) {
	const base = settings.restUrl.replace( /\/$/, '' );
	const url = new URL( `${ base }/public/apartments` );

	if ( guests > 0 ) {
		url.searchParams.set( 'guests', String( guests ) );
	}

	const headers = { Accept: 'application/json' };

	if ( settings.nonce ) {
		headers[ 'X-WP-Nonce' ] = settings.nonce;
	}

	const response = await fetch( url.toString(), {
		headers,
		credentials: 'same-origin',
		signal,
	} );

	if ( ! response.ok ) {
		throw new Error( 'request_failed' );
	}

	return response.json();
}
