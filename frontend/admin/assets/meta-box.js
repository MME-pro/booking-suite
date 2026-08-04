/**
 * Gallery picker for the apartment meta box.
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

	document.addEventListener( 'DOMContentLoaded', function () {
		document.querySelectorAll( '[data-bks-gallery]' ).forEach( setup );
	} );
} )();
