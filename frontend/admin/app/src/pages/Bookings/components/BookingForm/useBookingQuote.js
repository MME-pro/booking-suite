/**
 * Keeps a live price and a live set of start times beside the booking form.
 *
 * Both come from the server rather than being worked out in the browser: the
 * rate rules — weekday and weekend rates, the billing breaks that make six
 * hours cost less than six times one, Hesse holidays, guest surcharges — live
 * in RateCalculator, and a second implementation here would drift away from
 * the figure the booking is actually saved with.
 */

import { useEffect, useState } from 'react';

import { bookingService } from '../../../../services';

/** Long enough that dragging the guest count does not fire a request each step. */
const DEBOUNCE_MS = 350;

/**
 * @param {Object} stay        apartmentId, mode, date, startTime, hours,
 *                             checkIn, checkOut, guests.
 * @param {number} [excludeId] The booking being edited.
 * @return {Object} quote, slots, durations, isLoading and error.
 */
export function useBookingQuote( stay, excludeId ) {
	const [ quote, setQuote ] = useState( null );
	const [ slots, setSlots ] = useState( [] );
	const [ durations, setDurations ] = useState( [] );
	const [ isLoading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );

	const {
		apartmentId,
		mode,
		date,
		startTime,
		hours,
		checkIn,
		checkOut,
		guests,
	} = stay;

	// Enough to price a stay; short of this there is nothing to ask for.
	const ready =
		Boolean( apartmentId ) &&
		( 'hourly' === mode
			? Boolean( date ) && Boolean( startTime ) && hours > 0
			: Boolean( checkIn ) && Boolean( checkOut ) );

	useEffect( () => {
		if ( ! ready ) {
			setQuote( null );

			return undefined;
		}

		const controller = new AbortController();

		const timer = setTimeout( () => {
			setLoading( true );

			bookingService
				.quote(
					{
						apartmentId,
						mode,
						date,
						startTime,
						hours,
						checkIn,
						checkOut,
						guests,
						excludeId,
					},
					controller.signal
				)
				.then( ( payload ) => {
					setQuote( payload );
					setError( null );
				} )
				.catch( ( cause ) => {
					if ( 'AbortError' !== cause.name ) {
						setQuote( null );
						setError( cause.message );
					}
				} )
				.finally( () => {
					if ( ! controller.signal.aborted ) {
						setLoading( false );
					}
				} );
		}, DEBOUNCE_MS );

		return () => {
			clearTimeout( timer );
			controller.abort();
		};
	}, [
		ready,
		apartmentId,
		mode,
		date,
		startTime,
		hours,
		checkIn,
		checkOut,
		guests,
		excludeId,
	] );

	// Start times are only meaningful for an hourly booking on a chosen date.
	useEffect( () => {
		if ( 'hourly' !== mode || ! apartmentId || ! date ) {
			setSlots( [] );
			setDurations( [] );

			return undefined;
		}

		const controller = new AbortController();

		bookingService
			.slots(
				{ apartmentId, date, hours, guests, excludeId },
				controller.signal
			)
			.then( ( payload ) => {
				setSlots( payload?.slots ?? [] );
				setDurations( payload?.durations ?? [] );
			} )
			.catch( () => {
				// A failed slot list is not worth an error banner; the operator
				// can still type a time.
				setSlots( [] );
				setDurations( [] );
			} );

		return () => controller.abort();
	}, [ mode, apartmentId, date, hours, guests, excludeId ] );

	return { quote, slots, durations, isLoading, error };
}

export default useBookingQuote;
