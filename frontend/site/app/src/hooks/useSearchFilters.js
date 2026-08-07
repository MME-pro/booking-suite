/**
 * The search filters, and the rules that keep them in agreement.
 *
 * Three values: the date of the visit, how many hours it runs, and who is
 * coming. There is no check-out field — an hourly booking has one date, and a
 * second date control would be a field that can contradict the first.
 *
 * The hour bounds are the owner's own settings, delivered with the page (see
 * Assets::register_app). They are read here rather than hardcoded so that
 * changing "shortest booking" in the admin changes this control too.
 *
 * Guests are held as adults/children/infants because that is how a party is
 * described, but the API takes one occupancy number — see `occupancy` below.
 */

import { useCallback, useMemo, useState } from 'react';

import { settings } from '../services/apartmentService';
import { fromKey, startOfToday, toKey } from '../utils/date';

/** Bounds for each counter. Infants are not counted against occupancy. */
export const GUEST_LIMITS = {
	adults: { min: 1, max: 16 },
	children: { min: 0, max: 10 },
	infants: { min: 0, max: 5 },
};

const clamp = ( value, { min, max } ) =>
	Math.min( max, Math.max( min, value ) );

/**
 * The bookable lengths, from the owner's settings.
 *
 * Guarded rather than trusted: the settings are free-text in the admin, and a
 * maximum below the minimum would otherwise produce an empty menu with no way
 * to tell why.
 *
 * @return {{min: number, max: number}} Whole hours.
 */
export const hourBounds = () => {
	const min = Math.max( 1, Math.round( Number( settings.minHours ) || 3 ) );
	const max = Math.max( min, Math.round( Number( settings.maxHours ) || 8 ) );

	return { min, max };
};

/**
 * @param {Object} [initial]
 * @param {number} [initial.guests] Party size to start from, e.g. from the
 *                                  shortcode's `guests` attribute.
 * @return {Object} The filter state, its derived values, and its setters.
 */
export function useSearchFilters( { guests = 0 } = {} ) {
	const bounds = useMemo( hourBounds, [] );

	const [ filters, setFilters ] = useState( () => ( {
		date: '',

		// Opens at the shortest bookable length — the commonest choice, and the
		// one that shows the lowest price.
		hours: bounds.min,
		guests: {
			adults: guests > 0 ? clamp( guests, GUEST_LIMITS.adults ) : 1,
			children: 0,
			infants: 0,
		},
	} ) );

	/**
	 * What the API means by "guests": how many people occupy the apartment.
	 *
	 * Infants are excluded, which is the convention across the industry — they
	 * do not take a bed and are not counted against occupancy. If this property
	 * should count them, this one expression is the only thing to change.
	 */
	const occupancy = filters.guests.adults + filters.guests.children;

	const setDate = useCallback( ( date ) => {
		setFilters( ( previous ) => ( {
			...previous,
			// '' is a legitimate value: it clears the date without disturbing
			// the length or the party.
			date: '' === date || fromKey( date ) ? date : previous.date,
		} ) );
	}, [] );

	const setHours = useCallback(
		( hours ) => {
			setFilters( ( previous ) => ( {
				...previous,
				hours: Math.min( bounds.max, Math.max( bounds.min, hours ) ),
			} ) );
		},
		[ bounds ]
	);

	const setGuest = useCallback( ( kind, value ) => {
		setFilters( ( previous ) => ( {
			...previous,
			guests: {
				...previous.guests,
				[ kind ]: clamp( value, GUEST_LIMITS[ kind ] ),
			},
		} ) );
	}, [] );

	const clearDate = useCallback(
		() => setFilters( ( previous ) => ( { ...previous, date: '' } ) ),
		[]
	);

	const resetGuests = useCallback(
		() =>
			setFilters( ( previous ) => ( {
				...previous,
				guests: { adults: 1, children: 0, infants: 0 },
			} ) ),
		[]
	);

	return {
		filters,
		bounds,
		occupancy,
		minDate: toKey( startOfToday() ),
		setDate,
		setHours,
		setGuest,
		clearDate,
		resetGuests,
	};
}
