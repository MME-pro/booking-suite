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
