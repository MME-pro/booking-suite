/**
 * Gallery picker and calendar-subscription rows for the apartment meta box.
 *
 * Plain DOM work against wp.media — no build step, since this runs in the
 * classic post editor rather than inside the React app.
 */
( function () {
	'use strict';

	var strings = window.bksApartmentMeta || {};

	function ids( input ) {
		return input.value
			.split( ',' )
			.map( function ( id ) {
				return parseInt( id, 10 );
			} )
			.filter( function ( id ) {
				return ! isNaN( id ) && id > 0;
			} );
	}

	function thumbnail( attachment ) {
		var sizes = attachment.sizes || {};

		return ( sizes.thumbnail || sizes.medium || attachment ).url;
	}

	function item( id, url ) {
		var li = document.createElement( 'li' );
		li.dataset.id = String( id );

		var img = document.createElement( 'img' );
		img.src = url;
		img.alt = '';

		var remove = document.createElement( 'button' );
		remove.type = 'button';
		remove.className = 'bks-meta__remove';
		remove.setAttribute( 'aria-label', strings.removeLabel || 'Remove' );
		remove.innerHTML = '&times;';

		li.appendChild( img );
		li.appendChild( remove );

		return li;
	}

	function setup( root ) {
		var input = root.querySelector( '[data-bks-gallery-input]' );
		var list = root.querySelector( '[data-bks-gallery-list]' );
		var add = root.querySelector( '[data-bks-gallery-add]' );
		var frame;

		function sync() {
			input.value = Array.prototype.map
				.call( list.children, function ( li ) {
					return li.dataset.id;
				} )
				.join( ',' );
		}

		add.addEventListener( 'click', function () {
			if ( ! window.wp || ! window.wp.media ) {
				return;
			}

			if ( ! frame ) {
				frame = window.wp.media( {
					title: strings.frameTitle || 'Photos',
					button: { text: strings.frameButton || 'Use these photos' },
					library: { type: 'image' },
					multiple: 'add',
				} );

				frame.on( 'select', function () {
					var selection = frame.state().get( 'selection' ).toJSON();
					var existing = ids( input );

					selection.forEach( function ( attachment ) {
						if ( existing.indexOf( attachment.id ) > -1 ) {
							return;
						}

						list.appendChild(
							item( attachment.id, thumbnail( attachment ) )
						);
					} );

					sync();
				} );
			}

			frame.open();
		} );

		list.addEventListener( 'click', function ( event ) {
			var button = event.target.closest( '.bks-meta__remove' );

			if ( ! button ) {
				return;
			}

			button.parentNode.remove();
			sync();
		} );
	}

	/**
	 * Read this apartment's subscriptions now, rather than at the next run.
	 *
	 * The schedule pulls every five minutes, which is right for keeping up but
	 * wrong for the moment a link is first pasted: an operator should not have
	 * to wait to find out whether what they pasted works. Each row's own note
	 * is rewritten from what comes back, so a portal that failed says so on its
	 * own line rather than in a banner about "the calendars".
	 *
	 * @param {Element} root The subscriptions container.
	 */
	function setupSync( root ) {
		var button = root.querySelector( '[data-bks-sync]' );
		var apartment = root.getAttribute( 'data-bks-apartment' );

		if ( ! button || ! apartment || ! strings.restRoot ) {
			return;
		}

		var rows = [].slice.call( root.querySelectorAll( '[data-bks-feed]' ) );

		/**
		 * @param {Element} row  The row to write into.
		 * @param {string}  text What to say.
		 * @param {boolean} bad  Whether it is a failure.
		 */
		function note( row, text, bad ) {
			var el = row.querySelector( '.bks-meta__feed-note' );

			if ( ! el ) {
				return;
			}

			el.textContent = text;
			el.classList.toggle( 'is-error', !! bad );
		}

		button.addEventListener( 'click', function () {
			/*
			 * A row with no saved link has nothing to pull, and saying so on
			 * the row beats a button that appears to do nothing.
			 */
			var live = rows.filter( function ( row ) {
				var url = row.querySelector( 'input[type="url"]' );

				return url && '' !== url.value.trim();
			} );

			if ( ! live.length ) {
				rows.forEach( function ( row ) {
					note( row, strings.syncEmpty || '', false );
				} );

				return;
			}

			button.disabled = true;

			live.forEach( function ( row ) {
				note( row, strings.syncing || '', false );
			} );

			window
				.fetch( strings.restRoot + apartment + '/sync', {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						'X-WP-Nonce': strings.nonce,
						'Content-Type': 'application/json',
					},
				} )
				.then( function ( response ) {
					if ( ! response.ok ) {
						throw new Error( 'HTTP ' + response.status );
					}

					return response.json();
				} )
				.then( function ( payload ) {
					( payload.feeds || [] ).forEach( function ( feed ) {
						var row = root.querySelector(
							'[data-bks-feed="' + feed.source + '"]'
						);

						if ( row ) {
							note( row, feed.note, feed.failed );
						}
					} );
				} )
				.catch( function () {
					live.forEach( function ( row ) {
						note( row, strings.syncFailed || '', true );
					} );
				} )
				.finally( function () {
					button.disabled = false;
				} );
		} );
	}
	document.addEventListener( 'DOMContentLoaded', function () {
		document.querySelectorAll( '[data-bks-gallery]' ).forEach( setup );
		document.querySelectorAll( '[data-bks-feeds]' ).forEach( setupSync );
	} );
} )();
