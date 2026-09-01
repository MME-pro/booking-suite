/**
 * Opening the WordPress media library from inside a dialog.
 *
 * This exists because the obvious code does not work. Every form in this admin
 * that picks an image is a Radix dialog, and wp.media renders its own modal
 * into document.body — outside the dialog's portal. Radix then does three
 * things to everything outside its portal, all of them correct in general and
 * all of them fatal here:
 *
 *   · `pointer-events: none` on the body, so clicks never reach the picker
 *   · a focus trap that pulls focus back, so the search field cannot be typed in
 *   · `aria-hidden` on the outside tree
 *
 * The result is a media library the operator can see and cannot use: it opens,
 * and nothing in it responds. Choosing an image on the Extras form did nothing
 * at all, and the apartment gallery had the same fault.
 *
 * So the dialog is told to leave the media modal alone (`dialogMediaProps`),
 * and the CSS in styles/base.css gives the modal its pointer events back.
 * Both halves are needed — either one on its own still leaves it dead.
 */

/** Every part of the WordPress media UI that can take a click or focus. */
const MEDIA_SELECTOR =
	'.media-modal, .media-modal-backdrop, .media-frame, .ui-autocomplete, .wp-core-ui .media-menu';

/**
 * Whether an event happened inside the WordPress media UI.
 *
 * @param {Event} event A Radix outside-interaction event.
 * @return {boolean} True when the media library is what was touched.
 */
export const isMediaEvent = ( event ) => {
	const target = event?.target;

	if ( ! target || 'function' !== typeof target.closest ) {
		return false;
	}

	return Boolean( target.closest( MEDIA_SELECTOR ) );
};

/**
 * Props for a DialogContent that can open the media library.
 *
 * Spread these onto the DialogContent. They stop the dialog from treating the
 * media modal as "outside" — without them, clicking a photo closes the form
 * the operator was filling in, or focus snaps back mid-keystroke.
 */
export const dialogMediaProps = {
	onInteractOutside: ( event ) => {
		if ( isMediaEvent( event ) ) {
			event.preventDefault();
		}
	},
	onPointerDownOutside: ( event ) => {
		if ( isMediaEvent( event ) ) {
			event.preventDefault();
		}
	},
	onFocusOutside: ( event ) => {
		if ( isMediaEvent( event ) ) {
			event.preventDefault();
		}
	},
};

/**
 * Open the media library and hand back what was chosen.
 *
 * @param {Object}   options            How the frame should open.
 * @param {string}   options.title      The frame's heading.
 * @param {string}   options.button     The confirm button's label.
 * @param {boolean}  [options.multiple] Allow more than one selection.
 * @param {Function} options.onSelect   Called with the chosen attachments as
 *                                      plain objects, always an array.
 * @param {Function} [options.onOpen]   Called with the frame as it opens, to
 *                                      pre-select what is already chosen.
 * @return {Object|null} The frame, or null when wp.media is not loaded.
 */
export function openMediaLibrary( {
	title,
	button,
	multiple = false,
	onSelect,
	onOpen,
} ) {
	const media = window.wp?.media;

	if ( ! media ) {
		// wp_enqueue_media() did not run — nothing sensible to fall back to.
		return null;
	}

	const frame = media( {
		title,
		button: { text: button },
		library: { type: 'image' },
		multiple,
	} );

	frame.on( 'select', () => {
		const selection = frame.state().get( 'selection' );

		onSelect?.( selection ? selection.toJSON() : [] );
	} );

	if ( onOpen ) {
		frame.on( 'open', () => onOpen( frame, media ) );
	}

	frame.open();

	return frame;
}
