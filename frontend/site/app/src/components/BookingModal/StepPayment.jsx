/**
 * Step 4 — Payment Form.
 *
 * Payment options, payment date, and payment screenshot / receipt upload.
 */

import { __ } from '@wordpress/i18n';

export default function StepPayment( { payment, onChange } ) {
	const handleFile = ( event ) => {
		const file = event.target.files?.[ 0 ];

		if ( ! file ) {
			return;
		}

		const reader = new window.FileReader();

		reader.onload = () => {
			onChange( {
				...payment,
				proofName: file.name,
				proofData: reader.result,
			} );
		};

		reader.readAsDataURL( file );
	};

	const removeFile = () => {
		onChange( {
			...payment,
			proofName: '',
			proofData: '',
		} );
	};

	const setDate = ( date ) => onChange( { ...payment, date } );

	return (
		<div className="bks-step">
			<div className="bks-step__row">
				<div className="bks-field">
					<label htmlFor="bks-modal-payment-date">
						{ __( 'Payment Date', 'booking-suite' ) }
					</label>
					<input
						id="bks-modal-payment-date"
						type="date"
						value={ payment.date || '' }
						onChange={ ( event ) => setDate( event.target.value ) }
					/>
				</div>
			</div>

			<div className="bks-field">
				<label htmlFor="bks-modal-payment-proof">
					{ __(
						'Upload Payment Screenshot / Receipt',
						'booking-suite'
					) }
				</label>

				{ payment.proofData ? (
					<div className="bks-payment__upload-preview">
						{ payment.proofData.startsWith( 'data:image/' ) ? (
							<img
								src={ payment.proofData }
								alt={ payment.proofName || 'Payment proof' }
								className="bks-payment__thumbnail"
							/>
						) : (
							<div className="bks-payment__file-icon">📄</div>
						) }
						<div className="bks-payment__file-info">
							<span className="bks-payment__file-name">
								{ payment.proofName ||
									__( 'Payment receipt', 'booking-suite' ) }
							</span>
							<span className="bks-payment__file-status">
								{ __(
									'Uploaded successfully',
									'booking-suite'
								) }
							</span>
						</div>
						<button
							type="button"
							className="bks-payment__remove-file"
							onClick={ removeFile }
						>
							{ __( 'Remove', 'booking-suite' ) }
						</button>
					</div>
				) : (
					<label
						className="bks-payment__dropzone"
						htmlFor="bks-modal-payment-proof"
					>
						<input
							id="bks-modal-payment-proof"
							type="file"
							accept="image/*,.pdf"
							className="bks-sr-only"
							onChange={ handleFile }
						/>
						{ /* The dropzone is drawn with an icon, so the label
						     needs its own text for screen readers. */ }
						<span className="bks-sr-only">
							{ __( 'Upload payment proof', 'booking-suite' ) }
						</span>
						<div className="bks-payment__dropzone-content">
							<svg
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="17 8 12 3 7 8" />
								<line x1="12" y1="3" x2="12" y2="15" />
							</svg>
							<strong>
								{ __(
									'Click or drop screenshot of payment here',
									'booking-suite'
								) }
							</strong>
							<span>
								{ __(
									'Supports JPG, PNG, WEBP or PDF receipt',
									'booking-suite'
								) }
							</span>
						</div>
					</label>
				) }
			</div>

			<p className="bks-step__hint">
				{ __(
					'Your booking will be verified once your payment proof is confirmed.',
					'booking-suite'
				) }
			</p>
		</div>
	);
}
