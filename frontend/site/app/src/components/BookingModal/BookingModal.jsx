/**
 * BookingModal — the guest booking flow.
 *
 * When → Extras → Details → Payment → Review, then a confirmation. Every price
 * comes from the server on each change, so the browser never decides what
 * anything costs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { bookingService } from '../../services/bookingService';
import { settings } from '../../services/apartmentService';
import { formatPrice } from '../../utils/format';
import StepWhen from './StepWhen';
import StepOptions from './StepOptions';
import StepDetails from './StepDetails';
import StepPayment from './StepPayment';
import StepReview from './StepReview';
import StepDone from './StepDone';
import './BookingModal.css';

const STEPS = [ 'when', 'extras', 'details', 'payment', 'review' ];

const emptyGuest = {
	firstName: '',
	lastName: '',
	email: '',
	phone: '',
	address: '',
	postcode: '',
	city: '',
	country: '',
	notes: '',
};

export default function BookingModal( { apartmentId, onClose } ) {
	const [ context, setContext ] = useState( null );
	const [ step, setStep ] = useState( 'when' );
	const [ isDone, setDone ] = useState( false );
	const [ isLoading, setLoading ] = useState( true );
	const [ isBusy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ quote, setQuote ] = useState( null );
	const [ booking, setBooking ] = useState( null );

	// Opening on today means the slot grid has something to show immediately.
	const [ stay, setStay ] = useState( () => {
		const today = new Date().toISOString().slice( 0, 10 );
		const tomorrow = new Date( Date.now() + 86400000 )
			.toISOString()
			.slice( 0, 10 );

		return {
			mode: 'hourly',
			date: today,
			startTime: '',
			hours: 3,
			nights: 1,
			checkIn: today,
			checkOut: tomorrow,
			guests: 1,
		};
	} );
	const [ extras, setExtras ] = useState( {} );
	const [ guest, setGuest ] = useState( emptyGuest );
	const [ payment, setPayment ] = useState( () => ( {
		method: 'transfer',
		date: new Date().toISOString().slice( 0, 10 ),
		proofName: '',
		proofData: '',
	} ) );

	const dialogRef = useRef( null );

	useEffect( () => {
		const controller = new AbortController();

		bookingService
			.context( apartmentId, controller.signal )
			.then( ( data ) => {
				setContext( data );
				setError( null );
			} )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [ apartmentId ] );

	// Escape closes; the page behind must not scroll.
	useEffect( () => {
		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key ) {
				onClose();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		dialogRef.current?.focus();

		return () => {
			document.removeEventListener( 'keydown', onKeyDown );
			document.body.style.overflow = previous;
		};
	}, [ onClose ] );

	const extraLines = useMemo(
		() =>
			Object.entries( extras )
				.filter( ( [ , quantity ] ) => quantity > 0 )
				.map( ( [ id, quantity ] ) => ( {
					id: Number.parseInt( id, 10 ),
					quantity,
				} ) ),
		[ extras ]
	);

	const payload = useCallback(
		() =>
			'overnight' === stay.mode
				? {
						apartmentId,
						mode: 'overnight',
						checkIn: stay.checkIn,
						checkOut: stay.checkOut,
						guests: stay.guests,
						extras: extraLines,
				  }
				: {
						apartmentId,
						mode: 'hourly',
						date: stay.date,
						startTime: stay.startTime,
						hours: stay.hours,
						guests: stay.guests,
						extras: extraLines,
				  },
		[ apartmentId, stay, extraLines ]
	);

	/** Enough has been chosen for the server to price it. */
	const isStayComplete =
		'overnight' === stay.mode
			? Boolean( stay.checkIn && stay.checkOut )
			: Boolean( stay.date && stay.startTime );

	useEffect( () => {
		if ( ! isStayComplete || isDone ) {
			setQuote( null );
			return undefined;
		}

		const controller = new AbortController();

		bookingService
			.quote( payload(), controller.signal )
			.then( ( result ) => {
				setQuote( result );
				setError( null );
			} )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setQuote( null );
					setError( cause.message );
				}
			} );

		return () => controller.abort();
	}, [ isStayComplete, payload, isDone ] );

	const submit = async () => {
		setBusy( true );
		setError( null );

		try {
			setBooking(
				await bookingService.book( {
					...payload(),
					...guest,
					payment: payment.method || 'transfer',
					paymentDate: payment.date,
					paymentProof: payment.proofData,
					paymentProofName: payment.proofName,
				} )
			);
			setDone( true );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( false );
		}
	};

	const index = STEPS.indexOf( step );

	const go = ( direction ) => {
		setError( null );
		setStep(
			STEPS[
				Math.max( 0, Math.min( STEPS.length - 1, index + direction ) )
			]
		);
	};

	const canContinue = () => {
		if ( 'when' === step ) {
			return isStayComplete && quote?.available;
		}

		if ( 'details' === step ) {
			return (
				guest.firstName.trim() &&
				guest.lastName.trim() &&
				guest.email.trim()
			);
		}

		return true;
	};

	const apartment = context?.apartment;
	const currency = context?.currency ?? 'EUR';

	const overnightWindow = context
		? `${ context.checkIn.slice( 0, 5 ) } – ${ context.checkOut.slice(
				0,
				5
		  ) }`
		: '';

	const labels = [
		__( 'When', 'booking-suite' ),
		__( 'Extras', 'booking-suite' ),
		__( 'Details', 'booking-suite' ),
		__( 'Payment', 'booking-suite' ),
		__( 'Review', 'booking-suite' ),
	];

	return (
		<div
			className="bks-booking__overlay"
			role="presentation"
			onClick={ ( event ) => {
				if ( event.target === event.currentTarget ) {
					onClose();
				}
			} }
		>
			<div
				className="bks-booking"
				role="dialog"
				aria-modal="true"
				aria-label={ __( 'Book this apartment', 'booking-suite' ) }
				tabIndex={ -1 }
				ref={ dialogRef }
			>
				<header className="bks-booking__header">
					<h2 className="bks-booking__title">
						{ apartment?.name ?? __( 'Loading…', 'booking-suite' ) }
					</h2>

					<button
						type="button"
						className="bks-booking__close"
						onClick={ onClose }
						aria-label={ __( 'Close', 'booking-suite' ) }
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M13 1L1 13M1 1L13 13"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>

					{ ! isDone && (
						<ol className="bks-booking__steps">
							{ labels.map( ( label, position ) => (
								<li
									key={ label }
									className={ `bks-booking__step${
										index === position ? ' is-current' : ''
									}${ index > position ? ' is-done' : '' }` }
								>
									<span className="bks-booking__step-no">
										{ position + 1 }
									</span>
									<span className="bks-booking__step-label">
										{ label }
									</span>
								</li>
							) ) }
						</ol>
					) }
				</header>

				<div className="bks-booking__body">
					{ isLoading && (
						<p className="bks-booking__loading">
							{ __( 'Loading…', 'booking-suite' ) }
						</p>
					) }

					{ ! isLoading && error && (
						<p className="bks-booking__error" role="alert">
							{ error }
						</p>
					) }

					{ ! isLoading && apartment && isDone && (
						<StepDone booking={ booking } currency={ currency } />
					) }

					{ ! isLoading && apartment && ! isDone && (
						<>
							{ 'when' === step && (
								<StepWhen
									stay={ stay }
									onChange={ setStay }
									quote={ quote }
									capacity={ apartment.capacity }
									apartmentId={ apartmentId }
									currency={ currency }
									overnightWindow={ overnightWindow }
								/>
							) }

							{ 'extras' === step && (
								<StepOptions
									stay={ stay }
									onChange={ setStay }
									capacity={ apartment.capacity }
									extras={ context.extras }
									chosen={ extras }
									onExtrasChange={ setExtras }
									currency={ currency }
								/>
							) }

							{ 'details' === step && (
								<StepDetails
									guest={ guest }
									onChange={ setGuest }
								/>
							) }

							{ 'payment' === step && (
								<StepPayment
									payment={ payment }
									onChange={ setPayment }
								/>
							) }

							{ 'review' === step && (
								<StepReview
									apartment={ apartment }
									stay={ stay }
									guest={ guest }
									quote={ quote }
									currency={ currency }
									overnightWindow={ overnightWindow }
								/>
							) }
						</>
					) }
				</div>

				{ ! isDone && ! isLoading && apartment && (
					<footer className="bks-booking__footer">
						<div className="bks-booking__total">
							{ quote ? (
								<>
									<span className="bks-booking__total-label">
										{ 'hourly' === quote.mode
											? sprintf(
													/* translators: %d: number of hours. */
													_n(
														'%d hour',
														'%d hours',
														quote.duration
															?.bookedHours ?? 0,
														'booking-suite'
													),
													quote.duration
														?.bookedHours ?? 0
											  )
											: sprintf(
													/* translators: %d: number of nights. */
													_n(
														'%d night',
														'%d nights',
														quote.nights,
														'booking-suite'
													),
													quote.nights
											  ) }
									</span>
									<strong className="bks-booking__total-value">
										{ formatPrice(
											quote.total,
											currency,
											settings.locale
										) }
									</strong>
								</>
							) : (
								<span className="bks-booking__total-label">
									{ __(
										'Choose when you are coming',
										'booking-suite'
									) }
								</span>
							) }
						</div>

						<div className="bks-booking__actions">
							{ 'when' !== step && (
								<button
									type="button"
									className="bks-booking__button bks-booking__button--ghost"
									onClick={ () => go( -1 ) }
									disabled={ isBusy }
								>
									{ __( 'Back', 'booking-suite' ) }
								</button>
							) }

							{ 'review' === step ? (
								<button
									type="button"
									className="bks-booking__button"
									onClick={ submit }
									disabled={ isBusy || ! quote?.available }
								>
									{ isBusy
										? __( 'Sending…', 'booking-suite' )
										: __(
												'Request booking',
												'booking-suite'
										  ) }
								</button>
							) : (
								<button
									type="button"
									className="bks-booking__button"
									onClick={ () => go( 1 ) }
									disabled={ ! canContinue() }
								>
									{ __( 'Continue', 'booking-suite' ) }
								</button>
							) }
						</div>
					</footer>
				) }
			</div>
		</div>
	);
}
