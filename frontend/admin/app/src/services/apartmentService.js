/**
 * Apartment API.
 *
 * The REST layer speaks snake_case, matching the columns of `mmebk_rooms`;
 * the components speak camelCase. Both translations live here so neither side
 * has to know about the other's naming.
 */

import { http } from './http';

const RESOURCE = 'apartments';

// REST row → component shape.
export const toApartment = ( row ) => ( {
	id: row.id,
	name: row.name,
	description: row.description,
	// images_data carries the resolved thumbnails; images is just the ids.
	images: row.images_data ?? ( row.images ?? [] ).map( ( id ) => ( { id } ) ),
	capacity: row.capacity,
	colour: row.colour,
	internalShortLink: row.internal_short_link ?? '',
	bookingShortLink: row.booking_short_link ?? '',
	holidayHesse: Boolean( row.holiday_hesse ),
	cleaningMin: row.cleaning_min,
	weekdayRate: String( row.weekday_rate ?? 0 ),
	weekendRate: String( row.weekend_rate ?? 0 ),
	active: Boolean( row.active ),
	/*
	 * None of this is a column on the apartment. The subscriptions are the
	 * calendars it reads other portals' sold dates from; the export link is
	 * the address portals read this apartment's own booked dates at, and is
	 * empty until the operator publishes it. All of it rides along on the row
	 * so the form can show it without a second request. The REST layer already
	 * casts a subscription to camelCase, so the list passes straight through.
	 */
	icalFeeds: row.ical_feeds ?? [],
	icalExportUrl: row.ical_export_url ?? '',
	// One entry per scope: the whole feed, direct-only, and one per portal.
	icalExports: row.ical_exports ?? [],
	icalFallbackUrl: row.ical_fallback_url ?? '',
	createdAt: row.created_at,
	updatedAt: row.updated_at,
} );

/*
 * Component shape → REST payload.
 *
 * Only keys actually present are sent, so a partial update stays partial.
 * Numeric fields arrive from inputs as strings and are coerced here.
 */
export const toPayload = ( values ) => {
	const payload = {};
	const has = ( key ) => undefined !== values[ key ];

	if ( has( 'name' ) ) {
		payload.name = values.name;
	}

	if ( has( 'description' ) ) {
		payload.description = values.description;
	}

	if ( has( 'images' ) ) {
		// The column stores attachment ids; the preview URLs stay client-side.
		payload.images = values.images
			.map( ( image ) =>
				'object' === typeof image ? image.id : image
			)
			.filter( ( id ) => Number.isInteger( id ) && id > 0 );
	}

	if ( has( 'capacity' ) ) {
		payload.capacity = Number.parseInt( values.capacity, 10 ) || 1;
	}

	if ( has( 'colour' ) ) {
		payload.colour = values.colour;
	}

	if ( has( 'internalShortLink' ) ) {
		payload.internal_short_link = values.internalShortLink;
	}

	if ( has( 'bookingShortLink' ) ) {
		payload.booking_short_link = values.bookingShortLink;
	}

	if ( has( 'holidayHesse' ) ) {
		payload.holiday_hesse = Boolean( values.holidayHesse );
	}

	if ( has( 'cleaningMin' ) ) {
		payload.cleaning_min = Number.parseInt( values.cleaningMin, 10 );
	}

	// A comma decimal mark is what a German keyboard produces.
	const toRate = ( value ) =>
		Math.max(
			0,
			Number.parseFloat( String( value ).replace( ',', '.' ) ) || 0
		);

	if ( has( 'weekdayRate' ) ) {
		payload.weekday_rate = toRate( values.weekdayRate );
	}

	if ( has( 'weekendRate' ) ) {
		payload.weekend_rate = toRate( values.weekendRate );
	}

	if ( has( 'active' ) ) {
		payload.active = Boolean( values.active );
	}

	/*
	 * Sent only when the form actually carries the list, because an empty list
	 * is a real instruction here — it unsubscribes everything — and a screen
	 * that knows nothing about calendars must not issue it by omission.
	 *
	 * Only the five writable fields go back. The last-sync columns the form
	 * carries for display are the server's own record of what happened, and
	 * posting them would invite it to trust the browser about its own history.
	 */
	if ( has( 'icalFeeds' ) ) {
		payload.ical_feeds = values.icalFeeds.map( ( feed ) => ( {
			id: Number( feed.id ) || 0,
			name: String( feed.name ?? '' ).trim(),
			url: String( feed.url ?? '' ).trim(),
			source: feed.source,
			active: Boolean( feed.active ),
		} ) );
	}

	return payload;
};

export const apartmentService = {
	/**
	 * @param {Object}      [params]
	 * @param {string}      [params.search] Filter by name.
	 * @param {boolean}     [params.active] Restrict to active or inactive.
	 * @param {AbortSignal} [signal]
	 */
	async list( params = {}, signal ) {
		const rows = await http.get( RESOURCE, params, { signal } );

		return ( rows ?? [] ).map( toApartment );
	},

	async get( id, signal ) {
		return toApartment(
			await http.get( `${ RESOURCE }/${ id }`, {}, { signal } )
		);
	},

	async create( values, signal ) {
		return toApartment(
			await http.post( RESOURCE, toPayload( values ), { signal } )
		);
	},

	async update( id, values, signal ) {
		return toApartment(
			await http.put( `${ RESOURCE }/${ id }`, toPayload( values ), {
				signal,
			} )
		);
	},

	async remove( id, signal ) {
		return http.delete( `${ RESOURCE }/${ id }`, { signal } );
	},
};

export default apartmentService;
