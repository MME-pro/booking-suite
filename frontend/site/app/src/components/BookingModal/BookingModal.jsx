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
import { addDays, startOfToday, toKey } from '../../utils/date';
import StepWhen from './StepWhen';
import StepOptions from './StepOptions';
import StepDetails from './StepDetails';
import StepTransfer from './StepTransfer';
import StepReview from './StepReview';
import StepVerify from './StepVerify';
import StepDone from './StepDone';
import './BookingModal.css';

/**
 * Every step, in order. `verify` is dropped when there is nothing to prove —
 * the site has verification off, or this address was proved already — so the
 * stepper never shows a number the guest will not be asked to walk through.
 */
/*
 * There is no payment step before the order any more.
 *
 * Bank transfer is the only way to pay and nothing about it is the guest's to
 * decide, so asking them anything about payment before they have committed was
 * a question with one answer. The details they need come AFTER the order, on
 * the payment page, because that is when they are of any use.
 */
const ALL_STEPS = [ 'when', 'extras', 'details', 'verify', 'review' ];

/**
 * Where a proved address is remembered.
 *
 * sessionStorage, not local: "this session" is the tab the guest is booking
 * in. Remembering it past that would leave a signed token on a shared machine
 * long after they had gone, for the sake of saving a step they take once.
 */
const VERIFIED_KEY = 'bksVerifiedEmail';

/**
 * The address proved earlier in this session, if any.
 *
 * Wrapped, because a browser set to block site data throws on the accessor
 * itself rather than returning nothing — and a booking form that will not open
 * in private browsing is a worse bug than one that asks for a code twice.
 *
 * @return {{email: string, token: string}|null} What was proved.
 */
const rememberedVerification = () => {
	try {
		const stored = window.sessionStorage?.getItem( VERIFIED_KEY );

		return stored ? JSON.parse( stored ) : null;
	} catch ( error ) {
		return null;
	}
};

const emptyGuest = {
	firstName: '',
	lastName: '',
	email: '',
	phone: '',
	notes: '',
};

