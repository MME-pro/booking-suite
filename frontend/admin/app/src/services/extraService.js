/**
 * Extras API.
 *
 * The REST layer speaks snake_case, matching the columns of `mmebk_extras`;
 * the components speak camelCase. Both translations live here.
 *
 * `stock` is null when the extra is unlimited — the admin form models that as a
 * "manage stock" switch, and the null survives the round trip untouched.
 */

import { http } from './http';

const RESOURCE = 'extras';

// REST row → component shape.
export const toExtra = ( row ) => ( {
	id: row.id,
	name: row.name ?? '',
	description: row.description ?? '',
	price: String( row.price ?? 0 ),
	stock: null === row.stock || undefined === row.stock ? null : row.stock,
	imageUrl: row.image_url ?? '',
	sortOrder: row.sort_order ?? 0,
	roomIds: row.room_ids ?? [],
	active: Boolean( row.active ),
} );

/*
 * Component shape → REST payload. Only keys actually present are sent, so a
 * partial update stays partial.
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

	if ( has( 'price' ) ) {
		// A comma decimal mark is what a German keyboard produces.
		payload.price = Math.max(
			0,
			Number.parseFloat( String( values.price ).replace( ',', '.' ) ) || 0
		);
	}

	// null is meaningful: it is what "unlimited" is stored as.
	if ( has( 'stock' ) ) {
		payload.stock =
			null === values.stock
				? null
				: Number.parseInt( values.stock, 10 ) || 0;
	}

	if ( has( 'imageUrl' ) ) {
		payload.image_url = values.imageUrl;
	}

	if ( has( 'sortOrder' ) ) {
		payload.sort_order = Number.parseInt( values.sortOrder, 10 ) || 0;
	}

	if ( has( 'roomIds' ) ) {
		payload.room_ids = values.roomIds;
	}

	if ( has( 'active' ) ) {
		payload.active = Boolean( values.active );
	}

	return payload;
};

export const extraService = {
	/**
	 * @param {AbortSignal} [signal]
	 * @return {Promise<Object>} The extras and how many of each are booked.
	 */
	async list( signal ) {
		const payload = await http.get( RESOURCE, {}, { signal } );

		return {
			extras: ( payload?.extras ?? [] ).map( toExtra ),
			booked: payload?.booked ?? {},
		};
	},

	async create( values, signal ) {
		return toExtra(
			await http.post( RESOURCE, toPayload( values ), { signal } )
		);
	},

	async update( id, values, signal ) {
		return toExtra(
			await http.put( `${ RESOURCE }/${ id }`, toPayload( values ), {
				signal,
			} )
		);
	},

	async remove( id, signal ) {
		return http.delete( `${ RESOURCE }/${ id }`, { signal } );
	},
};

export default extraService;
