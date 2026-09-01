/**
 * The hour grid behind the week and day views.
 *
 * One component for both, because they differ only in what a column IS: the
 * week gives each column a day, the day view gives each column an apartment.
 * Everything else — the hour rulers, the "now" line, how a block is placed and
 * how overlapping blocks share the width — is the same question either way, and
 * writing it twice is how the two views would drift apart.
 *
 * A block is positioned from minutes past local midnight, which is what
 * data/segments.js hands over. That is the whole point of these views over the
 * month grid: a stay stops being a chip in a box and becomes something with a
 * top edge at check-in and a bottom edge at check-out, so 15:00 and 11:00 are
 * things the operator can see rather than read.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { chipStyle } from '../BookingChip';
import { LockChip } from '../LockChip';
import { nowMinutes } from '../../data/segments';
import { useHolidays } from '../../../../hooks/useHolidays';
import { dayKey, formatClock, formatTime } from '../../../../lib/dates';
import { formatMoney } from '../../../Bookings/data/format';

/** Pixels per hour. Tall enough that a one-hour booking is a real target. */
const HOUR_HEIGHT = 52;

/** Below this, a block has room for its time and nothing else. */
const COMPACT_HEIGHT = 40;

/** The hour the grid opens on, so it does not start on an empty night. */
const OPENING_HOUR = 7;

const HOURS = Array.from( { length: 24 }, ( _, hour ) => hour );

/** Stands in wherever an apartment has no colour of its own. */
const FALLBACK_COLOUR = '#64748b';

/**
 * Where a block sits in its column.
 *
 * Overlapping blocks share the width in lanes; a gap on the right of each keeps
 * two neighbours from reading as one wide block.
 *
 * @param {Object} segment A positioned segment from data/segments.js.
 * @return {Object} Inline geometry.
 */
const placement = ( segment ) => {
	const lanes = Math.max( 1, segment.lanes || 1 );
	const width = 100 / lanes;

	return {
		top: `${ ( segment.startMinutes / 60 ) * HOUR_HEIGHT }px`,
		height: `${
			( ( segment.endMinutes - segment.startMinutes ) / 60 ) * HOUR_HEIGHT
		}px`,
		left: `${ ( segment.lane || 0 ) * width }%`,
		width: `calc(${ width }% - 3px)`,
	};
};

/**
 * What the block says about its own edges.
 *
 * A stay clipped to this day may start here, end here, both, or neither, and
 * the label has to say which — a bare "11:00" on a block that only ends today
 * would read as a check-in. The arrows are the same two the month chips use.
 *
 * @param {Object} segment A positioned segment.
 * @return {string} The time label.
 */
const edges = ( segment ) => {
	const { booking, startsHere, endsHere } = segment;

	if ( startsHere && endsHere ) {
		return `${ formatTime( booking.startsAt ) } – ${ formatTime(
			booking.endsAt
		) }`;
	}

	if ( startsHere ) {
		return `→ ${ formatTime( booking.startsAt ) }`;
	}

	if ( endsHere ) {
		return `← ${ formatTime( booking.endsAt ) }`;
	}

	// In residence for the whole of this day, arriving and leaving on others.
	return __( 'All day', 'booking-suite' );
};

/**
 * One booking, as a block on the grid.
 *
 * @param {Object}        props          Component props.
 * @param {Object}        props.segment  A positioned segment.
 * @param {string}        props.colour   The apartment's colour.
 * @param {Function|null} props.onSelect Opens the booking, when it can be.
 * @return {JSX.Element} The block.
 */
function TimeBlock( { segment, colour, onSelect } ) {
	const { booking } = segment;
	const geometry = placement( segment );
	const compact =
		( segment.endMinutes - segment.startMinutes ) / 60 <
		COMPACT_HEIGHT / HOUR_HEIGHT;

	return (
		<button
			type="button"
			onClick={ onSelect ? () => onSelect( booking ) : undefined }
			disabled={ ! onSelect }
			title={ `${ edges( segment ) } · ${
				booking.customerName || __( 'Guest', 'booking-suite' )
			} · ${ booking.apartmentName }` }
			style={ { ...geometry, ...chipStyle( booking.status, colour ) } }
			className={ cn(
				'absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-left text-[11px] leading-tight text-card-foreground',
				'ring-1 ring-inset ring-card/60',
				onSelect &&
					'cursor-pointer transition-shadow hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
			) }
		>
			<span className="flex items-baseline gap-1 truncate font-medium tabular-nums">
				{ edges( segment ) }
			</span>

			{ ! compact && (
				<>
					<span className="block truncate font-medium">
						{ booking.customerName ||
							__( 'Guest', 'booking-suite' ) }
					</span>
					<span className="block truncate text-[10px] text-muted-foreground">
						{ booking.apartmentName }
						{ segment.startsHere &&
							` · ${ formatMoney(
								booking.total,
								booking.currency
							) }` }
					</span>
				</>
			) }
		</button>
	);
}

