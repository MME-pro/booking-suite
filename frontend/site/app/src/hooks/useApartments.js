/**
 * Owns the apartment list: fetching, cancelling, and the two kinds of waiting.
 *
 * Pulled out of the view because "which apartments, and are we still loading
 * them" is the whole of the screen's state, and a component that both fetches
 * and lays out is the one that becomes hard to change.
 *
 * The two waits are deliberately distinct:
 *
 *   isLoading    Nothing has ever arrived. Show skeletons — there is no
 *                previous result to keep.
 *   isRefreshing A filter changed and results already exist. The caller can
 *                choose between skeletons and keeping the stale list visible.
 *
 * Collapsing them into one flag is what produces the flash of empty page on
 * every filter change.
 *
 * @param {Object} filters        The applied filters.
 * @param {number} filters.guests Party size; 0 for no filter.
 * @return {Object} The list and its state, plus a retry.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchApartments } from '../services/apartmentService';

export function useApartments( { guests = 0 } = {} ) {
	const [ apartments, setApartments ] = useState( [] );
	const [ error, setError ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );
	const [ isRefreshing, setRefreshing ] = useState( false );

	// Distinguishes the first fetch from later ones without another state
	// update — a ref, because changing it must not re-render.
	const hasLoaded = useRef( false );

	// Bumped to re-run the effect on retry, which a plain function call cannot
	// do without duplicating the fetch logic outside it.
	const [ attempt, setAttempt ] = useState( 0 );

	useEffect( () => {
		const controller = new AbortController();

		if ( hasLoaded.current ) {
			setRefreshing( true );
		} else {
			setLoading( true );
		}

		fetchApartments( { guests }, controller.signal )
			.then( ( result ) => {
				setApartments( result );
				setError( null );
				hasLoaded.current = true;
			} )
			.catch( ( cause ) => {
				// An abort is this effect cleaning up after itself, not a
				// failure the guest should be told about.
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message || true );
				}
			} )
			.finally( () => {
				if ( ! controller.signal.aborted ) {
					setLoading( false );
					setRefreshing( false );
				}
			} );

		return () => controller.abort();
	}, [ guests, attempt ] );

	const retry = useCallback( () => setAttempt( ( n ) => n + 1 ), [] );

	return {
		apartments,
		error,
		isLoading,
		isRefreshing,
		retry,
	};
}
