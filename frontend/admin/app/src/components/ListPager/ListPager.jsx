/**
 * ListPager — the control under a long list.
 *
 * Draws nothing at all for a list that fits on one page, so a property with
 * three apartments never sees it and a season's worth of bookings does.
 *
 * Page numbers are windowed rather than listed: at forty pages the strip would
 * be longer than the table it belongs to, and the numbers either side of where
 * you are is what anyone actually reaches for.
 */

import { __, sprintf } from '@wordpress/i18n';

import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';

/**
 * The page numbers to draw: the first, the last, and a window around the
 * current one, with gaps marked.
 *
 * @param {number} page  The current page.
 * @param {number} count How many there are.
 * @return {Array} Page numbers, with 'gap' where a run was elided.
 */
const window_ = ( page, count ) => {
	if ( count <= 7 ) {
		return Array.from( { length: count }, ( _, i ) => i + 1 );
	}

	const near = [ page - 1, page, page + 1 ].filter(
		( n ) => n > 1 && n < count
	);

	const out = [ 1 ];

	if ( near[ 0 ] > 2 ) {
		out.push( 'gap-start' );
	}

	out.push( ...near );

	if ( near[ near.length - 1 ] < count - 1 ) {
		out.push( 'gap-end' );
	}

	out.push( count );

	return out;
};

/**
 * @param {Object}   props
 * @param {number}   props.page      Current page, 1-based.
 * @param {number}   props.pageCount How many pages there are.
 * @param {Function} props.onPage    Called with the page to go to.
 * @param {number}   props.from      First row shown, 1-based.
 * @param {number}   props.to        Last row shown.
 * @param {number}   props.total     Rows in the whole list.
 * @return {JSX.Element|null} The pager, or nothing when it all fits.
 */
export default function ListPager( {
	page,
	pageCount,
	onPage,
	from,
	to,
	total,
} ) {
	if ( pageCount <= 1 ) {
		return null;
	}

	const go = ( event, next ) => {
		// The shadcn control is an anchor, so the jump has to be stopped.
		event.preventDefault();
		onPage( Math.max( 1, Math.min( pageCount, next ) ) );
	};

	return (
		<div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
			<p className="text-sm text-muted-foreground">
				{ sprintf(
					/* translators: 1: first row shown, 2: last row shown, 3: rows in total. */
					__( 'Showing %1$d–%2$d of %3$d', 'booking-suite' ),
					from,
					to,
					total
				) }
			</p>

			<Pagination className="mx-0 w-auto justify-end">
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							href="#"
							aria-disabled={ page === 1 }
							className={
								page === 1
									? 'pointer-events-none opacity-50'
									: undefined
							}
							onClick={ ( event ) => go( event, page - 1 ) }
						/>
					</PaginationItem>

					{ window_( page, pageCount ).map( ( entry ) => (
						<PaginationItem key={ entry }>
							{ 'number' === typeof entry ? (
								<PaginationLink
									href="#"
									isActive={ entry === page }
									onClick={ ( event ) => go( event, entry ) }
								>
									{ entry }
								</PaginationLink>
							) : (
								<PaginationEllipsis />
							) }
						</PaginationItem>
					) ) }

					<PaginationItem>
						<PaginationNext
							href="#"
							aria-disabled={ page === pageCount }
							className={
								page === pageCount
									? 'pointer-events-none opacity-50'
									: undefined
							}
							onClick={ ( event ) => go( event, page + 1 ) }
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}
