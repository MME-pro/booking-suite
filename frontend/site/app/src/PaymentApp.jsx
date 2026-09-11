/**
 * The payment page, standing on its own.
 *
 * Same content as the step a guest sees straight after ordering, but reached
 * from a link in an email rather than from inside the booking flow — so it
 * fetches the booking itself, and has to cope with arriving at one that has
 * moved on since the link was sent.
 *
 * Three states worth telling apart, because the guest's next action differs in
 * each: still owed (pay it), already settled by the owner (nothing to do), and
 * cancelled or gone (get in touch). Showing bank details for a booking that has
 * already been paid or cancelled would invite a second transfer.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import StepDone from './components/BookingModal/StepDone';
import StepTransfer from './components/BookingModal/StepTransfer';
import { bookingService } from './services/bookingService';

export default function PaymentApp( { token } ) {
	const [ payment, setPayment ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );
	const [ isBusy, setBusy ] = useState( false );

	/**
	 * Set when the guest presses the button in this visit.
	 *
	 * Deliberately not the same thing as the booking's own declaredAt. Pressing
	 * it here is the last step of the flow and earns the thank-you screen;
	 * opening the link again tomorrow is a different errand — usually checking
	 * the IBAN — and lands back on the details, with a note saying we already
	 * know the money is coming.
	 */
	const [ justDeclared, setJustDeclared ] = useState( false );

	useEffect( () => {
		const controller = new AbortController();

		bookingService
			.payment( token, controller.signal )
			.then( ( data ) => {
				setPayment( data );
				setError( null );
			} )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [ token ] );

	/**
	 * Say the transfer is on its way.
	 *
	 * Fails soft, as it does in the modal: the guest has already done the thing
	 * that matters, and an error here would suggest their money had not gone.
	 */
	const declare = async () => {
		setBusy( true );

		try {
			setPayment( await bookingService.declareTransfer( token ) );
		} catch ( cause ) {
			// Deliberately swallowed; see above.
		} finally {
			setBusy( false );
			setJustDeclared( true );
		}
	};

	if ( isLoading ) {
		return (
			<p className="bks-paypage__hint">
				{ __( 'Loading your booking…', 'booking-suite' ) }
			</p>
		);
	}

	if ( error || ! payment ) {
		return (
			<div className="bks-paypage__card">
				<h1 className="bks-pay__title">
					{ __( 'We could not open this booking', 'booking-suite' ) }
				</h1>
				<p className="bks-pay__note">
					{ error ??
						__(
							'This payment link is not valid any more. Please use the link in your booking email, or get in touch.',
							'booking-suite'
						) }
				</p>
			</div>
		);
	}

	if ( 'cancelled' === payment.status ) {
		return (
			<div className="bks-paypage__card">
				<h1 className="bks-pay__title">
					{ __( 'This booking has been cancelled', 'booking-suite' ) }
				</h1>
				<p className="bks-pay__reference">
					{ __( 'Booking number', 'booking-suite' ) }
					<strong>{ payment.reference }</strong>
				</p>
				{ /*
				 * No bank details here on purpose. The commonest way to reach
				 * this screen is a link opened after the reservation window
				 * lapsed, and an IBAN under those words is an invitation to
				 * send money for a room that is back on sale.
				 */ }
				<p className="bks-pay__note">
					{ __(
						'Please do not transfer anything. Get in touch if you would like to book these dates again.',
						'booking-suite'
					) }
				</p>
			</div>
		);
	}

	if ( 'confirmed' === payment.status || 'completed' === payment.status ) {
		return (
			<div className="bks-paypage__card">
				<h1 className="bks-pay__title">
					{ __( 'Your payment has arrived', 'booking-suite' ) }
				</h1>
				<p className="bks-pay__reference">
					{ __( 'Booking number', 'booking-suite' ) }
					<strong>{ payment.reference }</strong>
				</p>
				<p className="bks-pay__note">
					{ __(
						'Nothing more to do — your booking is confirmed.',
						'booking-suite'
					) }
				</p>
			</div>
		);
	}

	/*
	 * The end of the flow: order → payment page → transfer initiated → here.
	 */
	if ( justDeclared ) {
		return (
			<div className="bks-paypage__card">
				<StepDone payment={ payment } />
			</div>
		);
	}

	return (
		<div className="bks-paypage__card">
			{ /*
			 * Told us on an earlier visit. The details stay on screen, because
			 * the likeliest reason to come back to this page is to check the
			 * IBAN again — but the button has nothing left to say.
			 */ }
			{ payment.declaredAt && (
				<p className="bks-paypage__declared">
					{ __(
						'Thank you — you have told us the transfer is on its way. We will confirm your booking as soon as it reaches us.',
						'booking-suite'
					) }
				</p>
			) }

			<StepTransfer
				payment={ payment }
				onDeclare={ declare }
				isBusy={ isBusy }
				isDeclared={ Boolean( payment.declaredAt ) }
			/>
		</div>
	);
}
