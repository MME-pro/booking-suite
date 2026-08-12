/**
 * RichText — a WYSIWYG editor for content that is stored as HTML.
 *
 * Wraps the editor WordPress already ships (TinyMCE, via wp.editor) rather than
 * bringing in a third-party one. It costs no new dependency, it is the toolbar
 * every WordPress user already knows, and it cleans up pasted Word content —
 * which is how a template's markup usually gets ruined.
 *
 * TinyMCE owns its own DOM, which React must therefore leave alone. Three rules
 * keep the two from fighting:
 *
 *   · the textarea is rendered once and never re-rendered from state;
 *   · edits are pushed out through a ref, so a parent re-render cannot make
 *     the editor tear itself down mid-keystroke;
 *   · the value is only written back in when it differs from what the editor
 *     already holds, or the caret would jump to the start on every keystroke.
 */

import { useEffect, useId, useRef } from 'react';

/**
 * @param {Object}   props
 * @param {string}   props.value    The HTML being edited.
 * @param {Function} props.onChange Called with the new HTML.
 * @param {number}   [props.rows]   Height of the editing area, in rows.
 * @param {string}   [props.id]     Explicit id, when one is needed for a label.
 */
export default function RichText( { value, onChange, rows = 14, id } ) {
	const generated = useId().replace( /:/g, '' );
	const editorId = id ?? `bks-richtext-${ generated }`;

	// Read through a ref so the effect below never needs these as dependencies.
	const onChangeRef = useRef( onChange );
	const valueRef = useRef( value );

	onChangeRef.current = onChange;
	valueRef.current = value;

	useEffect( () => {
		const wp = window.wp;

		// Without wp.editor the textarea below still works as a plain box.
		if ( ! wp?.editor?.initialize ) {
			return undefined;
		}

		wp.editor.initialize( editorId, {
			tinymce: {
				wpautop: false,
				height: rows * 24,
				branding: false,
				menubar: false,
				statusbar: false,
				toolbar1:
					'formatselect,bold,italic,underline,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_add_media,removeformat,undo,redo',
				block_formats:
					'Paragraph=p;Heading=h1;Subheading=h2;Small heading=h3',
				setup( editor ) {
					const push = () =>
						onChangeRef.current( editor.getContent() );

					// 'change' alone misses typing; 'input' alone misses toolbar
					// commands and undo. Both together cover every edit.
					editor.on( 'change input undo redo SetContent', push );
				},
			},
			quicktags: false,
			mediaButtons: true,
		} );

		return () => {
			// Leaves the underlying textarea in place for React to unmount.
			if ( wp.editor.remove ) {
				wp.editor.remove( editorId );
			}
		};
		// Set up once for this editor; value flows through the ref.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ editorId ] );

	/*
	 * Keep the editor in step when the value is replaced from outside — a
	 * template being reset, or reloaded after saving. Guarded, because writing
	 * back what the editor already has would move the caret to the start.
	 */
	useEffect( () => {
		const editor = window.tinymce?.get( editorId );

		if ( ! editor || editor.isHidden() ) {
			return;
		}

		if ( editor.getContent() !== value ) {
			editor.setContent( value ?? '' );
		}
	}, [ editorId, value ] );

	return (
		<textarea
			id={ editorId }
			rows={ rows }
			defaultValue={ value }
			onChange={ ( event ) => onChangeRef.current( event.target.value ) }
			className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
		/>
	);
}
