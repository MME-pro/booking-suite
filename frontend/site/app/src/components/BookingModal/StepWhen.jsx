/**
 * Step 1 — when.
 *
 * Date, duration and guests on one row, then the start times that are actually
 * free. Overnight is one of the duration choices rather than a separate mode,
 * so the row stays the same shape either way.
 */

import { useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { bookingService } from '../../services/bookingService';
import { settings } from '../../services/apartmentService';
import { formatPrice, formatWpDate, formatWpTime } from '../../utils/format';
import { addDays, fromKey, startOfToday, toKey } from '../../utils/date';
import DateField from '../DateField/DateField';
import Alternatives from './Alternatives';
import Spinner from './Spinner';

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
 * Only the date, and only for a booking that crosses midnight. A same-day slot
 * shows its finishing time instead; here the day is the thing the guest cannot
 * work out for themselves, and on a 24-hour booking the finishing time would
 * be the very same figure as the start, twice, in a tile too narrow for both.
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

/**
 * How long the fixed block runs, in hours, from the settings.
 *
 * Only needed before the server has answered; once it has, the block carries
 * its own length. Returns 0 when the site defines no block, which reads as
 * falsy at the one place it is used.
 *
 * @param {Object} config The bootstrap settings.
 * @return {number} Hours, or 0.
 */
function blockLength( config ) {
	const from = String( config.daytimeSlotStart ?? '' );
	const to = String( config.daytimeSlotEnd ?? '' );

	if ( ! /^\d{2}:\d{2}$/.test( from ) || ! /^\d{2}:\d{2}$/.test( to ) ) {
		return 0;
	}

	const minutes = ( clock ) => {
		const [ hours, mins ] = clock.split( ':' ).map( Number );

		return hours * 60 + mins;
	};

	const span = minutes( to ) - minutes( from );

	return span > 0 ? Math.round( ( span / 60 ) * 100 ) / 100 : 0;
}


export default function StepWhen( {
	stay,
	onChange,
	quote,
	onEstimate,
	capacity,
	apartmentId,
	currency,
	overnightWindow,
	onSwitchApartment,
} ) {
	const [ slotData, setSlotData ] = useState( null );

	/**
	 * Nights this apartment cannot take, as a Set of 'YYYY-MM-DD' keys.
	 *
	 * Fetched once for the year ahead rather than per month: the payload is a
	 * handful of short strings even for a property that closes for the winter,
	 * and a request on every arrow press would make paging through the
	 * calendar feel like it was loading.
	 */
	const [ takenNights, setTakenNights ] = useState( () => new Set() );

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
		if ( ! apartmentId ) {
			return undefined;
		}

		const controller = new AbortController();
		const from = today();

		bookingService
			.nights(
				{
					apartmentId,
					from,
					to: toKey( addDays( fromKey( from ), 365 ) ),
				},
				controller.signal
			)
			.then( ( data ) => setTakenNights( new Set( data?.taken ?? [] ) ) )
			.catch( () => {
				/*
				 * A picker that cannot reach this still works: every day stays
				 * selectable and the quote refuses the ones that are taken,
				 * which is exactly how it behaved before. Failing the whole
				 * step over a decoration would be worse than the decoration
				 * being missing.
				 */
			} );

		return () => controller.abort();
	}, [ apartmentId ] );

	useEffect( () => {
		/*
		 * Nothing is asked for until the length is one the guest may actually
		 * book. Mid-edit the field holds a partial number — an empty string, or
		 * the "1" of an intended "12" — and firing on those means a grid of
		 * one-hour slots flickering past on the way to a valid figure.
		 */
		/*
		 * Fetched in both modes. The daytime options have to be on screen
		 * while an overnight stay is selected, or choosing overnight is a
		 * one-way door with nothing to click to come back.
		 */
		if ( ! stay.date || ! ( stay.hours >= minHours ) ) {
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

	/*
	 * The fixed daytime block, on the days that have one.
	 *
	 * A block day sends no free-form starts at all, so the grid being empty
	 * there says nothing about whether the day is bookable — the block does.
	 * Reading the two separately is what keeps every Friday and Saturday from
	 * showing the try-another-day panel.
	 */
	const block = 'ready' === status ? slotData?.daytimeSlot ?? null : null;

	/*
	 * Whether this date offers one fixed block instead of free start times.
	 *
	 * Read from the settings and the date alone. It used to come off the slots
	 * response, which is only fetched once the form is valid — so typing a
	 * duration under the minimum stopped the fetch and unlocked the field that
	 * the block was meant to lock. The rule cannot depend on the control it
	 * governs.
	 */
	const isBlockDay = useMemo( () => {
		const days = settings.daytimeSlotDays ?? [];

		if ( ! days.length || ! stay.date ) {
			return false;
		}

		// Parsed as parts rather than through Date(string): a bare 'YYYY-MM-DD'
		// is read as UTC, which lands on the previous day west of Greenwich.
		const [ year, month, day ] = stay.date.split( '-' ).map( Number );
		const weekday = new Date( year, month - 1, day ).getDay();

		// getDay() is 0 for Sunday; the setting is ISO-8601, where Sunday is 7.
		return days.includes( 0 === weekday ? 7 : weekday );
	}, [ stay.date ] );

	const hasFree = freeSlots.length > 0 || Boolean( block?.available );

	/*
	 * What the duration field shows. Empty for an overnight stay, which is
	 * described by its window rather than a length; the block's own length on
	 * a day that has one; otherwise whatever the guest has chosen.
	 */
	let shownHours = stay.hours;

	if ( isOvernight ) {
		shownHours = '';
	} else if ( block ) {
		shownHours = block.hours;
	} else if ( isBlockDay ) {
		/*
		 * The block's own length, worked out from the settings, for the moment
		 * before the slots response lands — otherwise the field would show the
		 * guest's old duration under a label saying it is fixed.
		 */
		shownHours = blockLength( settings ) || stay.hours;
	}

	// The billing break means some lengths cost less than the one below them.
	const chosen = durations.find( ( option ) => option.hours === stay.hours );

	/*
	 * Hand the chosen length's price up to the footer.
	 *
	 * The server prices every length from a fixed midday start, so this figure
	 * does not move when the guest picks 11:30 over 14:00 — which is why it can
	 * be shown before either is picked. A night is priced per night rather than
	 * per hour, so that mode reports nothing and waits for the quote.
	 *
	 * The dependencies are the two numbers rather than the option object: the
	 * effect sends a fresh object every time it runs, and depending on an
	 * object that this component re-creates would run it forever.
	 */
	useEffect( () => {
		if ( ! onEstimate ) {
			return;
		}

		/*
		 * A priced option, not merely a listed one. Until the slots response
		 * lands the lengths come from a local fallback that carries no totals,
		 * and sending one of those would put a formatted NaN where the price
		 * goes — worse than the empty space it replaced.
		 */
		const priced =
			! isOvernight &&
			chosen &&
			Number.isFinite( chosen.total ) &&
			chosen.total > 0;

		onEstimate(
			priced ? { hours: chosen.hours, total: chosen.total } : null
		);
	}, [ isOvernight, chosen?.hours, chosen?.total, onEstimate ] );

	/**
	 * Whether a day cannot be the start of this stay.
	 *
	 * Only applied to OVERNIGHT stays. A night is a fixed 16:00-to-11:00
	 * window, so "is this night free" has one answer and the picker can give
	 * it. A daytime booking is not a fixed window — the same day can be full
	 * at ten and empty at four — so a day is never greyed out there; the slot
	 * grid below already shows exactly which hours are left, which is a truer
	 * answer than a struck-out date would be.
	 *
	 * @param {Date} day The day being drawn.
	 * @return {boolean} Whether to refuse it.
	 */
	const isUnavailable = ( day ) =>
		isOvernight && takenNights.has( toKey( day ) );

	/*
	 * Whether the night the overnight card would book is already gone.
	 *
	 * The daytime tiles drop the times that have been taken rather than
	 * striking them through, because a guest cannot act on a slot that is not
	 * there. The night was the one offer exempt from that: it was printed on
	 * every day whether or not anyone could have it, so a guest could pick a
	 * night that was sold and only find out from the line underneath.
	 *
	 * An empty set means the lookup failed rather than that everything is
	 * free, and the card stays on screen in that case — the quote still
	 * refuses a night that has gone, which is how this behaved before.
	 */
	const overnightTaken =
		Boolean( stay.date ) && takenNights.has( stay.date );

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
					isUnavailable={ isUnavailable }
				/>

				{ /*
				 * On a fixed-block day the length is settled, so the field is
				 * disabled rather than removed. A control that disappears
				 * makes the step look different on a Friday for a reason the
				 * guest cannot see; a greyed one still showing the hours says
				 * what the booking is and that it is not theirs to change.
				 */ }
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
						disabled={ isOvernight || isBlockDay }
						value={ shownHours }
						placeholder={ isOvernight ? overnightWindow : '' }
						onChange={ ( event ) =>
							onDuration( event.target.value )
						}
						onBlur={ onDurationBlur }
					/>
					{ saving && (
						<span className="bks-field__hint">{ saving }</span>
					) }
					{ ! isOvernight && ! saving && isBlockDay && (
						<span className="bks-field__note">
							{ __( 'Fixed on this day.', 'booking-suite' ) }
						</span>
					) }

					{ ! isOvernight && ! saving && ! isBlockDay && (
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

			<h3 className="bks-when__heading">
				{ __( 'Available start times', 'booking-suite' ) }
			</h3>

			{ /*
			 * The overnight stay, offered as one of the times rather than as a
			 * mode to switch into first — on a day whose daytime hours are
			 * gone it is often the only thing left, and a guest should not
			 * have to know it exists to find it.
			 *
			 * Offered whenever the night itself is free; see overnightTaken.
			 */ }
			{ ! overnightTaken && (
			<div className="bks-slots">
				<button
					type="button"
					className={ `bks-slots__slot bks-slots__slot--block bks-slots__slot--rich${
						isOvernight ? ' is-selected' : ''
					}` }
					onClick={ () => onOvernight( true ) }
				>
					<span className="bks-slot__icon">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							focusable="false"
						>
							<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
						</svg>
					</span>
					<span className="bks-slot__body">
						<span className="bks-slot__title">
							{ __( 'Overnight stay', 'booking-suite' ) }
						</span>
						<span className="bks-slot__meta">
							{ overnightWindow }
						</span>
					</span>
				</button>
			</div>
			) }

			{ 'idle' === status && (
				<p className="bks-when__note">
					{ __(
						'Choose a date to see what is free.',
						'booking-suite'
					) }
				</p>
			) }

			{ 'loading' === status && (
				<Spinner
					label={ __( 'Checking availability', 'booking-suite' ) }
				/>
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

			{ /*
			 * Why, before what to do instead. On a fixed-block day the
			 * reason the grid is empty is that the one slot has gone —
			 * and the nearest alternative is an overnight stay on the
			 * same day, not a different day. Printing this after the
			 * other-days panel buried the one sentence that explains
			 * the screen.
			 */ }
			{ block && ! block.available && (
				<p className="bks-when__note">
					{ __(
						'The daytime booking on this day is already taken. An overnight stay may still be free.',
						'booking-suite'
					) }
				</p>
			) }

			{ 'ready' === status && ! hasFree && (
				<Alternatives
					date={ stay.date }
					fixedBlock={ Boolean( block ) }
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
			{ /*
			 * Picking it sets the length as well as the start: the two
			 * are one offer, and a start without its length would post
			 * a window the server refuses.
			 */ }
			{ block && block.available && (
				<div className="bks-slots">
					<button
						type="button"
						className={ `bks-slots__slot bks-slots__slot--block bks-slots__slot--rich${
							stay.startTime === block.start ? ' is-selected' : ''
						}` }
						onClick={ () =>
							onChange( {
								...stay,
								mode: 'hourly',
								startTime: block.start,
								hours: block.hours,
							} )
						}
					>
						<span className="bks-slot__icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
								focusable="false"
							>
								<circle cx="12" cy="12" r="9" />
								<path d="M12 7v5l3 2" />
							</svg>
						</span>
						<span className="bks-slot__body">
							<span className="bks-slot__title">
								{ sprintf(
									/* translators: 1: start time, 2: end time, both 24-hour. */
									__( '%1$s – %2$s', 'booking-suite' ),
									formatWpTime( block.start ),
									formatWpTime( block.end )
								) }
							</span>
							<span className="bks-slot__meta">
								{ sprintf(
									/* translators: %d: how long the booking runs, in hours. */
									_n(
										'%d hour',
										'%d hours',
										block.hours,
										'booking-suite'
									),
									block.hours
								) }
							</span>
						</span>
						{ block.total > 0 && (
							<span className="bks-slot__price">
								{ formatPrice(
									block.total,
									currency,
									settings.locale
								) }
							</span>
						) }
					</button>
				</div>
			) }

			<div className="bks-slots">
				{ freeSlots.map( ( slot ) => (
					<button
						key={ slot.startsAt }
						type="button"
						className={ `bks-slots__slot${
							stay.startTime === slot.start ? ' is-selected' : ''
						}` }
						onClick={ () =>
							onChange( {
								...stay,
								mode: 'hourly',
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
						 * When it finishes, under the time it starts.
						 *
						 * This was a tooltip, which a phone never shows —
						 * so on the device most guests book from, a tile
						 * said when the booking began and nothing about
						 * when it ended.
						 *
						 * A booking long enough to run past midnight ends
						 * on a different date, and there the day is what
						 * the guest cannot work out for themselves: a tile
						 * reading "02:00" looks like it ends before it
						 * started, so that case shows the date instead.
						 */ }
						<span>
							{ endsLater( slot )
								? endDate( slot )
								: sprintf(
										/* translators: %s: the time the booking finishes. */
										__( 'until %s', 'booking-suite' ),
										formatWpTime( slot.end )
								  ) }
						</span>
					</button>
				) ) }
			</div>

			{ /*
			 * Only for a night, which is the only thing here the guest can
			 * choose without having been shown first that it is free.
			 *
			 * A start time carries no such line. It was listed because it was
			 * available, so answering the click with "Available" told the
			 * guest what the list had already told them — and the request
			 * behind that word asked the server a question it had just
			 * answered. Selecting the tile is the acknowledgement; the price
			 * appearing below is the confirmation.
			 */ }
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
