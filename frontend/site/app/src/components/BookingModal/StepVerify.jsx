/**
 * Proving the guest owns the address they typed.
 *
 * Payment here is a bank transfer against instructions we email, so the
 * address IS the booking. A typo takes the dates off the board, sends the
 * confirmation to a stranger, and leaves the person who actually wanted the
 * apartment hearing nothing — and nobody finds out until the money never
 * arrives. Six digits, once, is the cheapest way to know it is real.
 *
 * The code is requested when this step opens, not when the guest typed their
 * address: asking on every keystroke of a half-written address would post a
 * message for each one.
 */

import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { MailIcon } from '../icons';
import { bookingService } from '../../services/bookingService';

/** Digits in a code; matches EmailVerification::CODE_LENGTH. */
const LENGTH = 6;

export default function StepVerify( {
	email,
	/** Called with the signed token once the code is accepted. */
	onVerified,
} ) {
	const [ code, setCode ] = useState( '' );
	const [ status, setStatus ] = useState( 'sending' );
	const [ error, setError ] = useState( '' );
	const [ resendIn, setResendIn ] = useState( 0 );

	const inputRef = useRef( null );

	/*
	 * One send per address, however many times React re-runs this. Without the
	 * guard, StrictMode's double effect alone posts two codes and the second
	 * invalidates the first the guest is already reading.
	 */
	const requestedFor = useRef( '' );

	const send = async ( { resend = false } = {} ) => {
		setError( '' );
		setStatus( resend ? 'resending' : 'sending' );

		try {
			const result = await bookingService.requestCode( email );

			setStatus( 'sent' );
			setResendIn( result?.resendIn ?? 60 );
			inputRef.current?.focus();
		} catch ( cause ) {
			setStatus( 'failed' );
			setError( cause.message );
		}
	};

	useEffect( () => {
		if ( requestedFor.current === email ) {
			return;
		}

		requestedFor.current = email;
		send();
		// `send` is recreated every render; the address is what decides.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ email ] );

	/* The resend cooling-off, counted down so the button says when. */
	useEffect( () => {
		if ( resendIn <= 0 ) {
			return undefined;
		}

		const timer = setInterval(
			() => setResendIn( ( left ) => Math.max( 0, left - 1 ) ),
			1000
		);

		return () => clearInterval( timer );
	}, [ resendIn ] );

	const confirm = async ( value ) => {
		setError( '' );
		setStatus( 'checking' );

		try {
			const result = await bookingService.confirmCode( email, value );

			setStatus( 'done' );
			onVerified( result.token );
		} catch ( cause ) {
			setStatus( 'sent' );
			setError( cause.message );
			setCode( '' );
			inputRef.current?.focus();
		}
	};

	const onCode = ( event ) => {
		const digits = event.target.value
			.replace( /\D/g, '' )
			.slice( 0, LENGTH );

		setCode( digits );

		// Checked the moment it is complete: a six-digit field with a separate
		// button is one click nobody needs.
		if ( LENGTH === digits.length && 'checking' !== status ) {
			confirm( digits );
		}
	};

	const isBusy = 'sending' === status || 'checking' === status;

	return (
		<div className="bks-step bks-verify">
			<span className="bks-verify__icon" aria-hidden="true">
				<MailIcon size={ 26 } />
			</span>

			<h3 className="bks-step__title">
				{ __( 'Confirm your email', 'booking-suite' ) }
			</h3>

			<p className="bks-verify__lede">
				{ sprintf(
					/* translators: %s: the guest's email address. */
					__(
						'We have sent a six-digit code to %s. Enter it below to continue.',
						'booking-suite'
					),
					email
				) }
			</p>

			<label className="bks-verify__field" htmlFor="bks-modal-otp">
				<span className="bks-sr-only">
					{ __( 'Verification code', 'booking-suite' ) }
				</span>
				<input
					id="bks-modal-otp"
					ref={ inputRef }
					className="bks-verify__input"
					type="text"
					inputMode="numeric"
					autoComplete="one-time-code"
					maxLength={ LENGTH }
					value={ code }
					onChange={ onCode }
					disabled={ isBusy || 'done' === status }
					placeholder="––––––"
					aria-invalid={ Boolean( error ) }
				/>
			</label>

			{ error && <p className="bks-verify__error">{ error }</p> }

			{ 'checking' === status && (
				<p className="bks-step__hint">
					{ __( 'Checking…', 'booking-suite' ) }
				</p>
			) }

			{ 'done' === status && (
				<p className="bks-verify__ok">
					{ __( 'Email confirmed.', 'booking-suite' ) }
				</p>
			) }

			<p className="bks-verify__resend">
				{ resendIn > 0 ? (
					sprintf(
						/* translators: %d: seconds until another code can be sent. */
						__(
							'You can ask for another code in %d seconds.',
							'booking-suite'
						),
						resendIn
					)
				) : (
					<button
						type="button"
						className="bks-verify__resend-button"
						onClick={ () => send( { resend: true } ) }
						disabled={ isBusy }
					>
						{ __( 'Send a new code', 'booking-suite' ) }
					</button>
				) }
			</p>

			<p className="bks-step__hint">
				{ __(
					'Check your spam folder if it has not arrived. Nothing is booked until you finish.',
					'booking-suite'
				) }
			</p>
		</div>
	);
}
