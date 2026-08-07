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
import { formatPrice, formatWpTime } from '../../utils/format';
import DateField from '../DateField/DateField';

const today = () => new Date().toISOString().slice( 0, 10 );

const addDays = ( date, days ) => {
	const result = new Date( `${ date }T00:00:00` );

	result.setDate( result.getDate() + days );

	return result.toISOString().slice( 0, 10 );
};

export default function StepWhen( {
	stay,
	onChange,
	quote,
	capacity,
	apartmentId,
	currency,
	overnightWindow,
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

	useEffect( () => {
		if ( isOvernight || ! stay.date ) {
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
	}, [ apartmentId, isOvernight, stay.date, stay.hours, stay.guests ] );

	const onDuration = ( value ) =>
		onChange( {
			...stay,
			hours: Number.parseInt( value, 10 ) || '',
			startTime: '',
		} );

	const onOvernight = ( checked ) =>
		onChange( {
			...stay,
			mode: checked ? 'overnight' : 'hourly',
			startTime: '',
			checkIn: stay.date || today(),
			checkOut: addDays( stay.date || today(), stay.nights || 1 ),
		} );

	const onDate = ( value ) =>
		onChange( {
			...stay,
			date: value,
			startTime: '',
			checkIn: value,
			checkOut: addDays( value, stay.nights || 1 ),
		} );

	const onNights = ( value ) => {
		const nights = Number.parseInt( value, 10 ) || 1;

		onChange( {
			...stay,
			nights,
			checkOut: addDays( stay.date || today(), nights ),
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
						min="1"
						step="1"
						disabled={ isOvernight }
						value={ isOvernight ? '' : stay.hours }
						placeholder={ isOvernight ? overnightWindow : '' }
						onChange={ ( event ) =>
							onDuration( event.target.value )
						}
					/>
					{ saving && (
						<span className="bks-field__hint">{ saving }</span>
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
						step="1"
						value={ stay.guests }
						onChange={ ( event ) =>
							onChange( {
								...stay,
								guests:
									Number.parseInt( event.target.value, 10 ) ||
									'',
							} )
						}
					/>
					{ capacity > 0 && stay.guests > capacity && (
						<span className="bks-field__note">
							{ sprintf(
								/* translators: %d: the apartment's usual capacity. */
								__(
									'Usually sleeps %d — we will confirm the extra beds with you.',
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

					{ 'ready' === status &&
						! slotData?.slots?.some(
							( slot ) => slot.available
						) && (
							<p className="bks-step__unavailable">
								{ __(
									'Nothing free that day for this length. Try another date or a shorter booking.',
									'booking-suite'
								) }
							</p>
						) }

					<div className="bks-slots">
						{ ( 'ready' === status
							? slotData?.slots ?? []
							: []
						).map( ( slot ) => (
							<button
								key={ slot.start }
								type="button"
								disabled={ ! slot.available }
								className={ `bks-slots__slot${
									stay.startTime === slot.start
										? ' is-selected'
										: ''
								}${ slot.available ? '' : ' is-taken' }` }
								onClick={ () =>
									onChange( {
										...stay,
										startTime: slot.start,
									} )
								}
								title={
									slot.available
										? sprintf(
												/* translators: %s: end time. */
												__(
													'until %s',
													'booking-suite'
												),
												formatWpTime( slot.end )
										  )
										: __(
												'Already booked',
												'booking-suite'
										  )
								}
							>
								{ formatWpTime( slot.start ) }
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
