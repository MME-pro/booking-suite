/**
 * ApartmentsPage — manage the estate.
 *
 * Built on shadcn/ui. The delete confirmation is an AlertDialog rather than
 * window.confirm(), so it is styled with the rest of the admin and keeps focus
 * inside the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	Building2,
	CheckCircle2,
	Clock,
	Plus,
	Users,
} from 'lucide-react';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../../components/StatCard';
import { apartmentService } from '../../services';
import { ApartmentForm } from './components/ApartmentForm';
import { ApartmentsTable } from './components/ApartmentsTable';
import { ApartmentsToolbar } from './components/ApartmentsToolbar';
import './ApartmentsPage.css';

export default function ApartmentsPage() {
	const [ apartments, setApartments ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ search, setSearch ] = useState( '' );
	const [ statusFilter, setStatusFilter ] = useState( 'all' );
	const [ editing, setEditing ] = useState( null );

	/*
	 * Opens straight away when the Dashboard's "Add Apartment" sent us here
	 * with `action=new`, so that action lands on the form rather than the list.
	 */
	const [ isFormOpen, setFormOpen ] = useState(
		() =>
			'new' ===
			new URLSearchParams( window.location.search ).get( 'action' )
	);
	const [ busyId, setBusyId ] = useState( null );

	/** The apartment awaiting delete confirmation, if any. */
	const [ pendingDelete, setPendingDelete ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			setApartments( await apartmentService.list( {}, signal ) );
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

	const visible = useMemo( () => {
		const term = search.trim().toLowerCase();

		return apartments.filter( ( apartment ) => {
			const matchesSearch =
				! term || apartment.name.toLowerCase().includes( term );
			const matchesStatus =
				statusFilter === 'all' ||
				( statusFilter === 'active' && apartment.active ) ||
				( statusFilter === 'inactive' && ! apartment.active );

			return matchesSearch && matchesStatus;
		} );
	}, [ apartments, search, statusFilter ] );

	const stats = useMemo( () => {
		const total = apartments.length;
		const active = apartments.filter( ( item ) => item.active ).length;
		const capacity = apartments.reduce(
			( acc, item ) => acc + ( parseInt( item.capacity, 10 ) || 0 ),
			0
		);
		const cleaning = total
			? Math.round(
					apartments.reduce(
						( acc, item ) =>
							acc + ( parseInt( item.cleaningMin, 10 ) || 0 ),
						0
					) / total
			  )
			: 0;

		return { total, active, capacity, cleaning };
	}, [ apartments ] );

	const openCreate = () => {
		setEditing( null );
		setFormOpen( true );
	};

	const openEdit = ( apartment ) => {
		setEditing( apartment );
		setFormOpen( true );
	};

	const closeForm = () => {
		setFormOpen( false );
		setEditing( null );
	};

	// Merge the saved row in place rather than refetching the whole list.
	const handleSaved = ( saved ) => {
		setApartments( ( current ) => {
			const exists = current.some( ( item ) => item.id === saved.id );

			return exists
				? current.map( ( item ) =>
						item.id === saved.id ? saved : item
				  )
				: [ ...current, saved ];
		} );

		closeForm();
	};

	const confirmDelete = async () => {
		const apartment = pendingDelete;

		if ( ! apartment ) {
			return;
		}

		setPendingDelete( null );
		setBusyId( apartment.id );

		try {
			await apartmentService.remove( apartment.id );
			setApartments( ( current ) =>
				current.filter( ( item ) => item.id !== apartment.id )
			);
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	const hasApartments = apartments.length > 0;

	const statCards = [
		{
			id: 'total',
			title: __( 'Total Properties', 'booking-suite' ),
			value: stats.total,
			unit: __( 'Units Registered', 'booking-suite' ),
			Icon: Building2,
			tone: 'brand',
			badge: sprintf(
				/* translators: %d: number of apartments */
				__( '%d total', 'booking-suite' ),
				stats.total
			),
		},
		{
			id: 'active',
			title: __( 'Active Units', 'booking-suite' ),
			value: stats.active,
			unit: __( 'Bookable right now', 'booking-suite' ),
			Icon: CheckCircle2,
			tone: 'success',
			badge:
				stats.active === stats.total
					? __( 'All bookable', 'booking-suite' )
					: __( 'Partly offline', 'booking-suite' ),
		},
		{
			id: 'capacity',
			title: __( 'Total Capacity', 'booking-suite' ),
			value: stats.capacity,
			unit: __( 'Max Guest Capacity', 'booking-suite' ),
			Icon: Users,
			tone: 'accent',
			badge: __( 'Combined', 'booking-suite' ),
		},
		{
			id: 'cleaning',
			title: __( 'Avg Turnaround', 'booking-suite' ),
			value: `${ stats.cleaning }m`,
			unit: __( 'Cleaning Duration', 'booking-suite' ),
			Icon: Clock,
			tone: 'warning',
			badge: __( 'Optimized', 'booking-suite' ),
		},
	];

	return (
		<div className="bks-apartments-page flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Something went wrong', 'booking-suite' ) }
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

			{ isLoading && ! hasApartments ? (
				<Card>
					<CardContent className="flex flex-col gap-3 p-5">
						{ [ 0, 1, 2, 3 ].map( ( key ) => (
							<Skeleton key={ key } className="h-14 w-full" />
						) ) }
					</CardContent>
				</Card>
			) : (
				<>
					{ hasApartments && (
						<ApartmentsToolbar
							search={ search }
							onSearchChange={ setSearch }
							statusFilter={ statusFilter }
							onStatusFilterChange={ setStatusFilter }
							onAddApartment={ openCreate }
							count={ sprintf(
								/* translators: %d: number of apartments shown. */
								_n(
									'%d apartment',
									'%d apartments',
									visible.length,
									'booking-suite'
								),
								visible.length
							) }
						/>
					) }

					<Card className="overflow-hidden">
						{ hasApartments ? (
							<ApartmentsTable
								apartments={ visible }
								busyId={ busyId }
								onEdit={ openEdit }
								onDelete={ setPendingDelete }
								emptyContent={
									<EmptyApartments
										title={ __(
											'No apartments match your search',
											'booking-suite'
										) }
										description={ __(
											'Try a different name, or clear the search to see all apartments.',
											'booking-suite'
										) }
									/>
								}
							/>
						) : (
							<EmptyApartments
								title={ __(
									'No apartments yet',
									'booking-suite'
								) }
								description={ __(
									'Add your first apartment to start taking bookings for it.',
									'booking-suite'
								) }
								action={
									<Button
										className="mt-2"
										onClick={ openCreate }
									>
										<Plus className="h-4 w-4" />
										{ __(
											'Add Apartment',
											'booking-suite'
										) }
									</Button>
								}
							/>
						) }
					</Card>
				</>
			) }

			{ isFormOpen && (
				<ApartmentForm
					apartment={ editing }
					onClose={ closeForm }
					onSaved={ handleSaved }
				/>
			) }

			<AlertDialog
				open={ null !== pendingDelete }
				onOpenChange={ ( open ) => ! open && setPendingDelete( null ) }
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ __( 'Delete this apartment?', 'booking-suite' ) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ pendingDelete &&
								sprintf(
									/* translators: %s: apartment name. */
									__(
										'"%s" will be removed. This cannot be undone.',
										'booking-suite'
									),
									pendingDelete.name
								) }
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Cancel', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={ confirmDelete }
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{ __( 'Delete', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function EmptyApartments( { title, description, action = null } ) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
			<span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Building2 className="h-6 w-6" />
			</span>
			<h2 className="text-base font-semibold text-card-foreground">
				{ title }
			</h2>
			<p className="max-w-sm text-sm text-muted-foreground">
				{ description }
			</p>
			{ action }
		</div>
	);
}
