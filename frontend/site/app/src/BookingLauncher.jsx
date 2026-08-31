/**
 * Listens for "Book now" clicks anywhere on the page and opens the modal.
 *
 * A delegated listener rather than one per button, so buttons rendered later —
 * by an Elementor popup, a lazy-loaded loop, an AJAX filter — work without
 * being re-bound.
 *
 * A button may also describe the stay the guest has already chosen, which is
 * how the showcase search bar reaches the modal: the shortcode writes the
 * search onto every button as data attributes, and the modal opens on those
 * dates rather than on today.
 */

import { useEffect, useState } from 'react';

import { BookingModal } from './components/BookingModal';

const TRIGGER = '[data-booking-suite-book]';

/**
 * yyyy-mm-dd, `nights` later.
 *
 * Built from the date's own parts rather than by adding milliseconds: the
 * latter lands an hour out across a daylight-saving boundary, and an hour out
 * on a date is a different day.
 *
 * @param {string} date   A yyyy-mm-dd date.
 * @param {number} nights Nights to add.
 * @return {string} The resulting date, or '' when the input will not parse.
 */
const addNights = ( date, nights ) => {
	const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec( date );

	if ( ! parts ) {
		return '';
	}

	const result = new Date(
		Number( parts[ 1 ] ),
		Number( parts[ 2 ] ) - 1,
		Number( parts[ 3 ] ) + nights
	);

	const pad = ( value ) => String( value ).padStart( 2, '0' );

	return `${ result.getFullYear() }-${ pad( result.getMonth() + 1 ) }-${ pad(
		result.getDate()
	) }`;
};

/**
 * The stay a trigger describes, or null when it describes none.
 *
 * Two shapes are understood, because two surfaces produce them:
 *
 *   data-bks-hours   an hourly visit — one date and a length in hours, which
 *                    is what the React filter bar asks for
 *   data-bks-nights  an overnight stay — one date and a length in nights
 *
 * Hours win if both are somehow present: a length in hours is the more specific
 * statement, and mode has to resolve to exactly one thing.
 *
 * @param {DOMStringMap} dataset The trigger's data attributes.
 * @return {Object|null} A partial stay for the modal.
 */
const stayFrom = ( dataset ) => {
	const guests = Number.parseInt( dataset.bksGuests, 10 );
	const date = dataset.bksDate || '';

	// Guests alone is worth carrying: a party size with no date still saves the
	// guest re-entering it.
	if ( ! date ) {
		return guests > 0 ? { guests } : null;
	}

	const party = guests > 0 ? { guests } : {};
	const hours = Number.parseInt( dataset.bksHours, 10 );

	if ( hours > 0 ) {
		/*
		 * The start time is carried only when the guest actually named one. Left
		 * empty, the modal's slot grid offers the times that are free on this
		 * date — guessing one here would either be wrong or quietly hold a slot
		 * nobody chose.
		 */
		const startTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(
			dataset.bksTime || ''
		)
			? dataset.bksTime
			: '';

		return { mode: 'hourly', date, hours, startTime, ...party };
	}

	const nights = Number.parseInt( dataset.bksNights, 10 );

	if ( nights > 0 ) {
		const checkOut = addNights( date, nights );

		if ( checkOut ) {
			return {
				mode: 'overnight',
				checkIn: date,
				checkOut,
				nights,
				date,
				...party,
			};
		}
	}

	return { date, ...party };
};

export default function BookingLauncher() {
	const [ opening, setOpening ] = useState( null );

	useEffect( () => {
		const onClick = ( event ) => {
			const trigger = event.target.closest( TRIGGER );

			if ( ! trigger ) {
				return;
			}

			const id = Number.parseInt( trigger.dataset.bookingSuiteBook, 10 );

			if ( ! id ) {
				return;
			}

			event.preventDefault();
			setOpening( { id, stay: stayFrom( trigger.dataset ) } );
		};

		document.addEventListener( 'click', onClick );

		return () => document.removeEventListener( 'click', onClick );
	}, [] );

	if ( ! opening ) {
		return null;
	}

	/*
	 * The key remounts the modal when the apartment changes.
	 *
	 * `initialStay` seeds a useState initialiser, which React runs once — so
	 * without a new key the modal would fetch the other apartment's context
	 * while still holding the stay from the one before it, and the guest would
	 * land on a different room with the old date silently kept.
	 */
	return (
		<BookingModal
			key={ opening.id }
			apartmentId={ opening.id }
			initialStay={ opening.stay }
			onClose={ () => setOpening( null ) }
			onSwitchApartment={ ( { id, date, start } ) =>
				setOpening( {
					id,
					stay: {
						...( opening.stay ?? {} ),
						mode: 'hourly',
						date,
						startTime: start,
					},
				} )
			}
		/>
	);
}
