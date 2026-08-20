/**
 * Entry point — mounts the admin app into the container printed by Menu.php.
 */

import { createRoot } from 'react-dom/client';

import App from './App';
import { settings } from './settings';
import './styles/tokens.css';
import './styles/tailwind.css';
import './styles/base.css';

const MOUNT_ID = 'booking-suite-admin-root';

/**
 * Register the service worker that makes the admin installable.
 *
 * The worker itself does nothing but pass requests through — see Pwa.php for
 * why it deliberately caches nothing. Registering it is what lets Chrome offer
 * to install the app at all.
 *
 * Scoped to wp-admin, never the whole site: a worker with site-wide scope on a
 * property that takes bookings is a serious thing to own by accident.
 *
 * Failure is not reported. A service worker needs a secure context, so every
 * local install over plain http will refuse — and nothing about the admin
 * depends on it, so a console error there would be noise about a feature that
 * was never going to work on that machine.
 */
function registerWorker() {
	if ( ! settings.workerUrl || ! ( 'serviceWorker' in window.navigator ) ) {
		return;
	}

	window.navigator.serviceWorker
		.register( settings.workerUrl, {
			scope: settings.adminPath || '/wp-admin/',
		} )
		.catch( () => {} );
}

document.addEventListener( 'DOMContentLoaded', () => {
	const container = document.getElementById( MOUNT_ID );

	if ( ! container ) {
		return;
	}

	createRoot( container ).render( <App /> );

	registerWorker();
} );
