/**
 * CalendarPage — the full-width calendar of the whole estate.
 *
 * Three views over the same bookings, the way a calendar application offers
 * them: a month of day cells, a week of hour columns, and one day split by
 * apartment. The month answers "how full is the season"; the week and day
 * answer "what happens at what time", which the month cannot — a chip in a box
 * has no top or bottom edge, so a 15:00 check-in and an 11:00 check-out are
 * text on it rather than a shape. The two time views draw the same stay as a
 * block on an hour ruler, clipped to the day it is being drawn in.
 *
 * Every month day cell lists the bookings that touch it. A booking's COLOUR is its
 * apartment's own colour (the same one shown on the apartments list) and the
 * chip's fill carries the booking status, so identity and state are two
 * separate channels. Picking a day lists that day's bookings in the table
 * underneath.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';

import { addDays, isSameDay, isSameMonth } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { ListPager } from '@/components/ListPager';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PAGE_SIZE, usePaged } from '@/hooks/usePaged';

import { BookingDetail } from '../Bookings/components/BookingDetail';

import { chipStyle } from './components/BookingChip';
import { DayBookingsTable } from './components/DayBookingsTable';
import { LockChip, isImported, lockStyle } from './components/LockChip';
import { MonthGrid } from './components/MonthGrid';
import { TimeGrid } from './components/TimeGrid';
import {
	ARRIVAL,
	DEPARTURE,
	blocksForDay,
	buildBlockDays,
	buildOccupancy,
	entriesForDay,
} from './data/occupancy';
import { daySegments, weekDays } from './data/segments';
import { apartmentService, blockService, bookingService } from '../../services';
import { dayKey } from '../../lib/dates';
import { settings } from '../../settings';

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

/*
 * react-day-picker takes a date-fns locale, which decides both the weekday
 * abbreviations and which day the week opens on — Monday for German, Sunday
 * for English. Intl handles the month and day headings separately, from the
 * same WordPress locale.
 */
const dateLocale = String( settings.locale || 'de_DE' ).startsWith( 'de' )
	? de
	: enUS;

const formatMonth = ( date ) =>
	new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		month: 'long',
		year: 'numeric',
	} ).format( date );

const formatSelectedDay = ( date ) =>
	new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	} ).format( date );

/**
 * The week's span as one label — "1.–7. September 2026".
 *
 * @param {Date} from The first day of the week.
 * @param {Date} to   The last day of the week.
 * @return {string} The label.
 */
const formatWeek = ( from, to ) => {
	const format = new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	} );

	// formatRange collapses the parts the two dates share, which is what makes
	// the label short; older engines without it get the long form instead.
	return format.formatRange
		? format.formatRange( from, to )
		: `${ format.format( from ) } – ${ format.format( to ) }`;
};

/**
 * A week column's heading — "Mon", "Di".
 *
 * @param {Date} date The day.
 * @return {string} The abbreviated weekday name.
 */
const formatWeekday = ( date ) =>
	new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		weekday: 'short',
	} ).format( date );

const MONTH = 'month';
const WEEK = 'week';
const DAY = 'day';

const VIEWS = [
	{ value: MONTH, label: __( 'Month', 'booking-suite' ) },
	{ value: WEEK, label: __( 'Week', 'booking-suite' ) },
	{ value: DAY, label: __( 'Day', 'booking-suite' ) },
];

/** Tailwind's `md`, and the same edge hooks/use-mobile.jsx calls a phone. */
const MOBILE_BREAKPOINT = 768;

/**
 * The phone-width media query, or null where there is no matchMedia to ask.
 *
 * @return {MediaQueryList|null} The query.
 */
const phoneQuery = () =>
	( 'undefined' !== typeof window &&
		window.matchMedia?.( `(max-width: ${ MOBILE_BREAKPOINT - 1 }px)` ) ) ||
	null;

/**
 * Which view the screen opens on.
 *
 * A month on a phone is forty-two cells across four inches: the chips fall
 * back to coloured dots, and nothing in them can be read without tapping a day
 * to find out what is in it. The day view is the one that survives that width —
 * one apartment per column, at real times — so a phone opens on it and a
 * desktop still opens on the month.
 *
 * Read synchronously as the initial state, so a phone paints the day view
 * straight away rather than rendering the month and visibly jumping. The
 * width is then WATCHED as well — see the effect in the component — because a
 * desktop window dragged narrow, a tablet turned sideways and a browser's
 * device-emulation toolbar all change the answer after this has run.
 *
 * @return {string} The view to start in.
 */
