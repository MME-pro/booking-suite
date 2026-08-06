/**
 * Dashboard — overview of the whole booking operation.
 *
 * Reads the apartments and bookings endpoints; it owns no writes of its own.
 * The KPI numbers and chart series are derived in ./data/metrics.js.
 *
 * First screen built on shadcn/ui + Tailwind.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { AlertCircle, Building2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { ApartmentsStatus } from './components/ApartmentsStatus';
import { BookingsChart } from './components/BookingsChart';
import { QuickActions } from './components/QuickActions';
import { RevenueChart } from './components/RevenueChart';
import { StatGrid } from './components/StatGrid';
import { SystemStatus } from './components/SystemStatus';
import { dailySeries, summarise } from './data/metrics';
import { apartmentService, blockService, bookingService } from '../../services';
import { settings } from '../../settings';
import './DashboardPage.css';

/** Chart windows, in days. */
const RANGES = [
	{ value: '7', label: __( '7 days', 'booking-suite' ) },
	{ value: '30', label: __( '30 days', 'booking-suite' ) },
	{ value: '90', label: __( '90 days', 'booking-suite' ) },
];

export default function DashboardPage() {
	const [ apartments, setApartments ] = useState( [] );
	const [ bookings, setBookings ] = useState( [] );
	const [ counts, setCounts ] = useState( {} );

	/** Availability locks, so the estate list can say what is closed. */
	const [ blocks, setBlocks ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ range, setRange ] = useState( '30' );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			// Independent endpoints — no reason to wait for one before the other.
			const [ apartmentList, bookingPayload, blockPayload ] =
				await Promise.all( [
					apartmentService.list( {}, signal ),
					bookingService.list( {}, signal ),
					blockService.list( {}, signal ),
				] );

			setApartments( apartmentList );
			setBookings( bookingPayload.bookings );
			setCounts( bookingPayload.counts );
			setBlocks( blockPayload.blocks );
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

	const metrics = useMemo(
		() => summarise( bookings, apartments, counts ),
		[ bookings, apartments, counts ]
	);

	const series = useMemo(
		() => dailySeries( bookings, parseInt( range, 10 ) ),
		[ bookings, range ]
	);

	if ( isLoading ) {
		return <DashboardSkeleton />;
	}

	const isEmpty = ! apartments.length && ! bookings.length;

	return (
		<div className="bks-dashboard-page flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not load the overview', 'booking-suite' ) }
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

			{ isEmpty ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
						<span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Building2 className="h-6 w-6" />
						</span>
						<h2 className="text-lg font-semibold text-card-foreground">
							{ __( 'Nothing to report yet', 'booking-suite' ) }
						</h2>
						<p className="max-w-sm text-sm text-muted-foreground">
							{ __(
								'Add your first apartment and its numbers will show up here.',
								'booking-suite'
							) }
						</p>
						{ /* Each screen is its own admin page, so this is a full navigation. */ }
						<Button
							className="mt-2"
							onClick={ () => {
								window.location.href = settings.apartmentsUrl;
							} }
						>
							{ __( 'Manage apartments', 'booking-suite' ) }
						</Button>
					</CardContent>
				</Card>
			) : (
				<>
					{ /*
					 * Actions first: "Add Booking" is what an owner opens this
					 * screen to do, so it sits above the numbers rather than
					 * under two charts.
					 */ }
					<QuickActions />

					<StatGrid metrics={ metrics } />

					{ /* One control row above both charts, so they always show the same window. */ }
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-card-foreground">
							{ __( 'Booking activity', 'booking-suite' ) }
						</h2>
						<ToggleGroup
							type="single"
							size="sm"
							value={ range }
							onValueChange={ ( value ) =>
								value && setRange( value )
							}
							className="rounded-lg border bg-card p-1"
						>
							{ RANGES.map( ( { value, label } ) => (
								<ToggleGroupItem
									key={ value }
									value={ value }
									aria-label={ label }
									className="px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
								>
									{ label }
								</ToggleGroupItem>
							) ) }
						</ToggleGroup>
					</div>

					<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">
									{ __( 'Bookings', 'booking-suite' ) }
								</CardTitle>
								<CardDescription>
									{ __(
										'Taken per day, split by status.',
										'booking-suite'
									) }
								</CardDescription>
							</CardHeader>
							<CardContent>
								<BookingsChart series={ series } />
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">
									{ __( 'Booked value', 'booking-suite' ) }
								</CardTitle>
								<CardDescription>
									{ __(
										'Value of the bookings taken each day.',
										'booking-suite'
									) }
								</CardDescription>
							</CardHeader>
							<CardContent>
								<RevenueChart
									series={ series }
									currency={ metrics.currency }
								/>
							</CardContent>
						</Card>
					</div>

					{ /* Scanned daily, so it gets the full width to spread across. */ }
					<ApartmentsStatus
						apartments={ apartments }
						bookings={ bookings }
						blocks={ blocks }
					/>

					{ /* Last, and quiet: needed the day it breaks, ignored otherwise. */ }
					<SystemStatus />
				</>
			) }
		</div>
	);
}

/** Mirrors the loaded layout so the page does not jump when data lands. */
function DashboardSkeleton() {
	return (
		<div className="bks-dashboard-page flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{ [ 0, 1, 2, 3, 4, 5 ].map( ( key ) => (
					<Card key={ key }>
						<CardContent className="flex flex-col gap-4 p-5">
							<div className="flex items-start justify-between">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
							<div className="flex flex-col gap-2">
								<Skeleton className="h-8 w-24" />
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
						</CardContent>
					</Card>
				) ) }
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				{ [ 0, 1 ].map( ( key ) => (
					<Card key={ key }>
						<CardContent className="flex flex-col gap-3 p-5">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-[260px] w-full" />
						</CardContent>
					</Card>
				) ) }
			</div>
		</div>
	);
}
