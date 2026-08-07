/**
 * ApartmentsApp — the guest apartment list.
 *
 * Composition only: filter state comes from useSearchFilters, data from
 * useApartments, layout from ApartmentGrid, and the controls from
 * SearchFilterBar. Nothing here does any of those jobs itself.
 */

import { useMemo, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { ApartmentGrid } from './components/ApartmentGrid';
import { SearchFilterBar } from './components/SearchFilterBar';
import { useApartments } from './hooks/useApartments';
import { useSearchFilters } from './hooks/useSearchFilters';
import { settings } from './services/apartmentService';
import './ApartmentsApp.css';

export default function ApartmentsApp( {
	columns = 3,
	guests = 0,
	showSearch = true,
	heading = '',
} ) {
	const {
		filters,
		bounds,
		occupancy,
		minDate,
		setDate,
		setHours,
		setGuest,
		resetGuests,
	} = useSearchFilters( { guests } );

	/*
	 * What the guest last searched for, as opposed to what the controls
	 * currently show. Separating them is what stops every tap on a stepper
	 * firing a request.
	 */
	const [ applied, setApplied ] = useState( () => ( {
		date: '',
		hours: bounds.min,
		occupancy: guests > 0 ? guests : 1,
	} ) );

	const { apartments, error, isLoading, isRefreshing, retry } = useApartments(
		{
			guests: applied.occupancy,
		}
	);

	/*
	 * How many skeletons the next wait should draw. Held in a ref and updated
	 * only when real results are on screen, so a refresh redraws the grid at
	 * the height it already had instead of collapsing the page.
	 */
	const lastCount = useRef( columns );

	if ( ! isLoading && ! isRefreshing && apartments.length ) {
		lastCount.current = apartments.length;
	}

	/*
	 * The stay carried into the booking modal, and only worth carrying once a
	 * date is chosen — without one the modal should open on its own defaults
	 * rather than on half a stay.
	 */
	const stay = useMemo(
		() =>
			applied.date
				? {
						date: applied.date,
						hours: applied.hours,
						guests: applied.occupancy,
				  }
				: null,
		[ applied ]
	);

	const isSearching = isLoading || isRefreshing;

	return (
		<div className="bks-apartments">
			{ heading && (
				<h2 className="bks-apartments__heading">{ heading }</h2>
			) }

			{ showSearch && (
				<SearchFilterBar
					filters={ filters }
					bounds={ bounds }
					occupancy={ occupancy }
					minDate={ minDate }
					locale={ settings.locale }
					onDate={ setDate }
					onHours={ setHours }
					onGuest={ setGuest }
					onReset={ resetGuests }
					onSubmit={ () =>
						setApplied( {
							date: filters.date,
							hours: filters.hours,
							occupancy,
						} )
					}
					isBusy={ isSearching }
				/>
			) }

			<ApartmentGrid
				apartments={ apartments }
				columns={ columns }
				locale={ settings.locale }
				stay={ stay }
				isLoading={ isLoading }
				isRefreshing={ isRefreshing }
				error={ error }
				onRetry={ retry }
				placeholders={ lastCount.current }
			/>

			{ /*
			 * Only worth offering once a party size is actually narrowing the
			 * list, so the guest can see why it is shorter than it was.
			 */ }
			{ ! isSearching &&
				! error &&
				applied.occupancy > 1 &&
				apartments.length > 0 && (
					<button
						type="button"
						className="bks-apartments__reset"
						onClick={ () => {
							resetGuests();
							setApplied( ( previous ) => ( {
								...previous,
								occupancy: 1,
							} ) );
						} }
					>
						{ __( 'Show all apartments', 'booking-suite' ) }
					</button>
				) }
		</div>
	);
}
