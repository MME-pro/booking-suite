/**
 * CustomersPage — everyone who has ever booked.
 *
 * Guests are created by the booking flow, so nothing is added here; this is
 * the read side, with each guest's history a click away.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	CalendarCheck,
	Coins,
	Repeat,
	Search,
	Users,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../../components/StatCard';
import { customerService } from '../../services';
import { formatMoney } from '../Bookings/data/format';
import { CustomerHistoryDialog } from './components/CustomerHistoryDialog';
import { CustomersTable } from './components/CustomersTable';

export default function CustomersPage() {
	const [ customers, setCustomers ] = useState( [] );
	const [ stats, setStats ] = useState( {} );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ search, setSearch ] = useState( '' );

	/** The guest whose history is open, if any. */
	const [ viewing, setViewing ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await customerService.list( {}, signal );

			setCustomers( payload.customers );
			setStats( payload.stats );
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

	// Searching client-side keeps it instant; the endpoint can filter too, for
	// when the guest list outgrows a single response.
	const visible = useMemo( () => {
		const term = search.trim().toLowerCase();

		if ( ! term ) {
			return customers;
		}

		return customers.filter( ( customer ) =>
			[
				customer.name,
				customer.email,
				customer.phone,
				customer.city,
				customer.company,
			]
				.filter( Boolean )
				.some( ( field ) => field.toLowerCase().includes( term ) )
		);
	}, [ customers, search ] );

	const statCards = [
		{
			id: 'total',
			title: __( 'Customers', 'booking-suite' ),
			value: stats.total ?? 0,
			unit: __( 'Everyone who has booked', 'booking-suite' ),
			Icon: Users,
			tone: 'brand',
			badge: __( 'All time', 'booking-suite' ),
		},
		{
			id: 'repeat',
			title: __( 'Recurring Customers', 'booking-suite' ),
			value: stats.repeat ?? 0,
			unit: __( 'Booked more than once', 'booking-suite' ),
			Icon: Repeat,
			tone: 'success',
			badge: stats.total
				? sprintf(
						/* translators: %d: percentage of guests who return. */
						__( '%d%% return', 'booking-suite' ),
						Math.round(
							( ( stats.repeat ?? 0 ) / stats.total ) * 100
						)
				  )
				: __( 'No data yet', 'booking-suite' ),
		},
		{
			id: 'stays',
			title: __( 'Total Stays', 'booking-suite' ),
			value: stats.stays ?? 0,
			unit: __( 'Bookings across all customers', 'booking-suite' ),
			Icon: CalendarCheck,
			tone: 'accent',
			badge: __( 'Booked', 'booking-suite' ),
		},
		{
			id: 'value',
			title: __( 'Average Value', 'booking-suite' ),
			value: formatMoney( stats.average ?? 0 ),
			unit: __( 'Lifetime spend per customer', 'booking-suite' ),
			Icon: Coins,
			tone: 'warning',
			badge: sprintf(
				/* translators: %s: total booked value across all guests. */
				__( '%s total', 'booking-suite' ),
				formatMoney( stats.spent ?? 0 )
			),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not load customers', 'booking-suite' ) }
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

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{ statCards.map( ( { id, Icon, ...card } ) => (
					<StatCard key={ id } icon={ Icon } { ...card } />
				) ) }
			</div>

			{ isLoading ? (
				<Card>
					<CardContent className="flex flex-col gap-3 p-5">
						{ [ 0, 1, 2, 3, 4 ].map( ( key ) => (
							<Skeleton key={ key } className="h-14 w-full" />
						) ) }
					</CardContent>
				</Card>
			) : (
				<>
					{ /*
					 * The search box takes the whole row on a phone and a fixed
					 * width once there is room, with the count beside it. Left to
					 * flex-wrap they broke at whatever point they ran out of
					 * width, which put the count under a half-empty row.
					 */ }
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
						<div className="relative w-full sm:w-80">
							<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								value={ search }
								onChange={ ( event ) =>
									setSearch( event.target.value )
								}
								aria-label={ __(
									'Search customers',
									'booking-suite'
								) }
								placeholder={ __(
									'Name, email, phone or city…',
									'booking-suite'
								) }
								className="w-full pl-8"
							/>
						</div>

						<span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of customers shown. */
								_n(
									'%d customer',
									'%d customers',
									visible.length,
									'booking-suite'
								),
								visible.length
							) }
						</span>
					</div>

					{ /*
					 * No Card around this: below `lg` the list IS cards, and a
					 * card of cards reads as a box somebody forgot to remove.
					 * CustomersTable puts the surface around the table and around
					 * the empty state instead.
					 */ }
					<CustomersTable
						customers={ visible }
						onViewHistory={ setViewing }
						emptyContent={
							<EmptyCustomers hasAny={ customers.length > 0 } />
						}
					/>
				</>
			) }

			{ viewing && (
				<CustomerHistoryDialog
					customer={ viewing }
					onClose={ () => setViewing( null ) }
				/>
			) }
		</div>
	);
}

function EmptyCustomers( { hasAny } ) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
			<span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Users className="h-6 w-6" />
			</span>
			<h2 className="text-base font-semibold text-card-foreground">
				{ hasAny
					? __( 'No customers match your search', 'booking-suite' )
					: __( 'No customers yet', 'booking-suite' ) }
			</h2>
			<p className="max-w-sm text-sm text-muted-foreground">
				{ hasAny
					? __(
							'Try a different name, email or city.',
							'booking-suite'
					  )
					: __(
							'Customers appear here as soon as their first booking is taken.',
							'booking-suite'
					  ) }
			</p>
		</div>
	);
}
