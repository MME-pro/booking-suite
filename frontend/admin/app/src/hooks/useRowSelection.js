/**
 * Ticked rows, for a list that can be acted on in bulk.
 *
 * Every list screen needs the same four things — what is ticked, whether the
 * header box is on, how to turn one row or the whole page on and off, and how
 * to forget the lot. Writing that per table produced four subtly different
 * answers to "what happens to a tick when the page changes", so it lives here.
 *
 * Ids are held in a Set rather than the rows themselves. A row object is
 * replaced on every refetch, so holding rows would keep a selection that looks
 * right and points at stale copies; an id survives the list being reloaded,
 * re-sorted or paged.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * @param {Array}    rows    The rows currently on screen.
 * @param {Function} [getId] How to read a row's id. Defaults to `row.id`.
 *
 * @return {Object} The selection, and the handlers that change it.
 */
export function useRowSelection( rows, getId = ( row ) => row.id ) {
	const [ selected, setSelected ] = useState( () => new Set() );

	const ids = useMemo(
		() =>
			( rows ?? [] )
				.map( getId )
				.filter( ( id ) => undefined !== id && null !== id ),
		[ rows, getId ]
	);

	/*
	 * A tick on a row that is no longer in the list is a tick nobody can see
	 * and nobody can clear — and it would still be deleted by a bulk action.
	 * Dropping them keeps the count on screen honest: the number beside
	 * "selected" is always the number of ticks visible.
	 */
	useEffect( () => {
		setSelected( ( current ) => {
			if ( ! current.size ) {
				return current;
			}

			const onScreen = new Set( ids );
			const kept = [ ...current ].filter( ( id ) => onScreen.has( id ) );

			return kept.length === current.size ? current : new Set( kept );
		} );
	}, [ ids ] );

	const toggle = useCallback( ( id ) => {
		setSelected( ( current ) => {
			const next = new Set( current );

			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}

			return next;
		} );
	}, [] );

	/*
	 * The header box is a single control with three meanings, so it does the
	 * thing that undoes the current state: anything ticked clears, nothing
	 * ticked selects the page. "Select all" while some are ticked would throw
	 * away a careful selection with one click.
	 */
	const toggleAll = useCallback( () => {
		setSelected( ( current ) =>
			current.size ? new Set() : new Set( ids )
		);
	}, [ ids ] );

	const clear = useCallback( () => setSelected( new Set() ), [] );

	return {
		selected,
		count: selected.size,
		isSelected: useCallback( ( id ) => selected.has( id ), [ selected ] ),
		allSelected: ids.length > 0 && selected.size === ids.length,
		someSelected: selected.size > 0 && selected.size < ids.length,
		toggle,
		toggleAll,
		clear,
		ids: useMemo( () => [ ...selected ], [ selected ] ),
	};
}
