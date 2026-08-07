/**
 * Progressive enhancement for the showcase search bar.
 *
 * The bar is deliberately a plain GET form that works with no JavaScript at
 * all: the dropdowns are <details> panels of radio buttons, and choosing one
 * then pressing Search filters the grid. Everything here is an improvement on
 * top of that, never a requirement for it — with this file blocked, the filter
 * still works.
 *
 * Two jobs:
 *
 *   1. Close an open menu when attention moves elsewhere. <details> has no
 *      close-on-outside-click of its own, which is the one way it feels unlike
 *      the native select it replaced.
 *   2. Update the trigger's label when an option is chosen. The Duration menu
 *      manages this in CSS, but the Time menu cannot — its values are clock
 *      times and no static stylesheet can enumerate them.
 *
 * Vanilla and standalone rather than part of the React bundle: this belongs to
 * the server-rendered grid, and pulling it into the app would tie a page that
 * needs no JavaScript to a bundle that is all of it.
 */

( function () {
	'use strict';

	var MENU = '.bks-showcase__menu';

	/**
	 * Close every open menu except the one passed in.
	 *
	 * @param {Element|null} keep A menu to leave alone.
	 */
	function closeAll( keep ) {
		document.querySelectorAll( MENU + '[open]' ).forEach( function ( menu ) {
			if ( menu !== keep ) {
				menu.open = false;
			}
		} );
	}

	/**
	 * Show the chosen option's label in the trigger.
	 *
	 * Two shapes, because the menus differ in size. Duration and Time render one
	 * hidden span per option and this moves the `is-current` marker between
	 * them. Arrival carries its formatted label on the option itself, and the
	 * trigger holds a single span to write into.
	 *
	 * @param {Element} menu  The menu being changed.
	 * @param {Element} input The radio that was chosen.
	 */
	function showValue( menu, input ) {
		var value = input.value;
		var labels = menu.querySelectorAll( '.bks-showcase__menu-value > span' );

		/*
		 * The Arrival calendar carries its label on the option instead of
		 * pre-rendering one hidden span per choice — four months of dates would
		 * be a hundred-odd spans in the trigger to show one of them.
		 */
		var carried = input.getAttribute( 'data-label' );

		if ( null !== carried ) {
			if ( labels.length ) {
				labels[ 0 ].textContent = carried;
			}

			return;
		}

		labels.forEach( function ( label ) {
			var mine =
				label.getAttribute( 'data-value' ) === value ||
				label.getAttribute( 'data-hours' ) === value;

			label.classList.toggle( 'is-current', mine );
		} );
	}

	// Outside click. pointerdown rather than click: a click fires after the
	// pointer is released, by which time the control under it has already acted.
	document.addEventListener( 'pointerdown', function ( event ) {
		var inside = event.target.closest ? event.target.closest( MENU ) : null;

		closeAll( inside );
	} );

	// Escape closes the menu and returns focus to the trigger, so a keyboard
	// user is not left adrift at the top of the document.
	document.addEventListener( 'keydown', function ( event ) {
		if ( 'Escape' !== event.key ) {
			return;
		}

		var open = document.querySelector( MENU + '[open]' );

		if ( ! open ) {
			return;
		}

		open.open = false;

		var trigger = open.querySelector( '.bks-showcase__menu-trigger' );

		if ( trigger ) {
			trigger.focus();
		}
	} );

	/*
	 * Choosing an option updates the trigger and closes the menu — the two
	 * things a native select does that <details> does not.
	 */
	document.addEventListener( 'change', function ( event ) {
		var input = event.target;

		if ( ! input.matches || ! input.matches( MENU + ' input[type="radio"]' ) ) {
			return;
		}

		var menu = input.closest( MENU );

		if ( ! menu ) {
			return;
		}

		showValue( menu, input );
		menu.open = false;

		var trigger = menu.querySelector( '.bks-showcase__menu-trigger' );

		if ( trigger ) {
			trigger.focus();
		}
	} );

	/*
	 * Opening one menu closes any other. Without this, tabbing or clicking
	 * between the two leaves both panels overlapping the cards below.
	 */
	document.addEventListener(
		'toggle',
		function ( event ) {
			if ( event.target.matches && event.target.matches( MENU ) && event.target.open ) {
				closeAll( event.target );
			}
		},
		true
	);
} )();