export default function TimeGrid( {
	/**
	 * The columns to draw, left to right. Each carries its own day (the week
	 * view varies it, the day view repeats it), the segments to place in it,
	 * and the locks that belong above it.
	 */
	columns,
	/** Any day inside the range on screen; drives the holiday lookup. */
	anchor,
	apartmentsById,
	onSelectBooking = null,
	/** Week view uses this to make a column heading select its day. */
	onSelectDay = null,
} ) {
	const bodyRef = useRef( null );
	const holidays = useHolidays( anchor );

	/*
	 * The now line has to move on its own: an operator leaves this screen open
	 * all morning, and a line frozen at whenever the page loaded is worse than
	 * no line, because it is quietly wrong rather than obviously absent.
	 */
	const [ now, setNow ] = useState( () => new Date() );

	useEffect( () => {
		const timer = setInterval( () => setNow( new Date() ), 60000 );

		return () => clearInterval( timer );
	}, [] );

	/*
	 * Open on the working day rather than at midnight — and on the now line
	 * when today is on screen, which is the row the operator came to look at.
	 * Layout effect so the jump happens before paint instead of as a visible
	 * scroll after it.
	 */
	const focusMinutes = useMemo( () => {
		for ( const column of columns ) {
			const minutes = nowMinutes( column.date, now );

			if ( null !== minutes ) {
				return minutes;
			}
		}

		return OPENING_HOUR * 60;

		// Deliberately not re-running as `now` ticks: it decides the opening
		// scroll position, and re-scrolling every minute would fight the
		// operator for the scrollbar.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ columns ] );

	useLayoutEffect( () => {
		const body = bodyRef.current;

		if ( ! body ) {
			return;
		}

		// An hour of context above whatever is being focused.
		body.scrollTop = Math.max( 0, ( focusMinutes / 60 - 1 ) * HOUR_HEIGHT );
	}, [ focusMinutes ] );

	const hasLocks = columns.some( ( column ) => column.locks?.length > 0 );

	/*
	 * Wide enough that seven columns stay readable, and horizontally
	 * scrollable below that. Squeezing a week into a phone's width would make
	 * every block too narrow to carry a name.
	 */
	const minWidth = `${ Math.max( 20, columns.length * 7.5 ) }rem`;

	return (
		<div className="overflow-x-auto">
			<div className="flex flex-col" style={ { minWidth } }>
				{ /* Column headings: a day in the week view, an apartment in
				   the day view. */ }
				<div className="flex border-b bg-muted/50">
					<div className="w-14 shrink-0 border-r" />

					{ columns.map( ( column ) => {
						const holiday = holidays[ dayKey( column.date ) ];

						const heading = (
							<>
								<span className="flex items-center justify-center gap-1.5 truncate">
									{ column.colour && (
										<span
											aria-hidden="true"
											className="h-2.5 w-2.5 shrink-0 rounded-sm"
											style={ {
												backgroundColor: column.colour,
											} }
										/>
									) }
									<span
										className={ cn(
											'truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
											column.isToday && 'text-primary'
										) }
									>
										{ column.title }
									</span>
								</span>

								{ column.subtitle && (
									<span
										className={ cn(
											'mx-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums text-card-foreground',
											column.isToday &&
												'bg-primary text-primary-foreground'
										) }
									>
										{ column.subtitle }
									</span>
								) }

								{ /* Named, not just marked — the same reason
								   the month cells name it: a holiday is why a
								   day is priced at the weekend rate. */ }
								{ holiday && (
									<span
										title={ holiday }
										className="block truncate text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500"
									>
										{ holiday }
									</span>
								) }
							</>
						);

						return (
							<div
								key={ column.key }
								className={ cn(
									'min-w-0 flex-1 border-r last:border-r-0',
									holiday &&
										'bg-amber-50 dark:bg-amber-950/20',
									column.isSelected && 'bg-primary/5'
								) }
							>
								{ onSelectDay ? (
									<button
										type="button"
										onClick={ () =>
											onSelectDay( column.date )
										}
										className="flex w-full flex-col gap-0.5 px-1 py-2 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									>
										{ heading }
									</button>
								) : (
									<div className="flex flex-col gap-0.5 px-1 py-2 text-center">
										{ heading }
									</div>
								) }
							</div>
						);
					} ) }
				</div>

				{ /*
				 * Locks sit above the hours rather than in them. A portal lock
				 * is a property of the whole day — Airbnb sold the date, not
				 * the hours between 14:00 and 16:00 — so drawing it as a block
				 * on the ruler would invent a precision it does not have.
				 */ }
				{ hasLocks && (
					<div className="flex border-b bg-muted/30">
						<div className="flex w-14 shrink-0 items-center justify-end border-r px-1.5 py-1 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							{ __( 'All day', 'booking-suite' ) }
						</div>

						{ columns.map( ( column ) => (
							<div
								key={ column.key }
								className="flex min-w-0 flex-1 flex-col gap-0.5 border-r p-1 last:border-r-0"
							>
								{ ( column.locks ?? [] ).map( ( block ) => (
									<LockChip
										key={ `lock-${ block.id }` }
										block={ block }
										colour={
											block.isMaster
												? FALLBACK_COLOUR
												: apartmentsById.get(
														block.apartmentId
												  )?.colour ?? FALLBACK_COLOUR
										}
									/>
								) ) }
							</div>
						) ) }
					</div>
				) }

				{ /* The hours themselves, the one part that scrolls. */ }
				<div
					ref={ bodyRef }
					className="relative max-h-[calc(100vh-26rem)] min-h-[26rem] overflow-y-auto"
				>
					<div
						className="flex"
						style={ { height: `${ 24 * HOUR_HEIGHT }px` } }
					>
						{ /* The ruler. Labels hang above their own line, so
						   the number sits beside the hour it names. */ }
						<div className="relative w-14 shrink-0 border-r">
							{ HOURS.map( ( hour ) => (
								<span
									key={ hour }
									className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
									style={ {
										top: `${ hour * HOUR_HEIGHT }px`,
									} }
								>
									{ 0 === hour
										? ''
										: `${ String( hour ).padStart(
												2,
												'0'
										  ) }:00` }
								</span>
							) ) }
						</div>

						{ columns.map( ( column ) => {
							const line = nowMinutes( column.date, now );
							const holiday = holidays[ dayKey( column.date ) ];

							return (
								<div
									key={ column.key }
									className={ cn(
										'relative min-w-0 flex-1 border-r last:border-r-0',
										holiday &&
											'bg-amber-50/60 dark:bg-amber-950/10',
										column.isSelected && 'bg-primary/5'
									) }
								>
									{ /* Hour rules, and a lighter half-hour
									   rule so a 30-minute block has something
									   to line up against. */ }
									{ HOURS.map( ( hour ) => (
										<div key={ hour }>
											<div
												className="absolute inset-x-0 border-t border-border/70"
												style={ {
													top: `${
														hour * HOUR_HEIGHT
													}px`,
												} }
											/>
											<div
												className="absolute inset-x-0 border-t border-dashed border-border/30"
												style={ {
													top: `${
														( hour + 0.5 ) *
														HOUR_HEIGHT
													}px`,
												} }
											/>
										</div>
									) ) }

									{ ( column.segments ?? [] ).map(
										( segment ) => (
											<TimeBlock
												key={ `${ segment.booking.id }-${ segment.startMinutes }` }
												segment={ segment }
												colour={
													apartmentsById.get(
														segment.booking
															.apartmentId
													)?.colour ?? FALLBACK_COLOUR
												}
												onSelect={ onSelectBooking }
											/>
										)
									) }

									{ /* Now. Drawn last so it lies over the
									   blocks rather than under them. */ }
									{ null !== line && (
										<div
											className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
											style={ {
												top: `${
													( line / 60 ) * HOUR_HEIGHT
												}px`,
											} }
											aria-hidden="true"
										>
											<span className="h-2 w-2 shrink-0 -translate-x-1/2 rounded-full bg-destructive" />
											<span className="h-px w-full bg-destructive" />
										</div>
									) }
								</div>
							);
						} ) }
					</div>

					{ /* The clock reading of the now line. It lives in the
					   gutter rather than on the line itself, where it would
					   sit on top of whatever booking is running now. */ }
					{ columns.some(
						( column ) => null !== nowMinutes( column.date, now )
					) && (
						<span
							className="pointer-events-none absolute left-0 z-20 w-14 -translate-y-1/2 pr-1.5 text-right text-[10px] font-semibold tabular-nums text-destructive"
							style={ {
								top: `${
									( ( now.getHours() * 60 +
										now.getMinutes() ) /
										60 ) *
									HOUR_HEIGHT
								}px`,
							} }
						>
							{ formatClock( now ) }
						</span>
					) }
				</div>
			</div>
		</div>
	);
}
