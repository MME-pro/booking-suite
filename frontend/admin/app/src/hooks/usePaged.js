/**
 * Paging for a list already in hand.
 *
 * The lists here are filtered, sorted and counted in the browser — the stats
 * above each page are drawn from the whole set, not the visible slice — so the
 * paging is done in the same place. Nothing is re-fetched to turn a page.
 *
 * The page resets whenever the list gets shorter than the position we are at,
 * which is what happens when a filter is applied while the operator is on page
 * four: without it they land on an empty page and think the filter found
 * nothing.
 */

import { useEffect, useMemo, useState } from 'react';

/** How many rows a page holds before one is worth having at all. */
export const PAGE_SIZE = 25;

/**
 * @param {Array}  rows   The full, already-filtered list.
 * @param {number} [size] Rows per page.
 * @return {Object} `{ page, setPage, pageCount, rows, from, to, total }`.
 */
export function usePaged( rows, size = PAGE_SIZE ) {
	const [ page, setPage ] = useState( 1 );

	const total = rows.length;
	const pageCount = Math.max( 1, Math.ceil( total / size ) );

	// Snap back when the list shrinks under us.
	useEffect( () => {
		setPage( ( current ) => Math.min( current, pageCount ) );
	}, [ pageCount ] );

	const visible = useMemo( () => {
		const start = ( Math.min( page, pageCount ) - 1 ) * size;

		return rows.slice( start, start + size );
	}, [ rows, page, pageCount, size ] );

	const start = ( Math.min( page, pageCount ) - 1 ) * size;

	return {
		page: Math.min( page, pageCount ),
		setPage,
		pageCount,
		rows: visible,
		total,

		// 1-based and inclusive, for "Showing 26–50 of 312".
		from: total ? start + 1 : 0,
		to: Math.min( start + size, total ),
	};
}
