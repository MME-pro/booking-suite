/**
 * InvoiceLogoField — the logo printed at the top of the invoice.
 *
 * Stores the attachment ID rather than a URL, so the PDF can read the file off
 * disk and re-encode it. A URL would mean the invoice depended on the site
 * being reachable at the moment it is generated.
 */

import { __ } from '@wordpress/i18n';
import { ImageIcon, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * @param {Object}   props
 * @param {number}   props.value    Attachment ID, 0 for none.
 * @param {string}   props.url      Preview URL of the current logo, if any.
 * @param {Function} props.onChange Called with the new attachment ID and URL.
 */
export default function InvoiceLogoField( { value, url, onChange } ) {
	/** Opens the WordPress media library; Assets.php already enqueued it. */
	const pick = () => {
		const media = window.wp?.media;

		if ( ! media ) {
			return;
		}

		const frame = media( {
			title: __( 'Choose a logo', 'booking-suite' ),
			library: { type: 'image' },
			multiple: false,
			button: { text: __( 'Use this logo', 'booking-suite' ) },
		} );

		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();

			onChange( attachment.id, attachment.url );
		} );

		frame.open();
	};

	return (
		<div className="flex flex-wrap items-center gap-4">
			<div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
				{ url ? (
					<img
						src={ url }
						alt={ __( 'Invoice logo', 'booking-suite' ) }
						className="max-h-full max-w-full object-contain"
					/>
				) : (
					<ImageIcon
						className="h-6 w-6 text-muted-foreground"
						aria-hidden="true"
					/>
				) }
			</div>

			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="outline" onClick={ pick }>
					{ value
						? __( 'Replace logo', 'booking-suite' )
						: __( 'Choose logo', 'booking-suite' ) }
				</Button>

				{ Boolean( value ) && (
					<Button
						type="button"
						variant="ghost"
						onClick={ () => onChange( 0, '' ) }
					>
						<Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
						{ __( 'Remove', 'booking-suite' ) }
					</Button>
				) }
			</div>
		</div>
	);
}