export default function BookingModal( {
	apartmentId,
	initialStay,
	onClose,
	onSwitchApartment,
} ) {
	const [ context, setContext ] = useState( null );
	const [ step, setStep ] = useState( 'when' );
	/**
	 * Where the guest is: still filling the form, on the payment page, or
	 * finished.
	 *
	 * One value rather than two booleans, because "paying" and "done" are
	 * mutually exclusive and a pair of flags can express a state that is
	 * neither — or both.
	 */
	const [ phase, setPhase ] = useState( 'form' );

	/** Both post-order phases hide the stepper and the footer. */
	const isDone = 'form' !== phase;
	const [ isLoading, setLoading ] = useState( true );
	const [ isBusy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ quote, setQuote ] = useState( null );
	const [ booking, setBooking ] = useState( null );

	/*
	 * Opening on today means the slot grid has something to show immediately.
	 * A stay the guest has already described — typed into the showcase search
	 * bar and carried here on the button — overrides that, so the modal opens
	 * on their dates and they never describe the same trip twice.
	 */
	const [ stay, setStay ] = useState( () => {
		/*
		 * Local dates. Both of these were read back with toISOString(), which
		 * is UTC — east of Greenwich that made "today" tomorrow's date after
		 * the evening offset, and adding 86,400,000ms lands an hour out across
		 * a daylight-saving change. A booking is a pair of calendar days as the
		 * guest keeps them, so utils/date does the arithmetic.
		 */
		const today = toKey( startOfToday() );
		const tomorrow = toKey( addDays( startOfToday(), 1 ) );

		return {
			mode: 'hourly',
			date: today,
			startTime: '',
			// The shortest a guest may book, so the modal opens on something
			// bookable rather than on a length it will correct as soon as the
			// field is touched.
			hours: Math.max( 1, Number.parseInt( settings.minHours, 10 ) || 1 ),
			nights: 1,
			checkIn: today,
			checkOut: tomorrow,
			guests: 1,
			...( initialStay ?? {} ),
		};
	} );
	const [ extras, setExtras ] = useState( {} );

	/**
	 * Whether the guest has accepted the terms.
	 *
	 * Not remembered between openings on purpose: consent is given for the
	 * booking being made, and a box that was already ticked when the modal
	 * opened would be recording a decision nobody made this time.
	 */
	const [ accepted, setAccepted ] = useState( false );
	const [ guest, setGuest ] = useState( emptyGuest );
	/** The address proved in this session, and the token that says so. */
	const [ verified, setVerified ] = useState( rememberedVerification );

	const dialogRef = useRef( null );

	useEffect( () => {
		const controller = new AbortController();

		bookingService
			.context( apartmentId, controller.signal )
			.then( ( data ) => {
				setContext( data );
				setError( null );

				/*
				 * The party size can arrive larger than the apartment takes —
				 * the search bar asks for it before an apartment is chosen, and
				 * the Book now shortcode accepts a `guests` attribute set by
				 * hand. Capacity is only known once the context lands, so the
				 * opening figure is held to it here rather than being left to
				 * fail validation at the end of the flow.
				 */
				const capacity = Number( data?.apartment?.capacity ?? 0 );

				if ( capacity > 0 ) {
					setStay( ( current ) =>
						current.guests > capacity
							? { ...current, guests: capacity }
							: current
					);
				}
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

	/**
	 * "I have sent it."
	 *
	 * A status marker with no legal weight — the booking was binding when the
	 * order was placed. It fails soft on purpose: the guest has already done
	 * the thing that matters, and an error here would suggest otherwise, so a
	 * failed call still moves them on to the thank-you page.
	 */
	const declareTransfer = async () => {
		setBusy( true );

		try {
			const updated = await bookingService.declareTransfer(
				booking?.token
			);

			setBooking( ( current ) => ( { ...current, payment: updated } ) );
		} catch ( cause ) {
			// Deliberately swallowed; see above.
		} finally {
			setBusy( false );
			setPhase( 'done' );
		}
	};

	const submit = async () => {
		setBusy( true );
		setError( null );

		try {
			setBooking(
				await bookingService.book( {
					...payload(),
					...guest,
					verificationToken: verified?.token ?? '',
				} )
			);

			/*
			 * Straight to the payment page, not to a thank-you. The booking
			 * exists and the money is owed from this moment, so the next thing
			 * on screen has to be where to send it.
			 */
			setPhase( 'transfer' );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( false );
		}
	};

	/*
	 * The address as it will be compared: the server lowercases and trims
	 * before signing, so anything else here would ask a guest to verify the
	 * same address twice for a capital letter.
	 */
	const typedEmail = guest.email.trim().toLowerCase();

	/** Whether this guest still has to prove the address they typed. */
	const needsVerify =
		Boolean( context?.verifyEmail ) &&
		'' !== typedEmail &&
		verified?.email !== typedEmail;

	const steps = ALL_STEPS.filter(
		( name ) => 'verify' !== name || needsVerify
	);

	const index = steps.indexOf( step );

	/*
	 * A guest who goes back and edits their address after verifying puts the
	 * step back in front of them, and the step they are standing on may have
	 * just disappeared from under them. Landing them on the verify step is the
	 * right answer to both.
	 */
	useEffect( () => {
		if ( -1 === index && ! isDone ) {
			setStep( needsVerify ? 'verify' : 'details' );
		}
	}, [ index, needsVerify, isDone ] );

	const go = ( direction ) => {
		setError( null );
		setStep(
			steps[
				Math.max( 0, Math.min( steps.length - 1, index + direction ) )
			]
		);
	};

	/**
	 * Remember a proved address for the rest of this tab's session.
	 *
	 * @param {string} token The signed token from the server.
	 */
	const onVerified = ( token ) => {
		const proof = { email: typedEmail, token };

		setVerified( proof );

		try {
			window.sessionStorage?.setItem(
				VERIFIED_KEY,
				JSON.stringify( proof )
			);
		} catch ( blocked ) {
			// Private browsing, or site data turned off. The booking still
			// works; the guest would just be asked again if they reopened the
			// modal in this tab.
		}

		setStep( 'review' );
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

		// The code moves the guest on by itself once it is accepted; there is
		// nothing for Continue to do here but let them past unverified.
		if ( 'verify' === step ) {
			return false;
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

	/* Keyed by step, so dropping the verify step drops its label with it. */
	const LABELS = {
		when: __( 'When', 'booking-suite' ),
		extras: __( 'Extras', 'booking-suite' ),
		details: __( 'Details', 'booking-suite' ),
		verify: __( 'Confirm', 'booking-suite' ),
		payment: __( 'Payment', 'booking-suite' ),
		review: __( 'Review', 'booking-suite' ),
	};

	const labels = steps.map( ( name ) => LABELS[ name ] );

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

					{ ! isLoading && apartment && 'transfer' === phase && (
						<StepTransfer
							payment={ booking?.payment }
							onDeclare={ declareTransfer }
							isBusy={ isBusy }
						/>
					) }

					{ ! isLoading && apartment && 'done' === phase && (
						<StepDone booking={ booking } currency={ currency } />
					) }

					{ ! isLoading && apartment && ! isDone && (
						<>
							{ 'when' === step && (
								<StepWhen
									stay={ stay }
									onChange={ setStay }
									onSwitchApartment={ onSwitchApartment }
									quote={ quote }
									capacity={ apartment.capacity }
									apartmentId={ apartmentId }
									currency={ currency }
									overnightWindow={ overnightWindow }
								/>
							) }

							{ 'extras' === step && (
								<StepOptions
									extras={ context.extras }
									chosen={ extras }
									onExtrasChange={ setExtras }
									currency={ currency }
									/*
									 * How many of each are free for the dates
									 * chosen in the previous step — an extra
									 * held by an overlapping booking is offered
									 * again once that stay ends.
									 */
									available={ quote?.extrasAvailable ?? null }
								/>
							) }

							{ 'details' === step && (
								<StepDetails
									guest={ guest }
									onChange={ setGuest }
								/>
							) }

							{ 'verify' === step && (
								<StepVerify
									email={ typedEmail }
									onVerified={ onVerified }
								/>
							) }

							{ 'review' === step && (
								<StepReview
									apartment={ apartment }
									stay={ stay }
									guest={ guest }
									quote={ quote }
									currency={ currency }
									checkInTime={ context?.checkIn }
									checkOutTime={ context?.checkOut }
									accepted={ accepted }
									onAccept={ setAccepted }
									reservationHours={
										settings.reservationHours || 24
									}
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
									disabled={
										isBusy ||
										! quote?.available ||
										! accepted
									}
								>
									{ /*
									 * "Book subject to payment", and nothing
									 * softer. § 312j Abs. 3 BGB requires the
									 * button that concludes the contract to say
									 * in so many words that pressing it means
									 * owing money — a checkout that fails this
									 * risks the contract not binding at all.
									 */ }
									{ isBusy
										? __( 'Sending…', 'booking-suite' )
										: __(
												'Book subject to payment',
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
