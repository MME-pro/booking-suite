/**
 * The full-width month grid.
 *
 * Still the shadcn Calendar (react-day-picker) underneath — it keeps the month
 * maths, keyboard navigation and selection semantics — but every class that
 * makes it a compact date picker is replaced: square cells become tall
 * planner-style boxes, and the built-in caption/nav give way to the screen's
 * own header.
 *
 * The classNames below REPLACE shadcn's rather than extending them (the
 * component spreads the caller's object last), so each one carries everything
 * that key needs — including the `group/day` hook the day cell's focus ring
 * depends on.
 */

import { useEffect, useRef } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

import { BookingChip } from '../BookingChip';
import { entriesForDay } from '../../data/occupancy';

/** Chips a cell shows before the rest collapse into a count. */
const MAX_CHIPS = 3;

/*
 * Every cell carries a right and bottom border; the panel around the grid
 * supplies the outer left and top edges, so the lines stay 1px rather than
 * doubling up where cells meet.
 *
 * The flex-1 chain (root → months → month → month_grid → weeks → week) is what
 * lets the six week rows share the grid's full height instead of collapsing to
 * their content. `weeks` is the tbody react-day-picker puts between the grid
 * and the rows; shadcn's own classNames leave it out, and skipping it here
 * would break the chain.
 */
const CLASS_NAMES = {
	root: 'flex w-full flex-1 flex-col',
	months: 'relative flex w-full flex-1 flex-col',
	month: 'flex w-full flex-1 flex-col',
	// The screen renders its own month header, but the label stays for
	// screen readers.
	month_caption: 'sr-only',
	nav: 'hidden',
	month_grid: 'flex w-full flex-1 flex-col',
	weekdays: 'flex w-full border-b bg-muted/50',
	weekday:
		'flex-1 select-none border-r px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0',
	weeks: 'flex w-full flex-1 flex-col',
	week: 'flex w-full flex-1',
	day: 'group/day relative flex-1 border-b border-r p-0 align-top last:border-r-0',
	outside: 'bg-muted/20',
	today: '',
	disabled: 'opacity-50',
	hidden: 'invisible',
};

export default function MonthGrid( {
	month,
	onMonthChange,
	selected,
	onSelect,
	occupancy,
	visibleIds,
	apartmentsById,
	locale,
} ) {
	const DayCell = ( { day, modifiers, className, children, ...props } ) => {
		const ref = useRef( null );

		useEffect( () => {
			if ( modifiers.focused ) {
				ref.current?.focus();
			}
		}, [ modifiers.focused ] );

		const entries = entriesForDay( occupancy, day.date, visibleIds );
		const shown = entries.slice( 0, MAX_CHIPS );
		const overflow = entries.length - shown.length;

		return (
			<button
				ref={ ref }
				type="button"
				data-selected={ modifiers.selected || undefined }
				className={ cn(
					'flex h-full min-h-[6rem] w-full flex-col items-stretch gap-1 p-2 text-left transition-colors md:min-h-[7.5rem]',
					'hover:bg-muted/40 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					'data-[selected=true]:bg-primary/5 data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-primary',
					className
				) }
				{ ...props }
			>
				<span className="flex items-center justify-between gap-1">
					<span
						className={ cn(
							'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
							modifiers.today &&
								'bg-primary text-primary-foreground',
							! modifiers.today &&
								! modifiers.outside &&
								'text-card-foreground',
							modifiers.outside &&
								! modifiers.today &&
								'text-muted-foreground'
						) }
					>
						{ day.date.getDate() }
					</span>

					{ entries.length > 0 && (
						<span className="text-[10px] font-medium tabular-nums text-muted-foreground">
							{ entries.length }
						</span>
					) }
				</span>

				{ /* Full chips where there is room; colour bars alone on phones. */ }
				<span className="hidden flex-col gap-0.5 sm:flex">
					{ shown.map( ( { booking, role } ) => (
						<BookingChip
							key={ `${ booking.id }-${ role }` }
							booking={ booking }
							role={ role }
							colour={
								apartmentsById.get( booking.apartmentId )
									?.colour ?? '#64748b'
							}
						/>
					) ) }

					{ overflow > 0 && (
						<span className="pl-1.5 text-[10px] font-medium text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of further bookings. */
								__( '+%d more', 'booking-suite' ),
								overflow
							) }
						</span>
					) }
				</span>

				<span className="flex flex-wrap gap-0.5 sm:hidden">
					{ entries.map( ( { booking, role } ) => (
						<span
							key={ `${ booking.id }-${ role }` }
							aria-hidden="true"
							className="h-1.5 w-1.5 rounded-full"
							style={ {
								backgroundColor:
									apartmentsById.get( booking.apartmentId )
										?.colour ?? '#64748b',
								opacity: 'pending' === booking.status ? 0.4 : 1,
							} }
						/>
					) ) }
				</span>

				{ entries.length > 0 && (
					<span className="sr-only">
						{ sprintf(
							/* translators: %d: number of bookings on this day. */
							_n(
								'%d booking',
								'%d bookings',
								entries.length,
								'booking-suite'
							),
							entries.length
						) }
					</span>
				) }
			</button>
		);
	};

	return (
		/*
		 * The grid claims the viewport height left under the WordPress chrome
		 * and this screen's own header, so the month reads as a full-screen
		 * planner rather than a widget sitting in a box.
		 */
		<div className="flex min-h-[36rem] flex-col lg:min-h-[calc(100vh-19rem)]">
			<Calendar
				mode="single"
				selected={ selected }
				onSelect={ ( date ) => date && onSelect( date ) }
				month={ month }
				onMonthChange={ onMonthChange }
				showOutsideDays
				/*
				 * Drives both the weekday abbreviations and which day the week
				 * starts on — German weeks open on Monday, English on Sunday.
				 */
				locale={ locale }
				className="flex w-full flex-1 bg-transparent p-0"
				classNames={ CLASS_NAMES }
				components={ { DayButton: DayCell } }
			/>
		</div>
	);
}
