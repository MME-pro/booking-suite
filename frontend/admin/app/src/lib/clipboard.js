/**
 * Put a string on the clipboard.
 *
 * The async Clipboard API only exists in a secure context, and a WordPress
 * admin served over plain http — every local install, and more live ones than
 * anybody would like — is not one. So the old selection-and-copy route is kept
 * as the fallback rather than leaving the button dead on exactly the sites
 * where the calendar links get set up.
 *
 * @param {string} text The text to copy.
 * @return {Promise<boolean>} Whether it worked.
 */
export async function copyToClipboard( text ) {
	if ( window.navigator?.clipboard?.writeText ) {
		try {
			await window.navigator.clipboard.writeText( text );

			return true;
		} catch ( cause ) {
			// Permission refused, or not a secure context after all. Fall
			// through to the older route rather than giving up.
		}
	}

	const field = window.document.createElement( 'textarea' );

	field.value = text;
	field.setAttribute( 'readonly', '' );
	field.style.position = 'fixed';
	field.style.opacity = '0';

	window.document.body.appendChild( field );
	field.select();

	let copied = false;

	try {
		copied = window.document.execCommand( 'copy' );
	} catch ( cause ) {
		copied = false;
	}

	window.document.body.removeChild( field );

	return copied;
}

export default copyToClipboard;
