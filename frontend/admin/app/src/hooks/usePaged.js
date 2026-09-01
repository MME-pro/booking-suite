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

/**
 * How many rows a page holds.
 *
 * Ten rather than twenty-five, because these lists are read on a phone as often
 * as at a desk: the cards each row becomes below `lg` are tall, and
 * twenty-five of them is a screen and a half of scrolling before the pager is
 * even reachable.
 */
export const PAGE_SIZE = 10;

/**
 * @param {Array}         rows       The full, already-filtered list.
 * @param {number}        [size]     Rows per page.
 * @param {string|number} [resetKey] Changing this returns to page one. For a
 *                                   list that swaps its contents wholesale
 *                                   rather than filtering them down — the
 *                                   calendar's day list, when the day changes —
 *                                   where the snap-back below cannot help
 *                                   because the list did not get shorter.
 * @return {Object} `{ page, setPage, pageCount, rows, from, to, total }`.
 */
export function usePaged( rows, size = PAGE_SIZE, resetKey = null ) {
	const [ page, setPage ] = useState( 1 );

	const total = rows.length;
	const pageCount = Math.max( 1, Math.ceil( total / size ) );

	// Snap back when the list shrinks under us.
	useEffect( () => {
		setPage( ( current ) => Math.min( current, pageCount ) );
	}, [ pageCount ] );

	useEffect( () => {
		if ( null !== resetKey ) {
			setPage( 1 );
		}
	}, [ resetKey ] );

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
