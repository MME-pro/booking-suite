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
	minHours: 4,
	maxHours: 8,

	// 0 means the owner declares no VAT, and the review screen says nothing.
	taxRate: 0,

	/*
	 * Whether the payment step offers to defer. False here on purpose: if the
	 * bootstrap is missing, the safe assumption is that every booking needs its
	 * receipt, not that any may skip one.
	 */
	allowPayLater: false,

	/*
	 * Which weekdays offer one fixed block, as ISO-8601 numbers — 1 Monday
	 * through 7 Sunday — and the block itself. Empty here on purpose: with no
	 * bootstrap the safe assumption is that no day is special, which leaves
	 * the picker behaving as it always did rather than locking a field for a
	 * rule this page never received.
	 */
	daytimeSlotDays: [],
	daytimeSlotStart: '',
	daytimeSlotEnd: '',

	// WordPress's own defaults for Settings → General — except the clock.
	dateFormat: 'F j, Y',
	/*
	 * 24-hour, not WordPress's 'g:i a'. Times run 00:00 to 23:30 throughout the
	 * booking flow, and a fallback that produced "11:30 pm" would put a second
	 * convention on the same screen as the slot buttons, which are always
	 * 24-hour because the server formats them that way.
	 */
	timeFormat: 'H:i',
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
