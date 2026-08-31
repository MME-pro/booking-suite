/**
 * Step 1 — when.
 *
 * Date, duration and guests on one row, then the start times that are actually
 * free. Overnight is one of the duration choices rather than a separate mode,
 * so the row stays the same shape either way.
 */

import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { bookingService } from '../../services/bookingService';
import { settings } from '../../services/apartmentService';
import { formatPrice, formatWpDate, formatWpTime } from '../../utils/format';
import { addDays, fromKey, startOfToday, toKey } from '../../utils/date';
import DateField from '../DateField/DateField';
import Alternatives from './Alternatives';

/** Today, as the guest's own calendar has it. */
const today = () => toKey( startOfToday() );

/**
 * A typed party size, held to what the apartment sleeps.
 *
 * The input's own `max` only binds its spinner — typing or pasting a larger
 * number walks straight past it — so the value is clamped on the way in as
 * well. The server refuses an oversized party regardless; this is what stops
 * the guest reaching that refusal at all.
 *
 * @param {string} raw      What the field currently holds.
 * @param {number} capacity The largest party the apartment takes, 0 if unset.
 * @return {number|string} The clamped count, or '' while the field is empty.
 */
const clampGuests = ( raw, capacity ) => {
	// Let the field be emptied while it is being retyped.
	if ( '' === String( raw ).trim() ) {
		return '';
	}

	const wanted = Number.parseInt( raw, 10 );

	if ( ! Number.isFinite( wanted ) ) {
		return '';
	}

	const ceiling = capacity > 0 ? capacity : wanted;

	return Math.max( 1, Math.min( ceiling, wanted ) );
};

/**
 * Whether a slot finishes on a later date than it starts.
 *
 * @param {Object} slot The slot.
 * @return {boolean} Whether it runs past midnight.
 */
const endsLater = ( slot ) =>
	Boolean( slot.endsAt ) &&
	Boolean( slot.startsAt ) &&
	slot.endsAt.slice( 0, 10 ) !== slot.startsAt.slice( 0, 10 );

/**
 * When a slot ends, carrying the date whenever that is a later day.
 *
 * The long form, for the tooltip. The tile itself shows only the date — see
 * endDate() below.
 *
 * @param {Object} slot The slot.
 * @return {string} "02:00" for a same-day end, "02:00 on 16.09.2026" otherwise.
 */
const endLabel = ( slot ) =>
	endsLater( slot )
		? sprintf(
				/* translators: 1: end time, 2: the date it falls on. */
				__( '%1$s on %2$s', 'booking-suite' ),
				formatWpTime( slot.end ),
				formatWpDate( slot.endsAt.slice( 0, 10 ) )
		  )
		: formatWpTime( slot.end );

/**
 * The day a slot finishes on, for the tile.
 *
 * Only the date. The tile already has the start time in large type above it,
 * and repeating a time underneath says nothing — on a 24-hour booking it is
 * the very same figure twice, and the pair is wider than the tile. What the
 * guest cannot work out for themselves is which day it runs into, so that is
 * all this shows; the exact finishing time is in the tooltip.
 *
 * @param {Object} slot The slot.
 * @return {string} The end date, formatted for the site.
 */
const endDate = ( slot ) => formatWpDate( slot.endsAt.slice( 0, 10 ) );

/**
 * `days` after a 'yyyy-mm-dd' date, as another such date.
 *
 * Goes through utils/date, which works in local time throughout. The version
 * here built a local date and then read it back with toISOString(), which is
 * UTC — so anywhere east of Greenwich, "tomorrow" came back as today. That put
 * check-out on the same day as check-in for a one-night stay, and the guest was
 * shown "Check-out must be after check-in." the instant they ticked Overnight.
 *
 * @param {string} key  A 'yyyy-mm-dd' date.
 * @param {number} days Days to add.
 * @return {string} The shifted date.
 */
const shiftKey = ( key, days ) =>
	toKey( addDays( fromKey( key ) ?? startOfToday(), days ) );

