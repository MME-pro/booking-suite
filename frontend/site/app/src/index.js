/**
 * Entry point.
 *
 * Two jobs: mount any apartment lists on the page, and stand ready to open the
 * booking modal when a "Book now" button is clicked. The modal lives in a
 * single container appended to the body, so a page with twenty buttons still
 * has one modal.
 */

import { createRoot } from 'react-dom/client';

import ApartmentsApp from './ApartmentsApp';
import BookingLauncher from './BookingLauncher';
import './styles/tokens.css';
import './styles/base.css';
import './styles/button.css';

// Last: it must win ties against every component stylesheet above.
import './styles/armour.css';

const LIST_SELECTOR = '[data-booking-suite-apartments]';
const MODAL_ROOT_ID = 'booking-suite-modal-root';

const mountLists = () => {
	document.querySelectorAll( LIST_SELECTOR ).forEach( ( container ) => {
		if ( container.dataset.mounted ) {
			return;
		}

		container.dataset.mounted = 'true';

		createRoot( container ).render(
			<ApartmentsApp
				columns={
					Number.parseInt( container.dataset.columns, 10 ) || 3
				}
				guests={ Number.parseInt( container.dataset.guests, 10 ) || 0 }
				showSearch={ 'no' !== container.dataset.search }
				heading={ container.dataset.heading || '' }
			/>
		);
	} );
};

const mountLauncher = () => {
	if ( document.getElementById( MODAL_ROOT_ID ) ) {
		return;
	}

	const root = document.createElement( 'div' );
	root.id = MODAL_ROOT_ID;
	root.className = 'bks-site-root';
	document.body.appendChild( root );

	createRoot( root ).render( <BookingLauncher /> );
};

const boot = () => {
	mountLists();
	mountLauncher();
};

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
