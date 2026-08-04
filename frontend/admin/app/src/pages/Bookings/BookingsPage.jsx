/**
 * BookingsPage — the guest booking management screen.
 *
 * Built on shadcn/ui: Tabs for the status filter, Table for the list, Alert for
 * failures, Card for the surfaces. Filtering stays client-side and instant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Plus,
	RefreshCw,
	Search,
	TrendingUp,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { StatCard } from '../../components/StatCard';
import { bookingService } from '../../services';
import { BookingsTable } from './components/BookingsTable';
import { BookingDetail } from './components/BookingDetail';
import { BookingForm } from './components/BookingForm';
import { formatMoney } from './data/format';
import './BookingsPage.css';

export default function BookingsPage() {
	const [ bookings, setBookings ] = useState( [] );
	const [ counts, setCounts ] = useState( {} );
	const [ statuses, setStatuses ] = useState( [] );
	const [ status, setStatus ] = useState( 'all' );
	const [ search, setSearch ] = useState( '' );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ selectedBooking, setSelectedBooking ] = useState( null );

	/** null when closed; a booking when editing; 'new' when adding. */
	const [ editing, setEditing ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await bookingService.list( {}, signal );

			setBookings( payload.bookings );
			setCounts( payload.counts );
			setStatuses( payload.statuses );
			setError( null );
		} catch ( cause ) {
			if ( 'AbortError' !== cause.name ) {
				setError( cause.message );
			}
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		const controller = new AbortController();

		load( controller.signal );

		return () => controller.abort();
	}, [ load ] );

	const metrics = useMemo( () => {
		const totalRevenue = bookings.reduce(
			( sum, item ) => sum + ( Number( item.total ) || 0 ),
			0
		);

		return {
			pendingCount: counts.pending ?? 0,
			confirmedCount: counts.confirmed ?? 0,
			totalRevenue,
			currency: bookings[ 0 ]?.currency ?? 'EUR',
		};
	}, [ bookings, counts ] );

	// Instant client-side filtering.
	const visible = useMemo( () => {
		const term = search.trim().toLowerCase();

		return bookings.filter( ( booking ) => {
			const matchesStatus = 'all' === status || booking.status === status;

			if ( ! matchesStatus ) {
				return false;
			}

			if ( ! term ) {
				return true;
			}

			return [
				booking.reference,
				booking.apartmentName,
				booking.customerName,
				booking.customerEmail,
				booking.customerPhone,
			]
				.filter( Boolean )
				.some( ( field ) => field.toLowerCase().includes( term ) );
		} );
	}, [ bookings, search, status ] );

	const tabs = [ 'all', ...statuses ];

	// A booking changed: refresh the row in place, then reload so the status
	// tab counts follow.
	const applyUpdate = ( updated ) => {
		setBookings( ( current ) =>
			current.map( ( item ) =>
				item.id === updated.id ? { ...item, ...updated } : item
			)
		);

		setSelectedBooking( ( current ) =>
			current ? { ...current, ...updated } : current
		);

		load();
	};

	// The detail view replaces the list rather than sitting over it, so it
	// reads as its own page.
	if ( selectedBooking ) {
		return (
			<>
				<BookingDetail
					booking={ selectedBooking }
					onEdit={ () => setEditing( selectedBooking ) }
					onBack={ () => setSelectedBooking( null ) }
					onUpdated={ applyUpdate }
				/>

				{ editing && (
					<BookingForm
						booking={ editing }
						onClose={ () => setEditing( null ) }
						onSaved={ ( saved ) => {
							applyUpdate( saved );
							setEditing( null );
						} }
					/>
				) }
			</>
		);
	}

	// Same StatCard as the Dashboard, so the two screens read as one product.
	const stats = [
		{
			id: 'value',
			title: __( 'Total Value', 'booking-suite' ),
			value: formatMoney( metrics.totalRevenue, metrics.currency ),
			unit: __( 'Across every booking listed', 'booking-suite' ),
			Icon: TrendingUp,
			tone: 'brand',
			badge: __( 'Gross', 'booking-suite' ),
		},
		{
			id: 'pending',
			title: __( 'Pending Requests', 'booking-suite' ),
			value: metrics.pendingCount,
			unit: __( 'Waiting on confirmation', 'booking-suite' ),
			Icon: Clock,
			tone: 'warning',
			badge: metrics.pendingCount
				? __( 'Needs action', 'booking-suite' )
				: __( 'All clear', 'booking-suite' ),
		},
		{
			id: 'confirmed',
			title: __( 'Confirmed Stays', 'booking-suite' ),
			value: metrics.confirmedCount,
			unit: __( 'Locked in and ready', 'booking-suite' ),
			Icon: CheckCircle2,
			tone: 'success',
			badge: __( 'Confirmed', 'booking-suite' ),
		},
	];

	return (
		<div className="bks-bookings-page flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not load bookings', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription className="flex flex-wrap items-center gap-3">
						<span>{ error }</span>
						<Button
							size="sm"
							variant="outline"
							onClick={ () => load() }
						>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					</AlertDescription>
				</Alert>
			) }

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{ stats.map( ( { id, Icon, ...card } ) => (
					<StatCard key={ id } icon={ Icon } { ...card } />
				) ) }
			</div>

			{ isLoading && ! bookings.length ? (
				<Card>
					<CardContent className="flex flex-col gap-3 p-5">
						{ [ 0, 1, 2, 3, 4 ].map( ( key ) => (
							<Skeleton key={ key } className="h-12 w-full" />
						) ) }
					</CardContent>
				</Card>
			) : (
				<>
					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<Tabs value={ status } onValueChange={ setStatus }>
							<TabsList className="flex-wrap">
								{ tabs.map( ( value ) => (
									<TabsTrigger
										key={ value }
										value={ value }
										className="gap-2 capitalize"
									>
										{ value.replace( /_/g, ' ' ) }
										<Badge
											variant="secondary"
											className="px-1.5 py-0 text-[11px] font-normal tabular-nums"
										>
											{ counts[ value ] ??
												( 'all' === value
													? bookings.length
													: 0 ) }
										</Badge>
									</TabsTrigger>
								) ) }
							</TabsList>
						</Tabs>

						<div className="flex flex-wrap items-center gap-2">
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="search"
									value={ search }
									onChange={ ( event ) =>
										setSearch( event.target.value )
									}
									aria-label={ __(
										'Search bookings',
										'booking-suite'
									) }
									placeholder={ __(
										'Reference, guest, email…',
										'booking-suite'
									) }
									className="w-full pl-8 sm:w-64"
								/>
							</div>

							<Button
								size="icon"
								variant="outline"
								onClick={ () => load() }
								title={ __(
									'Refresh bookings list',
									'booking-suite'
								) }
							>
								<RefreshCw
									className={ `h-4 w-4 ${
										isLoading ? 'animate-spin' : ''
									}` }
								/>
								<span className="sr-only">
									{ __( 'Refresh', 'booking-suite' ) }
								</span>
							</Button>

							<Button onClick={ () => setEditing( 'new' ) }>
								<Plus className="h-4 w-4" />
								{ __( 'Add Booking', 'booking-suite' ) }
							</Button>

							<span className="text-xs text-muted-foreground">
								{ sprintf(
									/* translators: %d: number of bookings shown. */
									_n(
										'%d booking',
										'%d bookings',
										visible.length,
										'booking-suite'
									),
									visible.length
								) }
							</span>
						</div>
					</div>

					<Card className="overflow-hidden">
						{ bookings.length > 0 ? (
							<BookingsTable
								bookings={ visible }
								onSelectBooking={ setSelectedBooking }
								emptyContent={
									<EmptyBookings
										title={ __(
											'No bookings match your filter',
											'booking-suite'
										) }
										description={ __(
											'Try another status, or clear the search to see all requests.',
											'booking-suite'
										) }
									/>
								}
							/>
						) : (
							<EmptyBookings
								title={ __(
									'No booking requests yet',
									'booking-suite'
								) }
								description={ __(
									'Requests made through the booking form on your site will appear here.',
									'booking-suite'
								) }
							/>
						) }
					</Card>
				</>
			) }

			{ editing && (
				<BookingForm
					booking={ 'new' === editing ? null : editing }
					onClose={ () => setEditing( null ) }
					onSaved={ () => {
						setEditing( null );
						load();
					} }
				/>
			) }
		</div>
	);
}

function EmptyBookings( { title, description } ) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
			<h2 className="text-base font-semibold text-card-foreground">
				{ title }
			</h2>
			<p className="max-w-sm text-sm text-muted-foreground">
				{ description }
			</p>
		</div>
	);
}
