/**
 * ImageUpload — apartment photos, picked from the WordPress media library.
 *
 * Values are attachment ids paired with a preview URL, which is what the
 * `images` column stores. Nothing is uploaded by this component; wp.media
 * handles the upload and hands back saved attachments.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

import { CloseIcon, CloudUploadIcon } from '../icons';
import { openMediaLibrary } from '../../lib/media';
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
	/*
	 * A fresh frame each time rather than one kept in a ref. The ref version
	 * added an 'open' handler on every click and never removed one, so by the
	 * fourth open the same reset ran four times; and a frame built while a
	 * dialog was closed carried stale handlers into the next one.
	 */
	const openLibrary = () =>
		openMediaLibrary( {
			title: __( 'Apartment photos', 'booking-suite' ),
			button: __( 'Use these photos', 'booking-suite' ),
			multiple: 'add',
			onSelect: ( attachments ) => onChange( attachments.map( toImage ) ),
			// Re-select what is already chosen so the frame opens in sync.
			onOpen: ( frame, media ) =>
				frame
					.state()
					.get( 'selection' )
					.reset(
						images
							.map( ( image ) => media.attachment( image.id ) )
							.filter( Boolean )
					),
		} );

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
