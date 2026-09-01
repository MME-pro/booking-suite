/**
 * Step 4 — proof of transfer.
 *
 * Payment is by bank transfer, so nothing is charged here: the guest uploads a
 * screenshot or receipt and the owner confirms it. That makes this upload the
 * one thing on the step that has to be obvious and hard to get wrong.
 *
 * The dropzone accepts a real drop. It previously invited one — "click or drop
 * screenshot here" — while binding no drag handlers at all, so a dropped file
 * navigated the browser away from a half-finished booking. Anything the copy
 * promises is wired below.
 *
 * The guest is not asked when they paid. They had to type a date that the
 * receipt they were uploading already carried, and the owner confirms the
 * transfer against the bank statement anyway — so the date the guest typed was
 * never the one that mattered. `paid_at` is stamped when the owner settles the
 * payment.
 */

import { useCallback, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

/** What the server accepts; see ProofUpload on the PHP side. */
const ACCEPTED = [ 'image/jpeg', 'image/png', 'image/webp', 'application/pdf' ];

/** Refused before reading rather than after, so a huge file fails instantly. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * @param {number} bytes A file size.
 * @return {string} A short human-readable size.
 */
const formatSize = ( bytes ) => {
	if ( bytes < 1024 ) {
		return sprintf(
			/* translators: %d: a file size in bytes. */
			__( '%d B', 'booking-suite' ),
			bytes
		);
	}

	if ( bytes < 1024 * 1024 ) {
		return sprintf(
			/* translators: %d: a file size in kilobytes. */
			__( '%d KB', 'booking-suite' ),
			Math.round( bytes / 1024 )
		);
	}

	return sprintf(
		/* translators: %s: a file size in megabytes, to one decimal. */
		__( '%s MB', 'booking-suite' ),
		( Math.round( ( bytes / 1024 / 1024 ) * 10 ) / 10 ).toString()
	);
};

export default function StepPayment( { payment, onChange, bank, total } ) {
	const [ isDragging, setDragging ] = useState( false );
	const [ error, setError ] = useState( '' );
	const inputRef = useRef( null );

	const accept = useCallback(
		( file ) => {
			if ( ! file ) {
				return;
			}

			if ( ! ACCEPTED.includes( file.type ) ) {
				setError(
					__(
						'That file type is not supported. Use a JPG, PNG, WEBP or PDF.',
						'booking-suite'
					)
				);
				return;
			}

			if ( file.size > MAX_BYTES ) {
				setError(
					sprintf(
						/* translators: %s: the largest allowed file size. */
						__(
							'That file is too large. The most we can take is %s.',
							'booking-suite'
						),
						formatSize( MAX_BYTES )
					)
				);
				return;
			}

			const reader = new window.FileReader();

			reader.onload = () => {
				setError( '' );
				onChange( {
					...payment,
					proofName: file.name,
					proofSize: file.size,
					proofData: reader.result,
				} );
			};

			reader.onerror = () =>
				setError(
					__( 'That file could not be read.', 'booking-suite' )
				);

			reader.readAsDataURL( file );
		},
		[ onChange, payment ]
	);

	const removeFile = () => {
		setError( '' );
		onChange( { ...payment, proofName: '', proofSize: 0, proofData: '' } );

		// The input keeps its last value, so re-choosing the same file would
		// fire no change event without this.
		if ( inputRef.current ) {
			inputRef.current.value = '';
		}
	};

	const onDrop = ( event ) => {
		event.preventDefault();
		setDragging( false );
		accept( event.dataTransfer?.files?.[ 0 ] );
	};

	const isImage = payment.proofData?.startsWith( 'data:image/' );

	return (
		<div className="bks-step">
			{ /*
			 * Where the money goes, above the box asking for proof it went.
			 * The guest is being told to make a transfer and then upload the
			 * receipt; without the account on this screen they have to leave
			 * the booking to go and find it, and a booking left is a booking
			 * lost. Hidden entirely when no IBAN is set — a half-filled
			 * account is worse than none.
			 */ }
			{ bank?.hasAccount && (
				<div className="bks-bank">
					<h3 className="bks-bank__title">
						{ __( 'Transfer the amount to', 'booking-suite' ) }
					</h3>

					<dl className="bks-bank__rows">
						{ bank.holder && (
							<div>
								<dt>
									{ __( 'Account holder', 'booking-suite' ) }
								</dt>
								<dd>{ bank.holder }</dd>
							</div>
						) }

						{ bank.bank && (
							<div>
								<dt>{ __( 'Bank', 'booking-suite' ) }</dt>
								<dd>{ bank.bank }</dd>
							</div>
						) }

						<div>
							<dt>{ __( 'IBAN', 'booking-suite' ) }</dt>
							{ /* Monospace and spaced in fours, so it can be
							   read across without losing your place. */ }
							<dd className="bks-bank__iban">{ bank.iban }</dd>
						</div>

						{ bank.bic && (
							<div>
								<dt>{ __( 'BIC', 'booking-suite' ) }</dt>
								<dd className="bks-bank__iban">{ bank.bic }</dd>
							</div>
						) }

						{ total && (
							<div>
								<dt>{ __( 'Amount', 'booking-suite' ) }</dt>
								<dd className="bks-bank__amount">{ total }</dd>
							</div>
						) }
					</dl>

					{ bank.notes?.map( ( note ) => (
						<p key={ note } className="bks-bank__note">
							{ note }
						</p>
					) ) }

					{ /*
					 * There is no booking number yet — the booking is created
					 * at the end of this flow — so the guest is asked for the
					 * one thing they can give that we can match on. The
					 * confirmation email quotes the real reference once it
					 * exists.
					 */ }
					<p className="bks-bank__note">
						{ __(
							'Please put your name in the payment reference. We will send you the booking number by email.',
							'booking-suite'
						) }
					</p>
				</div>
			) }

			<div className="bks-field">
				<label htmlFor="bks-modal-payment-proof">
					{ __(
						'Upload Payment Screenshot / Receipt',
						'booking-suite'
					) }
					<span
						className="bks-field__required"
						aria-label={ __( 'required', 'booking-suite' ) }
					>
						*
					</span>
				</label>

				{ payment.proofData ? (
					<div className="bks-payment__proof">
						<div className="bks-payment__proof-preview">
							{ isImage ? (
								<img
									src={ payment.proofData }
									alt={ __(
										'The payment receipt you uploaded',
										'booking-suite'
									) }
								/>
							) : (
								<span
									className="bks-payment__proof-file"
									aria-hidden="true"
								>
									PDF
								</span>
							) }
						</div>

						<div className="bks-payment__proof-meta">
							<span className="bks-payment__proof-name">
								{ payment.proofName ||
									__( 'Payment receipt', 'booking-suite' ) }
							</span>

							<span className="bks-payment__proof-status">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.4"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="m5 12.5 4.5 4.5L19 7.5" />
								</svg>
								{ payment.proofSize
									? sprintf(
											/* translators: %s: a file size such as "420 KB". */
											__( 'Ready · %s', 'booking-suite' ),
											formatSize( payment.proofSize )
									  )
									: __( 'Ready', 'booking-suite' ) }
							</span>
						</div>

						<div className="bks-payment__proof-actions">
							<button
								type="button"
								className="bks-payment__proof-action"
								onClick={ () => inputRef.current?.click() }
							>
								{ __( 'Replace', 'booking-suite' ) }
							</button>
							<button
								type="button"
								className="bks-payment__proof-action bks-payment__proof-action--remove"
								onClick={ removeFile }
							>
								{ __( 'Remove', 'booking-suite' ) }
							</button>
						</div>
					</div>
				) : (
					/* eslint-disable-next-line jsx-a11y/label-has-associated-control --
					   the control is the input rendered below, outside this branch. */
					<label
						className={ `bks-payment__dropzone${
							isDragging ? ' is-dragging' : ''
						}` }
						htmlFor="bks-modal-payment-proof"
						onDragOver={ ( event ) => {
							event.preventDefault();
							setDragging( true );
						} }
						onDragLeave={ () => setDragging( false ) }
						onDrop={ onDrop }
					>
						<span className="bks-sr-only">
							{ __( 'Upload payment proof', 'booking-suite' ) }
						</span>

						<span className="bks-payment__dropzone-content">
							<svg
								width="28"
								height="28"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="17 8 12 3 7 8" />
								<line x1="12" y1="3" x2="12" y2="15" />
							</svg>

							<strong>
								{ __(
									'Click or drop your payment screenshot here',
									'booking-suite'
								) }
							</strong>

							<span className="bks-payment__dropzone-hint">
								{ sprintf(
									/* translators: %s: the largest allowed file size. */
									__(
										'JPG, PNG, WEBP or PDF · up to %s',
										'booking-suite'
									),
									formatSize( MAX_BYTES )
								) }
							</span>
						</span>
					</label>
				) }

				{ /* One input for both states, so Replace reuses it. */ }
				<input
					id="bks-modal-payment-proof"
					ref={ inputRef }
					type="file"
					accept={ ACCEPTED.join( ',' ) }
					className="bks-sr-only"
					onChange={ ( event ) =>
						accept( event.target.files?.[ 0 ] )
					}
				/>

				{ error && (
					<p className="bks-payment__error" role="alert">
						{ error }
					</p>
				) }
			</div>

			{ /*
			 * Says why Continue is disabled, rather than leaving a dead button
			 * and no explanation — the commonest way a booking flow loses
			 * someone at the last step.
			 */ }
			<p className="bks-step__hint">
				{ payment.proofData
					? __(
							'Your booking will be verified once your payment proof is confirmed.',
							'booking-suite'
					  )
					: __(
							'A screenshot or receipt of your transfer is required before you can continue.',
							'booking-suite'
					  ) }
			</p>
		</div>
	);
}
