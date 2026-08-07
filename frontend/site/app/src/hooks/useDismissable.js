/**
 * Closes a popover on an outside click or Escape, and restores focus.
 *
 * Both halves matter and are easy to get half-right: a popover that closes on
 * an outside click but not on Escape is a keyboard trap, and one that closes
 * without returning focus leaves a keyboard user at the top of the document.
 *
 * @param {Object}   options
 * @param {boolean}  options.isOpen  Whether the popover is showing.
 * @param {Function} options.onClose Called to close it.
 * @return {{ containerRef: Object, triggerRef: Object }} Refs to attach.
 */

import { useEffect, useRef } from 'react';

export function useDismissable( { isOpen, onClose } ) {
	const containerRef = useRef( null );
	const triggerRef = useRef( null );

	useEffect( () => {
		if ( ! isOpen ) {
			return undefined;
		}

		const onPointerDown = ( event ) => {
			if ( ! containerRef.current?.contains( event.target ) ) {
				onClose();
			}
		};

		const onKeyDown = ( event ) => {
			if ( 'Escape' !== event.key ) {
				return;
			}

			/*
			 * Stop here rather than letting it bubble: this popover can be open
			 * inside the booking modal, which closes on Escape too, and one
			 * keypress should dismiss one layer.
			 */
			event.stopPropagation();
			onClose();

			// Escape means "put me back where I was", so focus returns to the
			// control that opened it.
			triggerRef.current?.focus();
		};

		/*
		 * pointerdown, not click: a click fires after the pointer is released,
		 * by which time a control under the pointer has already acted on it.
		 */
		document.addEventListener( 'pointerdown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown, true );

		return () => {
			document.removeEventListener( 'pointerdown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown, true );
		};
	}, [ isOpen, onClose ] );

	return { containerRef, triggerRef };
}
