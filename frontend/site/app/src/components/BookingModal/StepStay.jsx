/**
 * Step 1 — overnight or by the hour, and when.
 *
 * Slots, their prices and their availability all come from the server; this
 * component only picks between them.
 */

import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { bookingService } from '../../services/bookingService';
import { settings } from '../../services/apartmentService';
import { formatPrice } from '../../utils/format';

const today = () => new Date().toISOString().slice( 0, 10 );

export default function StepStay( {
	stay,
	onChange,
	nights,
	quote,
	capacity,
	apartmentId,
	currency,
	window: overnightWindow,
} ) {
	const [ slotData, setSlotData ] = useState( null );
	const [ isLoadingSlots, setLoadingSlots ] = useState( false );

	const set = ( key ) => ( value ) => onChange( { ...stay, [ key ]: value } );

	const setGuests = ( raw ) =>
		onChange( {
			...stay,
			guests: Math.max(
				1,
				Math.min( capacity, Number.parseInt( raw, 10 ) || 1 )
			),
		} );

	// Reload the slot grid whenever the date, duration or party size changes.
	useEffect( () => {
		if ( 'hourly' !== stay.mode || ! stay.date ) {
			return undefined;
		}

		const controller = new AbortController();

		setLoadingSlots( true );

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
			.then( setSlotData )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setSlotData( null );
				}
			} )
			.finally( () => setLoadingSlots( false ) );

		return () => controller.abort();
	}, [ apartmentId, stay.mode, stay.date, stay.hours, stay.guests ] );

	return (
		<div className="bks-step">
			<div className="bks-modes" role="tablist">
				{ [
					{
						value: 'overnight',
						label: __( 'Overnight', 'booking-suite' ),
						hint: overnightWindow,
					},
					{
						value: 'hourly',
						label: __( 'By the hour', 'booking-suite' ),
						hint: __( 'Daytime', 'booking-suite' ),
					},
				].map( ( mode ) => (
					<button
						key={ mode.value }
						type="button"
						role="tab"
						aria-selected={ stay.mode === mode.value }
						className={ `bks-modes__option${
							stay.mode === mode.value ? ' is-selected' : ''
						}` }
						onClick={ () => set( 'mode' )( mode.value ) }
					>
						<strong>{ mode.label }</strong>
						<span>{ mode.hint }</span>
					</button>
				) ) }
			</div>

			{ 'overnight' === stay.mode ? (
				<div className="bks-step__row">
					<div className="bks-field">
						<label htmlFor="bks-modal-checkin">
							{ __( 'Check-in', 'booking-suite' ) }
						</label>
						<input
							id="bks-modal-checkin"
							type="date"
							min={ today() }
							value={ stay.checkIn }
							onChange={ ( event ) =>
								set( 'checkIn' )( event.target.value )
							}
						/>
					</div>

					<div className="bks-field">
						<label htmlFor="bks-modal-checkout">
							{ __( 'Check-out', 'booking-suite' ) }
						</label>
						<input
							id="bks-modal-checkout"
							type="date"
							min={ stay.checkIn || today() }
							value={ stay.checkOut }
							onChange={ ( event ) =>
								set( 'checkOut' )( event.target.value )
							}
						/>
					</div>

					<div className="bks-field bks-field--narrow">
						<label htmlFor="bks-modal-guests">
							{ __( 'Guests', 'booking-suite' ) }
						</label>
						<input
							id="bks-modal-guests"
							type="number"
							min="1"
							max={ capacity }
							value={ stay.guests }
							onChange={ ( event ) =>
								setGuests( event.target.value )
							}
						/>
					</div>
				</div>
			) : (
				<>
					<div className="bks-step__row">
						<div className="bks-field">
							<label htmlFor="bks-modal-date">
								{ __( 'Date', 'booking-suite' ) }
							</label>
							<input
								id="bks-modal-date"
								type="date"
								min={ today() }
								value={ stay.date }
								onChange={ ( event ) =>
									onChange( {
										...stay,
										date: event.target.value,
										startTime: '',
									} )
								}
							/>
						</div>

						<div className="bks-field bks-field--narrow">
							<label htmlFor="bks-modal-hourly-guests">
								{ __( 'Guests', 'booking-suite' ) }
							</label>
							<input
								id="bks-modal-hourly-guests"
								type="number"
								min="1"
								max={ capacity }
								value={ stay.guests }
								onChange={ ( event ) =>
									setGuests( event.target.value )
								}
							/>
						</div>
					</div>

					{ slotData && (
						<>
							<h3 className="bks-step__title">
								{ __( 'How long?', 'booking-suite' ) }
							</h3>

							<div className="bks-durations">
								{ slotData.durations.map( ( option ) => (
									<button
										key={ option.hours }
										type="button"
										className={ `bks-durations__option${
											stay.hours === option.hours
												? ' is-selected'
												: ''
										}` }
										onClick={ () =>
											onChange( {
												...stay,
												hours: option.hours,
												startTime: '',
											} )
										}
									>
										<strong>
											{ sprintf(
												/* translators: %d: number of hours. */
												_n(
													'%d hour',
													'%d hours',
													option.hours,
													'booking-suite'
												),
												option.hours
											) }
										</strong>
										<span>
											{ formatPrice(
												option.total,
												currency,
												settings.locale
											) }
										</span>
										{ option.discount > 0 && (
											<em className="bks-durations__save">
												{ sprintf(
													/* translators: %s: amount saved. */
													__(
														'save %s',
														'booking-suite'
													),
													formatPrice(
														option.discount,
														currency,
														settings.locale
													)
												) }
											</em>
										) }
									</button>
								) ) }
							</div>

							<h3 className="bks-step__title">
								{ __( 'Start time', 'booking-suite' ) }
							</h3>

							{ isLoadingSlots && (
								<p className="bks-step__hint">
									{ __(
										'Checking availability…',
										'booking-suite'
									) }
								</p>
							) }

							{ ! slotData.slots.length && ! isLoadingSlots && (
								<p className="bks-step__unavailable">
									{ __(
										'Nothing free that day for this length. Try another date or a shorter booking.',
										'booking-suite'
									) }
								</p>
							) }

							<div className="bks-slots">
								{ slotData.slots.map( ( slot ) => (
									<button
										key={ slot.start }
										type="button"
										disabled={ ! slot.available }
										className={ `bks-slots__slot${
											stay.startTime === slot.start
												? ' is-selected'
												: ''
										}${
											slot.available ? '' : ' is-taken'
										}` }
										onClick={ () =>
											set( 'startTime' )( slot.start )
										}
										title={
											slot.available
												? undefined
												: __(
														'Already booked',
														'booking-suite'
												  )
										}
									>
										{ slot.start }
										<span>{ slot.end }</span>
									</button>
								) ) }
							</div>
						</>
					) }
				</>
			) }

			<p className="bks-step__hint">
				{ sprintf(
					/* translators: %d: maximum number of guests. */
					_n(
						'This apartment sleeps up to %d guest.',
						'This apartment sleeps up to %d guests.',
						capacity,
						'booking-suite'
					),
					capacity
				) }
			</p>

			{ 'overnight' === stay.mode && nights > 0 && quote && (
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
