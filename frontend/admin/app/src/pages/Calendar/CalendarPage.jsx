/**
 * CalendarPage — the full-width month view of the whole estate.
 *
 * Every day cell lists the bookings that touch it. A booking's COLOUR is its
 * apartment's own colour (the same one shown on the apartments list) and the
 * chip's fill carries the booking status, so identity and state are two
 * separate channels. Picking a day lists that day's bookings in the table
 * underneath.
 */

import { useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { BookingDetail } from '../Bookings/components/BookingDetail';

import { chipStyle } from './components/BookingChip';
import { DayBookingsTable } from './components/DayBookingsTable';
import { MonthGrid } from './components/MonthGrid';
import {
	ARRIVAL,
	DEPARTURE,
	buildOccupancy,
	entriesForDay,
} from './data/occupancy';
import { apartmentService, bookingService } from '../../services';
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
];

export default function CalendarPage() {
	const [ apartments, setApartments ] = useState( [] );
	const [ bookings, setBookings ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ selected, setSelected ] = useState( () => new Date() );
	const [ month, setMonth ] = useState( () => new Date() );

	/** Apartment ids to show; null until the list loads, meaning "all". */
	const [ visibleIds, setVisibleIds ] = useState( null );

	/** The booking being read, shown over the calendar rather than away from it. */
	const [ selectedBooking, setSelectedBooking ] = useState( null );

	useEffect( () => {
		const controller = new AbortController();

		const load = async () => {
			try {
				const [ apartmentList, bookingPayload ] = await Promise.all( [
					apartmentService.list( {}, controller.signal ),
					bookingService.list( {}, controller.signal ),
				] );

				setApartments( apartmentList );
				setBookings( bookingPayload.bookings );
				setVisibleIds(
					new Set( apartmentList.map( ( item ) => item.id ) )
				);
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

	const apartmentsById = useMemo(
		() => new Map( apartments.map( ( item ) => [ item.id, item ] ) ),
		[ apartments ]
	);

	const occupancy = useMemo( () => buildOccupancy( bookings ), [ bookings ] );

	const dayEntries = useMemo(
		() => entriesForDay( occupancy, selected, visibleIds ),
		[ occupancy, selected, visibleIds ]
	);

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

	const shiftMonth = ( delta ) =>
		setMonth(
			( current ) =>
				new Date( current.getFullYear(), current.getMonth() + delta, 1 )
		);

	const goToToday = () => {
		const today = new Date();

		setSelected( today );
		setMonth( today );
	};

	const toggleApartment = ( id ) =>
		setVisibleIds( ( current ) => {
			const next = new Set( current );

			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}

			return next;
		} );

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
			 * The whole calendar is one panel: its own month nav and apartment
			 * legend across the top, then the grid. The date picker's built-in
			 * caption and arrows are hidden in MonthGrid in favour of this.
			 */ }
			<Card className="overflow-hidden">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={ () => shiftMonth( -1 ) }
						>
							<ChevronLeft className="h-4 w-4" />
							{ __( 'Back', 'booking-suite' ) }
						</Button>

						<h2 className="px-2 text-lg font-semibold tracking-tight text-card-foreground">
							{ formatMonth( month ) }
						</h2>

						<Button
							variant="outline"
							size="sm"
							onClick={ () => shiftMonth( 1 ) }
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

					{ /* Apartment colours, doubling as show/hide filters. */ }
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						{ apartments.map( ( apartment ) => {
							const isOn =
								! visibleIds || visibleIds.has( apartment.id );

							return (
								<button
									key={ apartment.id }
									type="button"
									onClick={ () =>
										toggleApartment( apartment.id )
									}
									aria-pressed={ isOn }
									className={ cn(
										'flex items-center gap-2 text-xs font-medium transition-opacity',
										isOn
											? 'text-card-foreground'
											: 'text-muted-foreground line-through opacity-60'
									) }
								>
									<span
										aria-hidden="true"
										className="h-3 w-3 rounded-sm"
										style={ {
											backgroundColor: apartment.colour,
											opacity: isOn ? 1 : 0.35,
										} }
									/>
									{ apartment.name }
								</button>
							);
						} ) }
					</div>
				</div>

				<MonthGrid
					month={ month }
					onMonthChange={ setMonth }
					selected={ selected }
					onSelect={ setSelected }
					occupancy={ occupancy }
					visibleIds={ visibleIds }
					apartmentsById={ apartmentsById }
					locale={ dateLocale }
					onSelectBooking={ setSelectedBooking }
				/>
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
					{ dayEntries.length > 0 ? (
						<DayBookingsTable
							entries={ dayEntries }
							apartmentsById={ apartmentsById }
							onSelectBooking={ setSelectedBooking }
						/>
					) : (
						<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<CalendarDays className="h-6 w-6" />
							</span>
							<h4 className="text-base font-semibold text-card-foreground">
								{ __( 'Nothing booked', 'booking-suite' ) }
							</h4>
							<p className="max-w-sm text-sm text-muted-foreground">
								{ __(
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
