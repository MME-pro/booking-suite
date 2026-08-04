/**
 * ImageUpload — apartment photos, picked from the WordPress media library.
 *
 * Values are attachment ids paired with a preview URL, which is what the
 * `images` column stores. Nothing is uploaded by this component; wp.media
 * handles the upload and hands back saved attachments.
 */

import { useRef } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';

import { CloseIcon, CloudUploadIcon } from '../icons';
import './ImageUpload.css';

const toImage = ( attachment ) => ( {
	id: attachment.id,
	url:
		attachment.sizes?.thumbnail?.url ??
		attachment.sizes?.medium?.url ??
		attachment.url,
	alt: attachment.alt || '',
} );

export default function ImageUpload( {
	images = [],
	onChange,
	hint = __( 'PNG, JPG, JPEG', 'booking-suite' ),
	className = '',
} ) {
	const frameRef = useRef( null );

	const openLibrary = () => {
		const media = window.wp?.media;

		if ( ! media ) {
			// wp_enqueue_media() did not run — nothing sensible to fall back to.
			return;
		}

		if ( ! frameRef.current ) {
			frameRef.current = media( {
				title: __( 'Apartment photos', 'booking-suite' ),
				button: { text: __( 'Use these photos', 'booking-suite' ) },
				library: { type: 'image' },
				multiple: 'add',
			} );

			frameRef.current.on( 'select', () => {
				onChange(
					frameRef.current
						.state()
						.get( 'selection' )
						.toJSON()
						.map( toImage )
				);
			} );
		}

		// Re-select what is already chosen so the frame opens in sync.
		frameRef.current.on( 'open', () => {
			const selection = frameRef.current.state().get( 'selection' );

			selection.reset(
				images
					.map( ( image ) => media.attachment( image.id ) )
					.filter( Boolean )
			);
		} );

		frameRef.current.open();
	};

	const remove = ( id ) =>
		onChange( images.filter( ( image ) => image.id !== id ) );

	const cover = images[ 0 ] ?? null;

	const classes = [
		'bks-image-upload',
		cover ? 'bks-image-upload--filled' : '',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			<button
				type="button"
				className="bks-image-upload__zone"
				onClick={ openLibrary }
			>
				{ cover ? (
					<img
						className="bks-image-upload__preview"
						src={ cover.url }
						alt={ cover.alt }
					/>
				) : (
					<span className="bks-image-upload__placeholder">
						<CloudUploadIcon />
						<span className="bks-image-upload__label">
							{ __( 'Upload image', 'booking-suite' ) }
						</span>
						<span className="bks-image-upload__hint">{ hint }</span>
					</span>
				) }
			</button>

			{ images.length > 1 && (
				<ul className="bks-image-upload__thumbs">
					{ images.slice( 1 ).map( ( image ) => (
						<li
							key={ image.id }
							className="bks-image-upload__thumb"
						>
							<img src={ image.url } alt={ image.alt } />
							<button
								type="button"
								className="bks-image-upload__remove"
								onClick={ () => remove( image.id ) }
								aria-label={ __(
									'Remove photo',
									'booking-suite'
								) }
							>
								<CloseIcon />
							</button>
						</li>
					) ) }
				</ul>
			) }

			{ images.length > 0 && (
				<p className="bks-image-upload__count">
					{ sprintf(
						/* translators: %d: number of photos selected. */
						_n(
							'%d photo',
							'%d photos',
							images.length,
							'booking-suite'
						),
						images.length
					) }
				</p>
			) }
		</div>
	);
}
