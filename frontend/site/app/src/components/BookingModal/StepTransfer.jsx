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

import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { copyText } from '../../utils/clipboard';
import { formatExactPrice } from '../../utils/format';
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

/** The two-rectangles glyph every interface uses for "copy". */
function CopyGlyph() {
	return (
		<svg
			className="bks-pay__icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15V5a2 2 0 0 1 2-2h10" />
		</svg>
	);
}

/** A tick, for the moment after. */
function DoneGlyph() {
	return (
		<svg
			className="bks-pay__icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="m5 13 4 4L19 7" />
		</svg>
	);
}

/**
 * One line of the payment details.
 *
 * Where the value is worth copying the whole row is the target, not a small
 * button beside it. These are read on a phone with a banking app open in
 * another tab, and an IBAN is twenty-two characters that must survive the
 * journey exactly — a bigger target is the whole point, and "tap the row" needs
 * no explaining.
 *
 * The outcome is always reported. Copying can fail for reasons the guest cannot
 * see, and the earlier version swallowed every one of them: the button said
 * "Copy" before and after, and the value was still only in the page. When it
 * fails now the text is selected instead, which leaves them one keystroke away
 * rather than stranded.
 *
 * @param {Object}  props
 * @param {string}  props.label      What the line is.
 * @param {string}  props.value      The value itself.
 * @param {boolean} [props.copyable] Whether the row can be tapped.
 * @param {boolean} [props.strong]   Draws the eye, for the reference and amount.
 */
function Line( { label, value, copyable = false, strong = false } ) {
	const [ state, setState ] = useState( 'idle' );
	const valueRef = useRef( null );

	if ( ! value ) {
		return null;
	}

	const classes = [
		'bks-pay__line',
		strong ? 'bks-pay__line--strong' : '',
		copyable ? 'bks-pay__line--copyable' : '',
	]
		.filter( Boolean )
		.join( ' ' );

	if ( ! copyable ) {
		return (
			<div className={ classes }>
				<dt className="bks-pay__label">{ label }</dt>
				<dd className="bks-pay__value">
					<span className="bks-pay__text">{ value }</span>
				</dd>
			</div>
		);
	}

	const copy = async () => {
		const done = await copyText( value );

		if ( done ) {
			setState( 'copied' );
			window.setTimeout( () => setState( 'idle' ), 2000 );

			return;
		}

		/*
		 * Nothing reached the clipboard. Select the value on screen so the
		 * guest can copy it themselves, and say so — a button that fails
		 * quietly is worse than no button, because they walk away believing
		 * they have the IBAN.
		 */
		setState( 'failed' );

		const node = valueRef.current;

		if ( node && window.getSelection ) {
			const range = document.createRange();
			range.selectNodeContents( node );

			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange( range );
		}

		window.setTimeout( () => setState( 'idle' ), 4000 );
	};

	return (
		<div className={ classes }>
			<dt className="bks-pay__label">{ label }</dt>
			<dd className="bks-pay__value">
				<button
					type="button"
					className="bks-pay__copyrow"
					onClick={ copy }
					aria-label={ sprintf(
						/* translators: 1: the field's name, 2: its value. */
						__( 'Copy %1$s: %2$s', 'booking-suite' ),
						label,
						value
					) }
				>
					<span className="bks-pay__text" ref={ valueRef }>
						{ value }
					</span>
					<span
						className={ `bks-pay__copyhint bks-pay__copyhint--${ state }` }
					>
						{ 'copied' === state && (
							<>
								<DoneGlyph />
								{ __( 'Copied', 'booking-suite' ) }
							</>
						) }
						{ 'failed' === state && (
							<>{ __( 'Press Ctrl+C', 'booking-suite' ) }</>
						) }
						{ 'idle' === state && (
							<>
								<CopyGlyph />
								{ __( 'Copy', 'booking-suite' ) }
							</>
						) }
					</span>
				</button>
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
			{ /*
			 * The headline follows the amount. Telling a guest to transfer
			 * now, above a line reading €0.00 and a note saying there is
			 * nothing to transfer, is the page arguing with itself.
			 */ }
			<h3 className="bks-pay__title">
				{ total > 0
					? __(
							'Your booking is confirmed — please transfer the payment now',
							'booking-suite'
					  )
					: __( 'Your booking is confirmed', 'booking-suite' ) }
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
					value={ formatExactPrice( total, currency, settings.locale ) }
					strong
				/>
			</dl>

			{ /*
			 * A booking with nothing to pay has no transfer to make and no
			 * GiroCode to scan — EpcQr refuses to build one, correctly, since
			 * a code that opens a zero-euro transfer is worse than none. Say
			 * so, rather than leaving a guest looking at "€0.00" and a gap
			 * where the square should be.
			 */ }
			{ total > 0 ? (
				<GiroCode payload={ payment.giroCode } />
			) : (
				<p className="bks-pay__note">
					{ __(
						'There is nothing to transfer for this booking. Please get in touch so we can confirm it with you.',
						'booking-suite'
					) }
				</p>
			) }

			{ /*
			 * What to do, in the order it has to be done in. The button below
			 * is the second step and only makes sense after the first: pressed
			 * on its own it tells the owner money is coming when none is, and
			 * they will hold the dates and watch their account for a day.
			 */ }
			{ total > 0 && (
			<ol className="bks-pay__steps">
				<li>
					{ sprintf(
						/* translators: %d: hours the dates are held for. */
						__(
							'Make the transfer using the details above, within %d hours. Please quote the booking number as the payment reference — it is how we match your transfer to your booking.',
							'booking-suite'
						),
						reservationHours || 24
					) }
				</li>
				<li>
					{ __(
						'Then press “Initiate Transfer” below. It tells us your payment is on its way — it does not move any money itself.',
						'booking-suite'
					) }
				</li>
			</ol>
			) }

			{ total > 0 && ! isDeclared && (
				<>
					<button
						type="button"
						className="bks-booking__button bks-pay__declare"
						onClick={ onDeclare }
						disabled={ isBusy }
					>
						{ isBusy
							? __( 'Just a moment…', 'booking-suite' )
							: __( 'Initiate Transfer', 'booking-suite' ) }
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
