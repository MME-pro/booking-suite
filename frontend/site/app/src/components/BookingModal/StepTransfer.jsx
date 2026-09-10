/**
 * The payment page — shown the moment the booking exists.
 *
 * The contract is already concluded by the time a guest sees this: they pressed
 * a button that said so, and they owe the money whether or not they ever come
 * back here. So nothing on this page asks for a decision. It answers one
 * question — where do I send it — and gives two ways to act on the answer: read
 * the details, or point a banking app at the square.
 *
 * The button at the bottom is a courtesy, not a step. It tells the owner the
 * money is on its way so they know to watch for it; it changes nothing about
 * what is owed, and the small print under it says so, because a button that
 * looks like it completes something the guest has not completed is the one
 * thing this page must not have.
 */

import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

/**
 * The GiroCode as an SVG, drawn once per payload.
 *
 * Loaded on demand rather than with the bundle: the encoder is only ever
 * needed on this one screen, which most visitors to a page never reach, and
 * making everyone download it to look at an apartment is a poor trade.
 *
 * A failure here is silent by design. The QR is a shortcut to details that are
 * printed in full directly above it, so a missing square costs a guest nothing
 * but a few seconds of typing — whereas an error message about a code they had
 * not noticed would just be alarming.
 *
 * @param {Object} props
 * @param {string} props.payload The EPC069-12 string from the server.
 */
function GiroCode( { payload } ) {
	const [ svg, setSvg ] = useState( '' );

	useEffect( () => {
		let live = true;

		if ( ! payload ) {
			setSvg( '' );

			return undefined;
		}

		import( 'qrcode' )
			.then( ( qr ) =>
				( qr.default ?? qr ).toString( payload, {
					type: 'svg',
					margin: 1,
					// The square is printed on white here whatever the theme, so
					// a scanner sees the contrast it expects.
					color: { dark: '#0f172a', light: '#ffffff' },
				} )
			)
			.then( ( markup ) => {
				if ( live ) {
					setSvg( markup );
				}
			} )
			.catch( () => {} );

		return () => {
			live = false;
		};
	}, [ payload ] );

	if ( ! svg ) {
		return null;
	}

	return (
		<figure className="bks-giro">
			{ /*
			 * The encoder's own output, which is markup this app generated from
			 * a string the server built — no part of it comes from a guest.
			 */ }
			<div
				className="bks-giro__code"
				/* eslint-disable-next-line react/no-danger */
				dangerouslySetInnerHTML={ { __html: svg } }
			/>
			<figcaption className="bks-giro__caption">
				{ __(
					'Scan with your banking app to fill the transfer in automatically.',
					'booking-suite'
				) }
			</figcaption>
		</figure>
	);
}

/**
 * One line of the payment details, with a button to copy it.
 *
 * The copy button matters most for the IBAN and the reference: both are long,
 * both are transcribed into a banking app, and both fail silently when they are
 * wrong — a mistyped reference means the money arrives and cannot be matched to
 * anyone.
 *
 * @param {Object}  props
 * @param {string}  props.label     What the line is.
 * @param {string}  props.value     The value itself.
 * @param {boolean} [props.copyable] Whether to offer the copy button.
 * @param {boolean} [props.strong]  Draws the eye, for the purpose and amount.
 */
function Line( { label, value, copyable = false, strong = false } ) {
	const [ copied, setCopied ] = useState( false );

	if ( ! value ) {
		return null;
	}

	const copy = async () => {
		try {
			await window.navigator.clipboard.writeText( value );
			setCopied( true );
			window.setTimeout( () => setCopied( false ), 2000 );
		} catch ( error ) {
			// A browser that refuses the clipboard leaves the value on screen
			// to be selected by hand, which is what it was before the button.
		}
	};

	return (
		<div
			className={ `bks-pay__line${ strong ? ' bks-pay__line--strong' : '' }` }
		>
			<dt className="bks-pay__label">{ label }</dt>
			<dd className="bks-pay__value">
				<span className="bks-pay__text">{ value }</span>
				{ copyable && (
					<button
						type="button"
						className="bks-pay__copy"
						onClick={ copy }
						aria-label={ sprintf(
							/* translators: %s: the name of the field being copied. */
							__( 'Copy %s', 'booking-suite' ),
							label
						) }
					>
						{ copied
							? __( 'Copied', 'booking-suite' )
							: __( 'Copy', 'booking-suite' ) }
					</button>
				) }
			</dd>
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.payment   The payment payload from the server.
 * @param {Function} props.onDeclare Called when the guest says they have sent it.
 * @param {boolean}  props.isBusy    While that is in flight.
 */
export default function StepTransfer( {
	payment,
	onDeclare,
	isBusy,
	/** Set once the guest has told us; the button has nothing left to say. */
	isDeclared = false,
} ) {
	if ( ! payment ) {
		return null;
	}

	const { bank = {}, reference, total, currency, reservationHours } = payment;

	return (
		<div className="bks-pay">
			<h3 className="bks-pay__title">
				{ __(
					'Your booking is confirmed — please transfer the payment now',
					'booking-suite'
				) }
			</h3>

			<p className="bks-pay__reference">
				{ __( 'Booking number', 'booking-suite' ) }
				<strong>{ reference }</strong>
			</p>

			<dl className="bks-pay__details">
				<Line
					label={ __( 'Account holder', 'booking-suite' ) }
					value={ bank.holder }
				/>
				<Line
					label={ __( 'IBAN', 'booking-suite' ) }
					value={ bank.iban }
					copyable
				/>
				<Line label={ __( 'BIC', 'booking-suite' ) } value={ bank.bic } copyable />
				<Line label={ __( 'Bank', 'booking-suite' ) } value={ bank.name } />

				{ /*
				 * The purpose is the booking number and nothing else. It is what
				 * the owner matches a line on a bank statement against, so it is
				 * the one field on this page that is drawn to be impossible to
				 * miss.
				 */ }
				<Line
					label={ __( 'Payment reference', 'booking-suite' ) }
					value={ reference }
					copyable
					strong
				/>
				<Line
					label={ __( 'Amount', 'booking-suite' ) }
					value={ formatPrice( total, currency, settings.locale ) }
					strong
				/>
			</dl>

			<GiroCode payload={ payment.giroCode } />

			<p className="bks-pay__note">
				{ sprintf(
					/* translators: %d: hours the dates are held for. */
					__(
						'Please transfer the payment within %d hours, and be sure to include the booking number as the payment reference.',
						'booking-suite'
					),
					reservationHours || 24
				) }
			</p>

			{ ! isDeclared && (
				<>
					<button
						type="button"
						className="bks-booking__button bks-pay__declare"
						onClick={ onDeclare }
						disabled={ isBusy }
					>
						{ isBusy
							? __( 'Just a moment…', 'booking-suite' )
							: __( 'Transfer initiated', 'booking-suite' ) }
					</button>

					<p className="bks-pay__smallprint">
						{ __(
							'Your booking is already binding upon placing your order. This confirmation serves solely to expedite the processing of your payment.',
							'booking-suite'
						) }
					</p>
				</>
			) }
		</div>
	);
}
