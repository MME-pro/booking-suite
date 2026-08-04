/**
 * Guest apartment list: search bar, responsive card grid, states.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { ApartmentCard } from './components/ApartmentCard';
import { SearchBar } from './components/SearchBar';
import { fetchApartments, settings } from './services/apartmentService';
import { countNights } from './utils/format';
import './ApartmentsApp.css';

export default function ApartmentsApp( {
	columns = 3,
	guests = 0,
	showSearch = true,
	heading = '',
} ) {
	const [ apartments, setApartments ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ hasError, setError ] = useState( false );

	const [ query, setQuery ] = useState( {
		checkIn: '',
		checkOut: '',
		guests: guests > 0 ? String( guests ) : '',
	} );

	// Only committed on submit, so typing does not refetch on every keystroke.
	const [ appliedGuests, setAppliedGuests ] = useState( guests );

	const load = useCallback( async ( guestCount, signal ) => {
		setLoading( true );

		try {
			setApartments(
				await fetchApartments( { guests: guestCount }, signal )
			);
			setError( false );
		} catch ( cause ) {
			if ( 'AbortError' !== cause.name ) {
				setError( true );
			}
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		const controller = new AbortController();

		load( appliedGuests, controller.signal );

		return () => controller.abort();
	}, [ load, appliedGuests ] );

	const nights = useMemo(
		() => countNights( query.checkIn, query.checkOut ),
		[ query.checkIn, query.checkOut ]
	);

	const gridStyle = { '--bks-site-columns': columns };

	return (
		<div className="bks-apartments" style={ gridStyle }>
			{ heading && (
				<h2 className="bks-apartments__heading">{ heading }</h2>
			) }

			{ showSearch && (
				<SearchBar
					values={ query }
					onChange={ setQuery }
					nights={ nights }
					onSubmit={ () =>
						setAppliedGuests(
							Number.parseInt( query.guests, 10 ) || 0
						)
					}
				/>
			) }

			{ isLoading && (
				<div className="bks-apartments__grid" aria-hidden="true">
					{ Array.from( { length: columns }, ( _, index ) => (
						<div
							key={ index }
							className="bks-apartments__skeleton"
						/>
					) ) }
				</div>
			) }

			{ ! isLoading && hasError && (
				<p className="bks-apartments__message" role="alert">
					{ __(
						'The apartments could not be loaded. Please try again shortly.',
						'booking-suite'
					) }
				</p>
			) }

			{ ! isLoading && ! hasError && 0 === apartments.length && (
				<p className="bks-apartments__message">
					{ __(
						'No apartments match your search.',
						'booking-suite'
					) }
				</p>
			) }

			{ ! isLoading && ! hasError && apartments.length > 0 && (
				<div className="bks-apartments__grid">
					{ apartments.map( ( apartment ) => (
						<ApartmentCard
							key={ apartment.id }
							apartment={ apartment }
							locale={ settings.locale }
							nights={ nights }
						/>
					) ) }
				</div>
			) }
		</div>
	);
}
