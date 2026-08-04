/**
 * Entry point — mounts the admin app into the container printed by Menu.php.
 */

import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/tokens.css';
import './styles/tailwind.css';
import './styles/base.css';

const MOUNT_ID = 'booking-suite-admin-root';

document.addEventListener( 'DOMContentLoaded', () => {
	const container = document.getElementById( MOUNT_ID );

	if ( ! container ) {
		return;
	}

	createRoot( container ).render( <App /> );
} );
