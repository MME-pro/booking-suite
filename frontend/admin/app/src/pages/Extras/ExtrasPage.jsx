/**
 * ExtrasPage — the add-ons offered alongside a stay.
 *
 * These are the same records the guest-facing booking modal offers in its
 * extras step, so anything switched on here shows up on the site.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	Boxes,
	CheckCircle2,
	PackageX,
	Plus,
	Search,
	ShoppingCart,
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { StatCard } from '../../components/StatCard';
import { extraService } from '../../services';
import { ExtraForm } from './components/ExtraForm';
import { ExtrasTable } from './components/ExtrasTable';

const FILTERS = [
	{ value: 'all', label: __( 'All', 'booking-suite' ) },
	{ value: 'active', label: __( 'Active', 'booking-suite' ) },
	{ value: 'inactive', label: __( 'Inactive', 'booking-suite' ) },
];

export default function ExtrasPage() {
	const [ extras, setExtras ] = useState( [] );
	const [ booked, setBooked ] = useState( {} );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ search, setSearch ] = useState( '' );
	const [ statusFilter, setStatusFilter ] = useState( 'all' );
	const [ busyId, setBusyId ] = useState( null );

	/** null when closed; an extra when editing; 'new' when adding. */
	const [ editing, setEditing ] = useState( null );

	/** The extra awaiting delete confirmation, if any. */
	const [ pendingDelete, setPendingDelete ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await extraService.list( signal );

			setExtras( payload.extras );
			setBooked( payload.booked );
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

	const stats = useMemo( () => {
		const total = extras.length;
		const active = extras.filter( ( item ) => item.active ).length;

		// Only stock-managed extras can run out; unlimited ones never do.
		const soldOut = extras.filter(
			( item ) => null !== item.stock && item.stock < 1
		).length;

		const bookedTotal = Object.values( booked ).reduce(
			( sum, value ) => sum + ( Number( value ) || 0 ),
			0
		);

		return { total, active, soldOut, bookedTotal };
	}, [ extras, booked ] );

	const visible = useMemo( () => {
		const term = search.trim().toLowerCase();

		return extras.filter( ( extra ) => {
			const matchesStatus =
				'all' === statusFilter ||
				( 'active' === statusFilter && extra.active ) ||
				( 'inactive' === statusFilter && ! extra.active );

			if ( ! matchesStatus ) {
				return false;
			}

			if ( ! term ) {
				return true;
			}

			return [ extra.name, extra.description ]
				.filter( Boolean )
				.some( ( field ) => field.toLowerCase().includes( term ) );
		} );
	}, [ extras, search, statusFilter ] );

	// Merge the saved row in place rather than refetching the whole list.
	const handleSaved = ( saved ) => {
		setExtras( ( current ) => {
			const exists = current.some( ( item ) => item.id === saved.id );

			const next = exists
				? current.map( ( item ) =>
						item.id === saved.id ? saved : item
				  )
				: [ ...current, saved ];

			// Keep the list in the order guests will see it.
			return next.sort(
				( a, b ) =>
					a.sortOrder - b.sortOrder || a.name.localeCompare( b.name )
			);
		} );

		setEditing( null );
	};

	/*
	 * Show/hide without opening the form. The row is swapped in from the
	 * response rather than toggled locally, so the list matches what was
	 * actually stored.
	 */
	const toggleActive = async ( extra ) => {
		setBusyId( extra.id );

		try {
			const saved = await extraService.update( extra.id, {
				active: ! extra.active,
			} );

			setExtras( ( current ) =>
				current.map( ( item ) =>
					item.id === saved.id ? saved : item
				)
			);
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	const confirmDelete = async () => {
		const extra = pendingDelete;

		if ( ! extra ) {
			return;
		}

		setPendingDelete( null );
		setBusyId( extra.id );

		try {
			await extraService.remove( extra.id );
			setExtras( ( current ) =>
				current.filter( ( item ) => item.id !== extra.id )
			);
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	const statCards = [
		{
			id: 'total',
			title: __( 'Total Extras', 'booking-suite' ),
			value: stats.total,
			unit: __( 'Items offered at booking', 'booking-suite' ),
			Icon: Boxes,
			tone: 'brand',
			badge: __( 'Catalogue', 'booking-suite' ),
		},
		{
			id: 'active',
			title: __( 'Active', 'booking-suite' ),
			value: stats.active,
			unit: __( 'Visible to customers', 'booking-suite' ),
			Icon: CheckCircle2,
			tone: 'success',
			badge:
				stats.active === stats.total
					? __( 'All live', 'booking-suite' )
					: __( 'Some hidden', 'booking-suite' ),
		},
		{
			id: 'booked',
			title: __( 'Units Booked', 'booking-suite' ),
			value: stats.bookedTotal,
			unit: __( 'Across every booking', 'booking-suite' ),
			Icon: ShoppingCart,
			tone: 'accent',
			badge: __( 'All time', 'booking-suite' ),
		},
		{
			id: 'soldout',
			title: __( 'Out of Stock', 'booking-suite' ),
			value: stats.soldOut,
			unit: __( 'Stock-managed and empty', 'booking-suite' ),
			Icon: PackageX,
			tone: stats.soldOut > 0 ? 'warning' : 'success',
			badge:
				stats.soldOut > 0
					? __( 'Needs restock', 'booking-suite' )
					: __( 'All available', 'booking-suite' ),
		},
	];

	return (
		<div className="flex flex-col gap-4">
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

			{ isLoading ? (
				<Card>
					<CardContent className="flex flex-col gap-3 p-5">
						{ [ 0, 1, 2, 3 ].map( ( key ) => (
							<Skeleton key={ key } className="h-14 w-full" />
						) ) }
					</CardContent>
				</Card>
			) : (
				<>
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						{ /*
						 * Search on its own row, then the filter beside the count
						 * and the button. Only three filters here, so the tab strip
						 * fits a phone row where the five on Bookings did not — it
						 * just needs `h-auto` so it can grow if a translation makes
						 * the labels longer than English does.
						 */ }
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
							<div className="relative w-full sm:w-64">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									type="search"
									value={ search }
									onChange={ ( event ) =>
										setSearch( event.target.value )
									}
									aria-label={ __(
										'Search extras',
										'booking-suite'
									) }
									placeholder={ __(
										'Search by name…',
										'booking-suite'
									) }
									className="w-full pl-8"
								/>
							</div>

							<Tabs
								value={ statusFilter }
								onValueChange={ setStatusFilter }
								className="w-full sm:w-auto"
							>
								<TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
									{ FILTERS.map( ( { value, label } ) => (
										<TabsTrigger
											key={ value }
											value={ value }
											className="flex-1 sm:flex-none"
										>
											{ label }
										</TabsTrigger>
									) ) }
								</TabsList>
							</Tabs>
						</div>

						<div className="flex items-center gap-3 lg:shrink-0">
							<Button
								className="min-w-0 flex-1 sm:flex-none"
								onClick={ () => setEditing( 'new' ) }
							>
								<Plus className="h-4 w-4 shrink-0" />
								<span className="truncate">
									{ __( 'Add Extra', 'booking-suite' ) }
								</span>
							</Button>
							<span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
								{ sprintf(
									/* translators: %d: number of extras shown. */
									_n(
										'%d extra',
										'%d extras',
										visible.length,
										'booking-suite'
									),
									visible.length
								) }
							</span>
						</div>
					</div>

					{ /*
					 * No Card around this: below lg the list IS cards, and a card of
					 * cards reads as a box somebody forgot to remove. ExtrasTable puts
					 * the surface around the table and around the empty state instead.
					 */ }
					{ extras.length > 0 ? (
						<ExtrasTable
							extras={ visible }
							booked={ booked }
							busyId={ busyId }
							onEdit={ setEditing }
							onDelete={ setPendingDelete }
							onToggleActive={ toggleActive }
							emptyContent={
								<EmptyExtras
									title={ __(
										'No extras match your search',
										'booking-suite'
									) }
									description={ __(
										'Try a different name, or clear the search to see all extras.',
										'booking-suite'
									) }
								/>
							}
						/>
					) : (
						<Card className="overflow-hidden">
							<EmptyExtras
								title={ __( 'No extras yet', 'booking-suite' ) }
								description={ __(
									'Add an extra — a breakfast, a parking space, a projector — and guests can add it while booking.',
									'booking-suite'
								) }
								action={
									<Button
										className="mt-2"
										onClick={ () => setEditing( 'new' ) }
									>
										<Plus className="h-4 w-4" />
										{ __( 'Add Extra', 'booking-suite' ) }
									</Button>
								}
							/>
						</Card>
					) }
				</>
			) }

			{ editing && (
				<ExtraForm
					extra={ 'new' === editing ? null : editing }
					onClose={ () => setEditing( null ) }
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
							{ __( 'Delete this extra?', 'booking-suite' ) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ pendingDelete &&
								sprintf(
									/* translators: %s: extra name. */
									__(
										'"%s" will be removed and detached from any booking it was added to. Those bookings keep the total they were taken at. This cannot be undone.',
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

function EmptyExtras( { title, description, action = null } ) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
			<span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Boxes className="h-6 w-6" />
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