const initialView = () => ( phoneQuery()?.matches ? DAY : MONTH );

/*
 * The legend swatches need a real hex: chipStyle() tints by appending an alpha
 * channel, so a CSS variable would come back with no fill and the legend would
 * show nothing but its border. Slate stands in for "some apartment colour".
 */
const LEGEND_COLOUR = '#64748b';

const STATUS_LEGEND = [
	{ status: 'pending', label: __( 'Pending', 'booking-suite' ) },
	{ status: 'reserved', label: __( 'Reserved', 'booking-suite' ) },
	{ status: 'confirmed', label: __( 'Confirmed', 'booking-suite' ) },
	{ status: 'completed', label: __( 'Completed', 'booking-suite' ) },
	{ status: 'cancelled', label: __( 'Cancelled', 'booking-suite' ) },
];

export default function CalendarPage() {
	const [ apartments, setApartments ] = useState( [] );
	const [ bookings, setBookings ] = useState( [] );
	const [ blocks, setBlocks ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ selected, setSelected ] = useState( () => new Date() );
	const [ month, setMonth ] = useState( () => new Date() );

	/**
	 * Which view is on screen: the month, a week of hours, or one day.
	 *
	 * `selected` is the cursor for all three — the day the week is drawn
	 * around, the day the day view draws, and the day whose bookings are
	 * listed underneath. `month` only ever moves the month grid, and is kept
	 * in step whenever the cursor moves, so switching views never lands the
	 * operator somewhere they did not navigate to.
	 *
	 * Which one it starts in depends on the screen; see initialView().
	 */
	const [ view, setView ] = useState( initialView );

	/**
	 * Whether the operator has picked a view themselves.
	 *
	 * Until they do, the view belongs to the screen: a window dragged down to
	 * phone width switches to the day, and dragged back out returns to the
	 * month. The moment they touch the switcher it becomes theirs, and no
	 * amount of resizing takes it off them again — a rotation that silently
	 * threw away the week you had chosen would be its own bug.
	 */
	const chosen = useRef( false );

	useEffect( () => {
		const query = phoneQuery();

		if ( ! query ) {
			return undefined;
		}

		const apply = () => {
			if ( ! chosen.current ) {
				setView( query.matches ? DAY : MONTH );
			}
		};

		/*
		 * Once immediately as well as on change: the width can already have
		 * moved between the first render and this effect — which is exactly
		 * what a device-emulation toolbar does — and the initial state would
		 * then be answering a question about the wrong viewport.
		 */
		apply();

		query.addEventListener( 'change', apply );

		return () => query.removeEventListener( 'change', apply );
	}, [] );

	/**
	 * Which apartment the calendar is showing: an id, or 'all'.
	 *
	 * One choice rather than a row of on/off switches. The switches could
	 * express things this cannot — any two of five apartments, say — but that
	 * is not what the calendar is used for. What an operator actually does is
	 * look at the whole estate, or at one apartment; and with the switches,
	 * getting to "just this one" on a five-apartment property meant four
	 * separate clicks to turn the others off, and four more to undo it.
	 */
	const [ apartmentFilter, setApartmentFilter ] = useState( 'all' );

	/** The booking being read, shown over the calendar rather than away from it. */
	const [ selectedBooking, setSelectedBooking ] = useState( null );

	useEffect( () => {
		const controller = new AbortController();

		const load = async () => {
			try {
				/*
				 * Locks travel with the bookings because the calendar is only
				 * honest with both: a day closed by an Airbnb import looks
				 * identical to a free one otherwise, and the operator would
				 * take a booking for it.
				 */
				const [ apartmentList, bookingPayload, blockPayload ] =
					await Promise.all( [
						apartmentService.list( {}, controller.signal ),
						bookingService.list( {}, controller.signal ),
						blockService.list( {}, controller.signal ),
					] );

				setApartments( apartmentList );
				setBookings( bookingPayload.bookings );
				setBlocks( blockPayload.blocks );
				setError( null );
			} catch ( cause ) {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} finally {
				setLoading( false );
			}
		};

		load();

		return () => controller.abort();
	}, [] );

	/*
	 * The filter, in the shape everything downstream already reads: a Set of
	 * ids, or null for "do not filter at all". Deriving it here means the grid,
	 * the day table and the lock list cannot drift apart from the dropdown.
	 */
	const visibleIds = useMemo(
		() =>
			'all' === apartmentFilter
				? null
				: new Set( [ Number( apartmentFilter ) ] ),
		[ apartmentFilter ]
	);

	const selectedApartment =
		'all' === apartmentFilter
			? null
			: apartments.find(
					( item ) => item.id === Number( apartmentFilter )
			  ) ?? null;

	const apartmentsById = useMemo(
		() => new Map( apartments.map( ( item ) => [ item.id, item ] ) ),
		[ apartments ]
	);

	const occupancy = useMemo( () => buildOccupancy( bookings ), [ bookings ] );

	/*
	 * Portal locks only. A lock made by hand in the Availability screen is
	 * already on screen there, next to the button that releases it, and
	 * repeating it here filled the month with chips carrying nothing to act on.
	 * What the Calendar is for is the dates this site did NOT close itself —
	 * the ones Airbnb and Booking.com closed, which would otherwise be
	 * invisible until a guest tried to book them.
	 */
	const blockDays = useMemo(
		() => buildBlockDays( blocks.filter( isImported ) ),
		[ blocks ]
	);

	const dayEntries = useMemo(
		() => entriesForDay( occupancy, selected, visibleIds ),
		[ occupancy, selected, visibleIds ]
	);

	const dayLocks = useMemo(
		() => blocksForDay( blockDays, selected, visibleIds ),
		[ blockDays, selected, visibleIds ]
	);

	/*
	 * Usually short — a day holds as many bookings as the estate has
	 * apartments. But an hourly property sells the same apartment several times
	 * in a day, and the counts above the table are taken from the whole day
	 * either way, so what is on screen can be paged without the arrivals and
	 * departures tallies changing under it.
	 */
	const pagedEntries = usePaged( dayEntries, PAGE_SIZE, dayKey( selected ) );

	const counts = useMemo( () => {
		let arrivals = 0;
		let departures = 0;

		for ( const entry of dayEntries ) {
			if ( ARRIVAL === entry.role ) {
				arrivals++;
			} else if ( DEPARTURE === entry.role ) {
				departures++;
			}
		}

		return {
			arrivals,
			departures,
			inHouse: dayEntries.length - arrivals - departures,
		};
	}, [ dayEntries ] );

	/**
	 * Move the cursor and keep the month grid pointing at the same place.
	 *
	 * @param {Date} date The day to move to.
	 */
	const goTo = ( date ) => {
		setSelected( date );
		setMonth( date );
	};

	/**
	 * One step back or forward, in whatever unit the current view is made of.
	 *
	 * @param {number} delta -1 for back, 1 for forward.
	 */
	const shift = ( delta ) => {
		if ( MONTH === view ) {
			setMonth(
				( current ) =>
					new Date(
						current.getFullYear(),
						current.getMonth() + delta,
						1
					)
			);

			return;
		}

		goTo( addDays( selected, ( WEEK === view ? 7 : 1 ) * delta ) );
	};

	const goToToday = () => goTo( new Date() );

	/**
	 * Switching view keeps the day in view rather than the month.
	 *
	 * Paging three months forward and then asking for the week would otherwise
	 * jump back to whatever week `selected` was last left on, which is not
	 * where the operator is looking.
	 *
	 * @param {string} next The view being switched to.
	 */
	const changeView = ( next ) => {
		// From here on the view is the operator's, not the viewport's.
		chosen.current = true;

		// Leaving a month that was paged away from the cursor: take the first
		// of that month with us, so the week or day shown is one that was on
		// screen rather than one three months behind it.
		if ( MONTH === view && ! isSameMonth( month, selected ) ) {
			setSelected( new Date( month.getFullYear(), month.getMonth(), 1 ) );
		}

		setView( next );
	};

	/** The label over the navigation, in the unit the view is made of. */
	const week = useMemo(
		() => weekDays( selected, dateLocale ),
		[ selected ]
	);

	const heading = useMemo( () => {
		if ( MONTH === view ) {
			return formatMonth( month );
		}

		return WEEK === view
			? formatWeek( week[ 0 ], week[ 6 ] )
			: formatSelectedDay( selected );
	}, [ view, month, week, selected ] );

	/*
	 * The week's seven columns. Each is a day: its own segments, clipped to it,
	 * and the portal locks sitting over it.
	 */
	const weekColumns = useMemo( () => {
		if ( WEEK !== view ) {
			return [];
		}

		const today = new Date();

		return week.map( ( date ) => ( {
			key: dayKey( date ),
			date,
			title: formatWeekday( date ),
			subtitle: String( date.getDate() ),
			isToday: isSameDay( date, today ),
			isSelected: isSameDay( date, selected ),
			segments: daySegments( bookings, date, visibleIds ),
			locks: blocksForDay( blockDays, date, visibleIds ),
		} ) );
	}, [ view, week, selected, bookings, visibleIds, blockDays ] );

	/*
	 * The day view splits one day by APARTMENT rather than showing a single
	 * column of everything. On a day with four apartments occupied, one column
	 * would be four blocks squeezed side by side with nothing saying which is
	 * which; a column each puts every apartment's day under its own name, in
	 * its own colour, which is what the operator is actually comparing.
	 */
	const dayColumns = useMemo( () => {
		if ( DAY !== view ) {
			return [];
		}

		const shown = selectedApartment ? [ selectedApartment ] : apartments;

		// Before any apartment exists there is still a day to draw, and it
		// should not be a blank strip.
		if ( 0 === shown.length ) {
			return [
				{
					key: 'estate',
					date: selected,
					title: __( 'All apartments', 'booking-suite' ),
					segments: daySegments( bookings, selected, visibleIds ),
					locks: blocksForDay( blockDays, selected, visibleIds ),
				},
			];
		}

		return shown.map( ( apartment ) => {
			const only = new Set( [ apartment.id ] );

			return {
				key: `apartment-${ apartment.id }`,
				date: selected,
				title: apartment.name,
				colour: apartment.colour,
				segments: daySegments( bookings, selected, only ),
				// An estate-wide lock closes this apartment too, so
				// blocksForDay keeps it whatever the filter says.
				locks: blocksForDay( blockDays, selected, only ),
			};
		} );
	}, [
		view,
		selected,
		apartments,
		selectedApartment,
		bookings,
		visibleIds,
		blockDays,
	] );

	if ( isLoading ) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-full max-w-md" />
				<Skeleton className="h-[560px] w-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not load the calendar', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			{ /*
			 * The whole calendar is one panel: its own navigation, view
			 * switcher and apartment filter across the top, then whichever
			 * grid the view asks for. The date picker's built-in caption and
			 * arrows are hidden in MonthGrid in favour of this.
			 */ }
			<Card className="overflow-hidden">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
					<div className="flex flex-wrap items-center gap-2">
						{ /* One step in whatever the view is made of: a
						   month, a week, or a day. */ }
						<Button
							variant="outline"
							size="sm"
							onClick={ () => shift( -1 ) }
						>
							<ChevronLeft className="h-4 w-4" />
							{ __( 'Back', 'booking-suite' ) }
						</Button>

						<h2 className="px-2 text-lg font-semibold tracking-tight text-card-foreground">
							{ heading }
						</h2>

						<Button
							variant="outline"
							size="sm"
							onClick={ () => shift( 1 ) }
						>
							{ __( 'Next', 'booking-suite' ) }
							<ChevronRight className="h-4 w-4" />
						</Button>

						<Button
							variant="outline"
							size="sm"
							onClick={ goToToday }
						>
							{ __( 'Today', 'booking-suite' ) }
						</Button>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{ /*
						 * Month · Week · Day, in that order — widest span
						 * first, the way every calendar application arranges
						 * them, so the control is already familiar.
						 */ }
						<ToggleGroup
							type="single"
							value={ view }
							onValueChange={ ( next ) =>
								next && changeView( next )
							}
							variant="outline"
							size="sm"
							aria-label={ __(
								'Calendar view',
								'booking-suite'
							) }
							className="gap-0 [&>*:not(:first-child)]:-ml-px [&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none [&>*:not(:first-child):not(:last-child)]:rounded-none"
						>
							{ VIEWS.map( ( option ) => (
								<ToggleGroupItem
									key={ option.value }
									value={ option.value }
									className="px-3"
								>
									{ option.label }
								</ToggleGroupItem>
							) ) }
						</ToggleGroup>

						{ /*
						 * The apartment filter. The swatch travels with the name
						 * into the closed trigger, so the colour the chips in the
						 * grid are drawn in is named right where the choice is
						 * made — the legend the apartment toggle row used to be, folded into
						 * the control that replaced it.
						 */ }
						<Select
							value={ apartmentFilter }
							onValueChange={ setApartmentFilter }
						>
							<SelectTrigger
								className="w-full sm:w-64"
								aria-label={ __(
									'Show one apartment',
									'booking-suite'
								) }
							>
								<SelectValue>
									<span className="flex min-w-0 items-center gap-2">
										{ selectedApartment && (
											<span
												aria-hidden="true"
												className="h-3 w-3 shrink-0 rounded-sm"
												style={ {
													backgroundColor:
														selectedApartment.colour,
												} }
											/>
										) }
										<span className="truncate">
											{ selectedApartment
												? selectedApartment.name
												: __(
														'All apartments',
														'booking-suite'
												  ) }
										</span>
									</span>
								</SelectValue>
							</SelectTrigger>

							<SelectContent>
								<SelectItem value="all">
									{ __( 'All apartments', 'booking-suite' ) }
								</SelectItem>

								{ apartments.map( ( apartment ) => (
									<SelectItem
										key={ apartment.id }
										value={ String( apartment.id ) }
									>
										<span className="flex items-center gap-2">
											<span
												aria-hidden="true"
												className="h-3 w-3 shrink-0 rounded-sm"
												style={ {
													backgroundColor:
														apartment.colour,
												} }
											/>
											{ apartment.name }
										</span>
									</SelectItem>
								) ) }
							</SelectContent>
						</Select>
					</div>
				</div>

				{ MONTH === view && (
					<MonthGrid
						month={ month }
						onMonthChange={ setMonth }
						selected={ selected }
						onSelect={ setSelected }
						occupancy={ occupancy }
						blockDays={ blockDays }
						visibleIds={ visibleIds }
						apartmentsById={ apartmentsById }
						locale={ dateLocale }
						onSelectBooking={ setSelectedBooking }
					/>
				) }

				{ /*
				 * Both time views are the same grid with different columns —
				 * seven days, or one day split by apartment. Clicking a week's
				 * column heading moves the cursor to that day, which is what
				 * fills the list underneath.
				 */ }
				{ WEEK === view && (
					<TimeGrid
						columns={ weekColumns }
						anchor={ selected }
						apartmentsById={ apartmentsById }
						onSelectBooking={ setSelectedBooking }
						onSelectDay={ goTo }
					/>
				) }

				{ DAY === view && (
					<TimeGrid
						columns={ dayColumns }
						anchor={ selected }
						apartmentsById={ apartmentsById }
						onSelectBooking={ setSelectedBooking }
					/>
				) }
			</Card>

			{ /* Status treatment, kept out of the panel so it stays quiet. */ }
			<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
				{ STATUS_LEGEND.map( ( { status, label } ) => (
					<li
						key={ status }
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
					>
						<span
							aria-hidden="true"
							className="h-3 w-5 rounded-sm"
							style={ chipStyle( status, LEGEND_COLOUR ) }
						/>
						{ label }
					</li>
				) ) }

				{ /*
				 * The hatch, explained. A portal lock is the one thing in a
				 * cell that is not a booking, so the legend has to name the
				 * treatment or a striped chip just looks like a booking that
				 * rendered oddly.
				 */ }
				<li className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span
						aria-hidden="true"
						className="h-3 w-5 rounded-sm"
						style={ lockStyle( LEGEND_COLOUR ) }
					/>
					{ __(
						'Blocked by a portal (Airbnb, Booking.com)',
						'booking-suite'
					) }
				</li>

				{ /* The wash on a day cell, explained. */ }
				<li className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span
						aria-hidden="true"
						className="h-3 w-5 rounded-sm bg-amber-100 dark:bg-amber-950/50"
					/>
					{ __( 'Hesse public holiday', 'booking-suite' ) }
				</li>
			</ul>

			<Card>
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
					<div className="flex flex-col gap-0.5">
						<h3 className="text-base font-semibold text-card-foreground">
							{ formatSelectedDay( selected ) }
						</h3>
						<p className="text-sm text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of bookings on the selected day. */
								_n(
									'%d booking on this day',
									'%d bookings on this day',
									dayEntries.length,
									'booking-suite'
								),
								dayEntries.length
							) }
						</p>
					</div>

					{ dayEntries.length > 0 && (
						<div className="flex flex-wrap gap-2">
							<Badge
								variant="secondary"
								className="bg-success/10 text-success hover:bg-success/10"
							>
								{ sprintf(
									/* translators: %d: number of arrivals. */
									__( '%d arriving', 'booking-suite' ),
									counts.arrivals
								) }
							</Badge>
							<Badge variant="secondary">
								{ sprintf(
									/* translators: %d: number of guests in house. */
									__( '%d in house', 'booking-suite' ),
									counts.inHouse
								) }
							</Badge>
							<Badge
								variant="secondary"
								className="bg-warning/10 text-warning hover:bg-warning/10"
							>
								{ sprintf(
									/* translators: %d: number of departures. */
									__( '%d departing', 'booking-suite' ),
									counts.departures
								) }
							</Badge>
						</div>
					) }
				</div>

				<CardContent className="p-0">
					{ /*
					 * Portal locks head the day, above the bookings table. A
					 * date another channel has sold is sold whether or not
					 * anything is booked here, and burying that under an empty
					 * table — or worse, under "Nothing booked" — is how an
					 * operator ends up selling a date Airbnb already sold.
					 */ }
					{ dayLocks.length > 0 && (
						<div className="flex flex-col gap-2 border-b bg-muted/30 px-5 py-4">
							<h4 className="text-sm font-semibold text-card-foreground">
								{ sprintf(
									/* translators: %d: number of apartments blocked by a portal. */
									_n(
										'%d apartment blocked by a portal',
										'%d apartments blocked by a portal',
										dayLocks.length,
										'booking-suite'
									),
									dayLocks.length
								) }
							</h4>

							<div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
								{ dayLocks.map( ( block ) => (
									<LockChip
										key={ block.id }
										block={ block }
										colour={
											block.isMaster
												? LEGEND_COLOUR
												: apartmentsById.get(
														block.apartmentId
												  )?.colour ?? LEGEND_COLOUR
										}
									/>
								) ) }
							</div>
						</div>
					) }

					{ dayEntries.length > 0 ? (
						<>
							<DayBookingsTable
								entries={ pagedEntries.rows }
								apartmentsById={ apartmentsById }
								onSelectBooking={ setSelectedBooking }
							/>

							<div className="px-5 pb-1">
								<ListPager
									page={ pagedEntries.page }
									pageCount={ pagedEntries.pageCount }
									onPage={ pagedEntries.setPage }
									from={ pagedEntries.from }
									to={ pagedEntries.to }
									total={ pagedEntries.total }
								/>
							</div>
						</>
					) : (
						<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<CalendarDays className="h-6 w-6" />
							</span>
							<h4 className="text-base font-semibold text-card-foreground">
								{ __( 'Nothing booked', 'booking-suite' ) }
							</h4>
							<p className="max-w-sm text-sm text-muted-foreground">
								{ dayLocks.length > 0
									? __(
											'Nothing booked here — but a portal has the apartments above, so this date is not free.',
											'booking-suite'
									  )
									: __(
											'No booking touches this date for the apartments currently shown.',
											'booking-suite'
									  ) }
							</p>
						</div>
					) }
				</CardContent>
			</Card>

			{ /*
			 * The booking opens over the calendar rather than navigating to the
			 * Bookings screen, so the month and the selected day are still
			 * there when it closes. Status changes made in here are merged back
			 * into the list the grid is drawn from.
			 */ }
			<Dialog
				open={ null !== selectedBooking }
				onOpenChange={ ( open ) =>
					! open && setSelectedBooking( null )
				}
			>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>
							{ __( 'Booking', 'booking-suite' ) }
						</DialogTitle>
					</DialogHeader>

					{ selectedBooking && (
						<BookingDetail
							booking={ selectedBooking }
							onUpdated={ ( updated ) => {
								setBookings( ( current ) =>
									current.map( ( item ) =>
										item.id === updated.id
											? { ...item, ...updated }
											: item
									)
								);
								setSelectedBooking( ( current ) =>
									current
										? { ...current, ...updated }
										: current
								);
							} }
						/>
					) }
				</DialogContent>
			</Dialog>
		</div>
	);
}
