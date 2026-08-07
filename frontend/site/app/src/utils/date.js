/**
 * Calendar date helpers.
 *
 * Everything here works on LOCAL dates, never UTC. A stay is a pair of calendar
 * days as the guest understands them; converting through UTC shifts the day
 * either side of midnight for most of the world, and a date that is one day out
 * is a different booking.
 *
 * Dates travel as 'yyyy-mm-dd' strings — the format the REST API and the date
 * input both speak — and become Date objects only for arithmetic.
 */

/**
 * @param {Date} date A date.
 * @return {string} Its 'yyyy-mm-dd' key, in local time.
 */
export const toKey = ( date ) => {
	const pad = ( value ) => String( value ).padStart( 2, '0' );

	return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad(
		date.getDate()
	) }`;
};

/**
 * @param {string} key A 'yyyy-mm-dd' date.
 * @return {Date|null} The local date, or null when it will not parse.
 */
export const fromKey = ( key ) => {
	const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec( String( key ?? '' ) );

	if ( ! parts ) {
		return null;
	}

	const date = new Date(
		Number( parts[ 1 ] ),
		Number( parts[ 2 ] ) - 1,
		Number( parts[ 3 ] )
	);

	// Rejects the 31st of a 30-day month, which Date would roll forward.
	return toKey( date ) === key ? date : null;
};

/** Midnight today, local. */
export const startOfToday = () => {
	const now = new Date();

	return new Date( now.getFullYear(), now.getMonth(), now.getDate() );
};

/**
 * @param {Date}   date A date.
 * @param {number} days Days to add; may be negative.
 * @return {Date} The shifted date.
 */
export const addDays = ( date, days ) =>
	new Date( date.getFullYear(), date.getMonth(), date.getDate() + days );

/**
 * @param {Date}   date   A date.
 * @param {number} months Months to add; may be negative.
 * @return {Date} The first of the shifted month.
 */
export const addMonths = ( date, months ) =>
	new Date( date.getFullYear(), date.getMonth() + months, 1 );

export const startOfMonth = ( date ) =>
	new Date( date.getFullYear(), date.getMonth(), 1 );

export const isSameDay = ( a, b ) =>
	Boolean( a && b ) && toKey( a ) === toKey( b );

/**
 * Whole days from `a` to `b`.
 *
 * Counted from the date parts rather than by dividing milliseconds: across a
 * daylight-saving boundary a "day" is 23 or 25 hours, and dividing gives 2.96
 * nights where the guest counted three.
 *
 * @param {Date} a The earlier date.
 * @param {Date} b The later date.
 * @return {number} Days between them; negative when b precedes a.
 */
export const diffDays = ( a, b ) => {
	const utcA = Date.UTC( a.getFullYear(), a.getMonth(), a.getDate() );
	const utcB = Date.UTC( b.getFullYear(), b.getMonth(), b.getDate() );

	return Math.round( ( utcB - utcA ) / 86400000 );
};

/**
 * WordPress locales are de_DE; Intl wants de-DE.
 *
 * @param {string} locale A WordPress or BCP-47 locale.
 * @return {string} The BCP-47 form.
 */
export const toBcp47 = ( locale ) =>
	String( locale || 'de_DE' ).replace( '_', '-' );

/**
 * Which weekday the locale's week starts on, 0 = Sunday.
 *
 * German weeks open on Monday, American ones on Sunday, and getting this wrong
 * shifts every date in the grid by a column. `weekInfo` is the correct source
 * but is not in every browser yet, so Sunday-first locales are listed for the
 * fallback — they are the minority and enumerable.
 *
 * @param {string} locale A WordPress or BCP-47 locale.
 * @return {number} 0-6.
 */
export const weekStartsOn = ( locale ) => {
	const tag = toBcp47( locale );

	try {
		const info = new Intl.Locale( tag ).weekInfo;

		if ( info?.firstDay ) {
			// weekInfo counts Monday as 1 through Sunday as 7.
			return info.firstDay % 7;
		}
	} catch ( error ) {
		// Fall through to the region list.
	}

	const region = tag.split( '-' )[ 1 ]?.toUpperCase() ?? '';

	return [ 'US', 'CA', 'JP', 'IL', 'MX', 'PH', 'BR', 'KR' ].includes( region )
		? 0
		: 1;
};

/**
 * The weeks of a month, padded to whole weeks with its neighbours' days.
 *
 * @param {Date}   month   Any date within the month.
 * @param {number} weekday The weekday the week starts on, 0 = Sunday.
 * @return {Date[][]} Rows of seven dates.
 */
export const monthMatrix = ( month, weekday ) => {
	const first = startOfMonth( month );

	// How far back to reach for the first day of that week.
	const lead = ( first.getDay() - weekday + 7 ) % 7;

	const start = addDays( first, -lead );
	const weeks = [];

	for ( let week = 0; week < 6; week++ ) {
		const days = [];

		for ( let day = 0; day < 7; day++ ) {
			days.push( addDays( start, week * 7 + day ) );
		}

		// A month never needs a sixth row that holds none of its own days.
		if ( week === 5 && days[ 0 ].getMonth() !== first.getMonth() ) {
			break;
		}

		weeks.push( days );
	}

	return weeks;
};

/**
 * The weekday abbreviations, in the locale's own order.
 *
 * @param {string} locale  A WordPress or BCP-47 locale.
 * @param {number} weekday The weekday the week starts on.
 * @return {Array<{short: string, long: string}>} Seven labels.
 */
export const weekdayNames = ( locale, weekday ) => {
	const tag = toBcp47( locale );
	const short = new Intl.DateTimeFormat( tag, { weekday: 'short' } );
	const long = new Intl.DateTimeFormat( tag, { weekday: 'long' } );

	// 2024-01-07 was a Sunday, which makes it a convenient index origin.
	const sunday = new Date( 2024, 0, 7 );

	return Array.from( { length: 7 }, ( _, index ) => {
		const date = addDays( sunday, ( weekday + index ) % 7 );

		return { short: short.format( date ), long: long.format( date ) };
	} );
};

/**
 * @param {Date}   date      A date.
 * @param {string} locale    A WordPress or BCP-47 locale.
 * @param {Object} [options] Intl options; defaults to "Fri, 14 Aug".
 * @return {string} The formatted date.
 */
export const formatDate = ( date, locale, options ) =>
	new Intl.DateTimeFormat( toBcp47( locale ), {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...options,
	} ).format( date );

/**
 * Format a date the way PHP's date() would, for a WordPress format string.
 *
 * Settings → General stores formats as PHP tokens — 'j. F Y', 'd/m/Y', 'g:i a'
 * — and Intl has no notion of them. Rather than approximate the owner's choice
 * with the nearest Intl preset, the tokens are honoured directly, so a date on
 * the booking flow reads exactly as one written anywhere else on the site.
 *
 * Month and weekday names still come from Intl, so they arrive translated:
 * 'F' is "September" on an English site and "September" on a German one, but
 * 'M' is "Sep" and "Sept" respectively.
 *
 * Supports the tokens WordPress offers in its own settings UI, plus the common
 * remainder. A backslash escapes the next character, as in PHP.
 *
 * @param {Date}   date   The date to format.
 * @param {string} format A PHP date() format string.
 * @param {string} locale A WordPress or BCP-47 locale.
 * @return {string} The formatted date.
 */
export const wpFormat = ( date, format, locale ) => {
	if ( ! ( date instanceof Date ) || Number.isNaN( date.getTime() ) ) {
		return '';
	}

	const tag = toBcp47( locale );
	const pad = ( value ) => String( value ).padStart( 2, '0' );
	const name = ( options ) =>
		new Intl.DateTimeFormat( tag, options ).format( date );

	const hours = date.getHours();

	// 12-hour clock: midnight and noon are both 12, not 0.
	const twelve = hours % 12 || 12;

	const tokens = {
		d: () => pad( date.getDate() ),
		j: () => String( date.getDate() ),
		D: () => name( { weekday: 'short' } ),
		l: () => name( { weekday: 'long' } ),
		N: () => String( date.getDay() || 7 ),
		w: () => String( date.getDay() ),
		m: () => pad( date.getMonth() + 1 ),
		n: () => String( date.getMonth() + 1 ),
		M: () => name( { month: 'short' } ),
		F: () => name( { month: 'long' } ),
		Y: () => String( date.getFullYear() ),
		y: () => pad( date.getFullYear() % 100 ),
		a: () => ( hours < 12 ? 'am' : 'pm' ),
		A: () => ( hours < 12 ? 'AM' : 'PM' ),
		g: () => String( twelve ),
		h: () => pad( twelve ),
		G: () => String( hours ),
		H: () => pad( hours ),
		i: () => pad( date.getMinutes() ),
		s: () => pad( date.getSeconds() ),

		// English ordinal suffix; PHP emits it regardless of locale.
		S: () => {
			const day = date.getDate();

			if ( day > 3 && day < 21 ) {
				return 'th';
			}

			return { 1: 'st', 2: 'nd', 3: 'rd' }[ day % 10 ] ?? 'th';
		},
	};

	let out = '';

	for ( let index = 0; index < format.length; index++ ) {
		const char = format[ index ];

		if ( '\\' === char ) {
			// Escaped: the next character is literal text.
			index++;
			out += format[ index ] ?? '';
			continue;
		}

		out += tokens[ char ] ? tokens[ char ]() : char;
	}

	return out;
};