export default function StepWhen( {
	stay,
	onChange,
	quote,
	capacity,
	apartmentId,
	currency,
	overnightWindow,
	onSwitchApartment,
} ) {
	const [ slotData, setSlotData ] = useState( null );

	/**
	 * idle | loading | ready | error.
	 *
	 * Kept as one value rather than a boolean plus null data, so "still
	 * loading" and "loaded nothing" can never be confused for each other.
	 */
	const [ status, setStatus ] = useState( 'idle' );
	const [ slotError, setSlotError ] = useState( '' );

	const isOvernight = 'overnight' === stay.mode;

	/*
	 * The owner's own figure, not a constant: Settings → min_hours is what the
	 * server enforces, and hard-coding three here would let the two drift the
	 * first time it is changed.
	 */
	const minHours = Math.max(
		1,
		Number.parseInt( settings.minHours, 10 ) || 1
	);

	useEffect( () => {
		/*
		 * Nothing is asked for until the length is one the guest may actually
		 * book. Mid-edit the field holds a partial number — an empty string, or
		 * the "1" of an intended "12" — and firing on those means a grid of
		 * one-hour slots flickering past on the way to a valid figure.
		 */
		if ( isOvernight || ! stay.date || ! ( stay.hours >= minHours ) ) {
			setStatus( 'idle' );
			return undefined;
		}

		const controller = new AbortController();

		setStatus( 'loading' );
		setSlotError( '' );

		bookingService
			.slots(
				{
					apartmentId,
					date: stay.date,
					hours: stay.hours,
					guests: stay.guests,
				},
				controller.signal
			)
			.then( ( data ) => {
				setSlotData( data );
				setStatus( 'ready' );
			} )
			.catch( ( cause ) => {
				if ( 'AbortError' === cause.name ) {
					return;
				}

				setSlotData( null );
				setSlotError( cause.message );
				setStatus( 'error' );
			} );

		return () => controller.abort();
	}, [
		apartmentId,
		isOvernight,
		minHours,
		stay.date,
		stay.hours,
		stay.guests,
	] );

	/*
	 * Typing is left alone; the floor is applied when the field is left.
	 *
	 * Clamping on every keystroke fights the guest: with a minimum of three,
	 * typing "10" passes through "1", which would be rewritten to 3 before the
	 * 0 arrived, leaving 30. So the value is taken as typed and held to the
	 * minimum on blur, which is the last moment it can still be wrong.
	 */
	const onDuration = ( value ) =>
		onChange( {
			...stay,
			hours: Number.parseInt( value, 10 ) || '',
			startTime: '',
		} );

	const onDurationBlur = () => {
		if ( isOvernight ) {
			return;
		}

		const wanted = Number.parseInt( stay.hours, 10 );

		if ( ! Number.isFinite( wanted ) || wanted < minHours ) {
			onChange( { ...stay, hours: minHours, startTime: '' } );
		}
	};

	const onOvernight = ( checked ) =>
		onChange( {
			...stay,
			mode: checked ? 'overnight' : 'hourly',
			startTime: '',
			checkIn: stay.date || today(),
			checkOut: shiftKey( stay.date || today(), stay.nights || 1 ),
		} );

	const onDate = ( value ) =>
		onChange( {
			...stay,
			date: value,
			startTime: '',
			checkIn: value,
			checkOut: shiftKey( value, stay.nights || 1 ),
		} );

	const onNights = ( value ) => {
		const nights = Number.parseInt( value, 10 ) || 1;

		onChange( {
			...stay,
			nights,
			checkOut: shiftKey( stay.date || today(), nights ),
		} );
	};

	// The server decides how long a booking may be; until it answers, fall
	// back to a sane range so the input is usable straight away.
	const durations =
		slotData?.durations ??
		Array.from( { length: 8 }, ( _, index ) => ( {
			hours: index + 1,
			discount: 0,
		} ) );

	// Only bookable starts reach the grid; the rest are dropped rather than
	// drawn struck through.
	const freeSlots =
		'ready' === status
			? ( slotData?.slots ?? [] ).filter( ( slot ) => slot.available )
			: [];

	const hasFree = freeSlots.length > 0;

	// The billing break means some lengths cost less than the one below them.
	const chosen = durations.find( ( option ) => option.hours === stay.hours );

	const saving =
		chosen?.discount > 0
			? sprintf(
					/* translators: %s: amount saved at this length. */
					__( 'Save %s at this length', 'booking-suite' ),
					formatPrice( chosen.discount, currency, settings.locale )
			  )
			: '';

	return (
		<div className="bks-when">
			<div className="bks-when__row">
				<DateField
					id="bks-modal-date"
					label={ __( 'Date', 'booking-suite' ) }
					value={ stay.date }
					min={ today() }
					onChange={ onDate }
				/>

				<div className="bks-field">
					<label htmlFor="bks-modal-duration">
						{ __( 'Duration', 'booking-suite' ) }
					</label>
					<input
						id="bks-modal-duration"
						type="number"
						inputMode="numeric"
						min={ minHours }
						step="1"
						disabled={ isOvernight }
						value={ isOvernight ? '' : stay.hours }
						placeholder={ isOvernight ? overnightWindow : '' }
						onChange={ ( event ) =>
							onDuration( event.target.value )
						}
						onBlur={ onDurationBlur }
					/>
					{ saving && (
						<span className="bks-field__hint">{ saving }</span>
					) }
					{ ! isOvernight && ! saving && (
						<span className="bks-field__note">
							{ sprintf(
								/* translators: %d: the shortest bookable length, in hours. */
								_n(
									'From %d hour.',
									'From %d hours.',
									minHours,
									'booking-suite'
								),
								minHours
							) }
						</span>
					) }
				</div>

				{ isOvernight && (
					<div className="bks-field">
						<label htmlFor="bks-modal-nights">
							{ __( 'Nights', 'booking-suite' ) }
						</label>
						<select
							id="bks-modal-nights"
							value={ String( stay.nights || 1 ) }
							onChange={ ( event ) =>
								onNights( event.target.value )
							}
						>
							{ Array.from( { length: 14 }, ( _, index ) => (
								<option key={ index } value={ index + 1 }>
									{ sprintf(
										/* translators: %d: number of nights. */
										_n(
											'%d night',
											'%d nights',
											index + 1,
											'booking-suite'
										),
										index + 1
									) }
								</option>
							) ) }
						</select>
					</div>
				) }

				<div className="bks-field">
					<label htmlFor="bks-modal-guests">
						{ __( 'Guests', 'booking-suite' ) }
					</label>
					<input
						id="bks-modal-guests"
						type="number"
						inputMode="numeric"
						min="1"
						max={ capacity > 0 ? capacity : undefined }
						step="1"
						value={ stay.guests }
						onChange={ ( event ) =>
							onChange( {
								...stay,
								guests: clampGuests(
									event.target.value,
									capacity
								),
							} )
						}
					/>
					{ capacity > 0 && (
						<span className="bks-field__note">
							{ sprintf(
								/* translators: %d: the largest party the apartment takes. */
								_n(
									'Up to %d guest.',
									'Up to %d guests.',
									capacity,
									'booking-suite'
								),
								capacity
							) }
						</span>
					) }
				</div>
			</div>

			<label className="bks-overnight" htmlFor="bks-modal-overnight">
				<input
					id="bks-modal-overnight"
					type="checkbox"
					checked={ isOvernight }
					onChange={ ( event ) =>
						onOvernight( event.target.checked )
					}
				/>
				<span>
					{ sprintf(
						/* translators: %s: the overnight window, e.g. 16:00 – 11:00. */
						__( 'Overnight stay (%s)', 'booking-suite' ),
						overnightWindow
					) }
				</span>
			</label>

			{ isOvernight ? (
				<p className="bks-when__note">
					{ sprintf(
						/* translators: %s: the overnight window. */
						__(
							'Overnight stays run %s and always take priority over hourly bookings.',
							'booking-suite'
						),
						overnightWindow
					) }
				</p>
			) : (
				<>
					<h3 className="bks-when__heading">
						{ __( 'Available start times', 'booking-suite' ) }
					</h3>

					{ 'idle' === status && (
						<p className="bks-when__note">
							{ __(
								'Choose a date to see what is free.',
								'booking-suite'
							) }
						</p>
					) }

					{ 'loading' === status && (
						<p className="bks-when__note">
							{ __( 'Checking availability…', 'booking-suite' ) }
						</p>
					) }

					{ 'error' === status && (
						<p className="bks-step__unavailable" role="alert">
							{ slotError ||
								__(
									'Could not load the available times.',
									'booking-suite'
								) }
						</p>
					) }

					{ 'ready' === status && ! hasFree && (
						<Alternatives
							date={ stay.date }
							alternatives={ slotData?.alternatives }
							currency={ currency }
							onPick={ ( pick ) =>
								onChange( {
									...stay,
									date: pick.date,
									startTime: pick.start,
								} )
							}
							onSwitch={ onSwitchApartment }
						/>
					) }

					{ /*
					 * Only the times that can actually be booked. A grid of
					 * struck-through tiles is mostly noise — on a busy day it
					 * pushed the handful of real options off the screen — and
					 * a guest cannot act on a time that is gone.
					 */ }
					<div className="bks-slots">
						{ freeSlots.map( ( slot ) => (
							<button
								key={ slot.startsAt }
								type="button"
								className={ `bks-slots__slot${
									stay.startTime === slot.start
										? ' is-selected'
										: ''
								}` }
								onClick={ () =>
									onChange( {
										...stay,
										startTime: slot.start,
									} )
								}
								title={ sprintf(
									/* translators: %s: when the booking ends, with the day if it is a later one. */
									__( 'until %s', 'booking-suite' ),
									endLabel( slot )
								) }
							>
								{ formatWpTime( slot.start ) }

								{ /*
								 * A booking long enough to run past midnight
								 * ends on a different date, and a tile showing
								 * only "02:00" reads as ending before it
								 * started. The day is spelled out whenever it
								 * is not the one the guest picked.
								 */ }
								{ endsLater( slot ) && (
									<span>{ endDate( slot ) }</span>
								) }
							</button>
						) ) }
					</div>
				</>
			) }

			{ isOvernight && quote && (
				<p
					className={
						quote.available
							? 'bks-step__available'
							: 'bks-step__unavailable'
					}
					role="status"
				>
					{ quote.available
						? __( 'Available — you can continue.', 'booking-suite' )
						: __(
								'Those dates are already taken. Please try another window.',
								'booking-suite'
						  ) }
				</p>
			) }
		</div>
	);
}
