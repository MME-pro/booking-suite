/**
 * Progressive enhancement for the showcase search bar.
 *
 * The bar is deliberately a plain GET form that works with no JavaScript at
 * all: the dropdowns are <details> panels of radio buttons, and choosing one
 * then pressing Search filters the grid. Everything here is an improvement on
 * top of that, never a requirement for it — with this file blocked, the filter
 * still works.
 *
 * Three jobs:
 *
 *   1. Close an open menu when attention moves elsewhere. <details> has no
 *      close-on-outside-click of its own, which is the one way it feels unlike
 *      the native select it replaced.
 *   2. Update the trigger's label when an option is chosen. The Duration menu
 *      manages this in CSS, but the Time menu cannot — its values are clock
 *      times and no static stylesheet can enumerate them.
 *   3. Run the search in place: fetch the matching cards and swap them in
 *      rather than reloading the page, rewriting the URL to the one the form
 *      would have navigated to so a reload or a shared link still works.
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

	/* --------------------------------------------------------------------
	 * Searching without reloading the page.
	 *
	 * The form still works exactly as it did — this only intercepts the
	 * submit when everything it needs is present. Anything missing or
	 * broken and the listener stands aside, the browser submits the form,
	 * and the guest gets the old full-page result rather than nothing.
	 *
	 * The URL is rewritten to the one the form would have navigated to, so
	 * a reload, a shared link and the back button all still land on the
	 * same search. That was true before this file and must stay true: the
	 * search lives in the query string, not in a variable in here.
	 * ----------------------------------------------------------------- */

	var ROOT = '[data-bks-showcase]';
	var RESULTS = '[data-bks-showcase-results]';
	var BUSY = 'is-searching';

	var endpoint =
		'undefined' !== typeof window.bksShowcase && window.bksShowcase.endpoint
			? window.bksShowcase.endpoint
			: '';

	/** The in-flight request, so a fast second search cancels the first. */
	var pending = null;

	/**
	 * Ask the server for the cards matching a search and swap them in.
	 *
	 * @param {Element} root  The showcase being updated.
	 * @param {string}  query The form's query string, without the leading ?.
	 * @param {boolean} push  Whether to add a history entry.
	 */
	function run( root, query, push ) {
		var results = root.querySelector( RESULTS );

		if ( ! results ) {
			return;
		}

		if ( pending ) {
			pending.abort();
		}

		pending = new AbortController();

		root.classList.add( BUSY );
		results.setAttribute( 'aria-busy', 'true' );

		var atts = root.getAttribute( 'data-bks-showcase-atts' ) || '{}';
		var url =
			endpoint +
			( -1 === endpoint.indexOf( '?' ) ? '?' : '&' ) +
			query +
			'&atts=' +
			encodeURIComponent( atts );

		window
			.fetch( url, {
				signal: pending.signal,
				headers: { Accept: 'application/json' },
			} )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'Search failed' );
				}

				return response.json();
			} )
			.then( function ( body ) {
				if ( ! body || 'string' !== typeof body.html ) {
					throw new Error( 'Unexpected reply' );
				}

				results.innerHTML = body.html;

				if ( push ) {
					var base = window.location.pathname;

					window.history.pushState(
						{ bksShowcase: true },
						'',
						query ? base + '?' + query : base
					);
				}
			} )
			.catch( function ( error ) {
				if ( 'AbortError' === error.name ) {
					return;
				}

				/*
				 * The search is the whole point of the bar, so a failure here
				 * falls back to what would have happened anyway rather than
				 * leaving the guest looking at stale cards.
				 */
				window.location.search = query;
			} )
			.finally( function () {
				pending = null;
				root.classList.remove( BUSY );
				results.removeAttribute( 'aria-busy' );
			} );
	}

	document.addEventListener( 'submit', function ( event ) {
		var form = event.target;

		if ( ! form.matches || ! form.matches( '.bks-showcase__search' ) ) {
			return;
		}

		var root = form.closest( ROOT );

		// Without these the plain GET form is still the right answer.
		if (
			! root ||
			! endpoint ||
			! window.fetch ||
			! window.AbortController ||
			! window.history.pushState
		) {
			return;
		}

		event.preventDefault();

		run( root, new window.URLSearchParams( new window.FormData( form ) ).toString(), true );
	} );

	/*
	 * Back and forward move between searches rather than between pages, so
	 * they have to re-run the one now in the URL.
	 */
	window.addEventListener( 'popstate', function () {
		var root = document.querySelector( ROOT );

		if ( root && endpoint ) {
			run( root, window.location.search.replace( /^\?/, '' ), false );
		}
	} );
} )();
