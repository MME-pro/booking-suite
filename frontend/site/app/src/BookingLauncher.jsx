/**
 * Listens for "Book now" clicks anywhere on the page and opens the modal.
 *
 * A delegated listener rather than one per button, so buttons rendered later —
 * by an Elementor popup, a lazy-loaded loop, an AJAX filter — work without
 * being re-bound.
 */

import { useEffect, useState } from 'react';

import { BookingModal } from './components/BookingModal';

const TRIGGER = '[data-booking-suite-book]';

export default function BookingLauncher() {
	const [ apartmentId, setApartmentId ] = useState( null );

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
			setApartmentId( id );
		};

		document.addEventListener( 'click', onClick );

		return () => document.removeEventListener( 'click', onClick );
	}, [] );

	if ( ! apartmentId ) {
		return null;
	}

	return (
		<BookingModal
			apartmentId={ apartmentId }
			onClose={ () => setApartmentId( null ) }
		/>
	);
}
