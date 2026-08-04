/**
 * Portal container for Radix overlays.
 *
 * Radix renders dialogs, popovers, selects and tooltips into document.body by
 * default. That would place them OUTSIDE #booking-suite-admin-root — and since
 * Tailwind is configured with `important: '#booking-suite-admin-root'`, every
 * utility class on that markup would stop matching and the overlay would render
 * completely unstyled.
 *
 * Mounting portals inside the app root instead keeps both the utilities and the
 * CSS custom properties in scope.
 */

const MOUNT_ID = 'booking-suite-admin-root';

/**
 * @return {HTMLElement|undefined} The app root, or undefined to let Radix fall
 *                                 back to document.body (server render, or the
 *                                 root not being in the document yet).
 */
export function getPortalContainer() {
	if ( typeof document === 'undefined' ) {
		return undefined;
	}

	return document.getElementById( MOUNT_ID ) ?? undefined;
}
