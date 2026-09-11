/**
 * Copying text, on the pages this plugin actually runs on.
 *
 * `navigator.clipboard` exists only in a secure context — HTTPS, or localhost.
 * A WordPress site served over plain HTTP, which is every local install and
 * plenty of live ones, does not have it at all: the object is undefined, not a
 * method that fails. Reaching for it inside a try/catch therefore produced a
 * button that did nothing and said nothing, which is how the payment page's
 * copy buttons came to be decorative.
 *
 * So: the modern API where it exists, the old selection trick where it does
 * not, and an honest answer when neither works so the caller can tell the guest
 * to copy by hand rather than pretending.
 */

/**
 * The pre-2018 way: put the text in an off-screen field, select it, and ask the
 * document to copy the selection.
 *
 * Deprecated but not gone, and it is the only thing available over HTTP. The
 * field is positioned rather than hidden because a `display: none` element
 * cannot hold a selection, and `readOnly` keeps the mobile keyboard down.
 *
 * @param {string} text What to copy.
 * @return {boolean} Whether the document accepted it.
 */
const copyBySelection = ( text ) => {
	const field = document.createElement( 'textarea' );

	field.value = text;
	field.setAttribute( 'readonly', '' );
	field.style.position = 'fixed';
	field.style.top = '0';
	field.style.left = '-9999px';
	field.style.opacity = '0';

	document.body.appendChild( field );

	// iOS ignores select() on a readonly field unless the range is set too.
	field.select();
	field.setSelectionRange( 0, text.length );

	let copied = false;

	try {
		copied = document.execCommand( 'copy' );
	} catch ( error ) {
		copied = false;
	}

	document.body.removeChild( field );

	return copied;
};

/**
 * Copy some text, however this browser will allow it.
 *
 * @param {string} text What to copy.
 * @return {Promise<boolean>} Whether it reached the clipboard.
 */
export async function copyText( text ) {
	const value = String( text ?? '' );

	if ( '' === value ) {
		return false;
	}

	if ( window.navigator?.clipboard?.writeText ) {
		try {
			await window.navigator.clipboard.writeText( value );

			return true;
		} catch ( error ) {
			// Permission refused, or the page is not focused. Fall through to
			// the selection trick, which asks for neither.
		}
	}

	return copyBySelection( value );
}
