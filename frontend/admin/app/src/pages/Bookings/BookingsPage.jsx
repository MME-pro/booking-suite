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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { StatCard } from '../../components/StatCard';
import { bookingService } from '../../services';
import { BookingsTable } from './components/BookingsTable';
import { ListPager } from '@/components/ListPager';
import { usePaged } from '@/hooks/usePaged';
import { BookingDetail } from './components/BookingDetail';
import { BookingForm } from './components/BookingForm';
import { PaymentDialog } from './components/PaymentDialog';
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

	/**
	 * null when closed; a booking when editing; 'new' when adding.
	 *
	 * Opens straight away when the Dashboard's "Add Booking" sent us here with
	 * `action=new`, so that action lands on the form rather than the list.
	 */
	const [ editing, setEditing ] = useState( () =>
		'new' === new URLSearchParams( window.location.search ).get( 'action' )
			? 'new'
			: null
	);

	/** The booking whose payment is being viewed, if any. */
	const [ payingBooking, setPayingBooking ] = useState( null );

	/** The row a quick action is currently working on. */
	const [ busyId, setBusyId ] = useState( null );

	/** The booking awaiting delete confirmation, if any. */
	const [ pendingDelete, setPendingDelete ] = useState( null );

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

	/*
	 * Paged after filtering, so the tab counts and the search still describe
	 * every booking rather than the page you happen to be on.
	 */
	const paged = usePaged( visible );

	const tabs = [ 'all', ...statuses ];

	// How many bookings a status holds; 'all' is the unfiltered total. Shared by
	// the dropdown and the tab strip so the two can never disagree.
	const countFor = ( value ) =>
		counts[ value ] ?? ( 'all' === value ? bookings.length : 0 );

	const statusLabel = ( value ) => value.replace( /_/g, ' ' );

	/*
	 * Quick actions from the list. Each is the same call the detail screen
	 * makes, so the two stay in step; the row is swapped in from the response
	 * rather than guessed at locally.
	 */
	const runQuickAction = async ( booking, changes ) => {
		setBusyId( booking.id );

		try {
			const updated = await bookingService.update( booking.id, changes );

			applyUpdate( updated );
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	/*
	 * Erase a booking. Unlike the quick actions this cannot be applied to the
	 * row in place — there is no row afterwards — so it drops out of the list
	 * and, if the detail screen was open on it, out of that too.
	 *
	 * The list is reloaded rather than only filtered, because the status tab
	 * counts come from the server and would otherwise still count it.
	 */
	const confirmDelete = async () => {
		const booking = pendingDelete;

		if ( ! booking ) {
			return;
		}

		setPendingDelete( null );
		setBusyId( booking.id );

		try {
			await bookingService.remove( booking.id );

			setBookings( ( current ) =>
				current.filter( ( item ) => item.id !== booking.id )
			);

			setSelectedBooking( ( current ) =>
				current?.id === booking.id ? null : current
			);

			setError( null );
			load();
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

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

	/*
	 * One dialog, rendered by both branches below. What it warns about is the
	 * part that has no equivalent anywhere else in this admin: every other way
	 * of taking a booking off the board keeps the booking, and this one does
	 * not.
	 */
	const deleteDialog = (
		<AlertDialog
			open={ null !== pendingDelete }
			onOpenChange={ ( open ) => ! open && setPendingDelete( null ) }
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{ __( 'Delete this booking?', 'booking-suite' ) }
					</AlertDialogTitle>
					<AlertDialogDescription>
						{ pendingDelete &&
							sprintf(
								/* translators: 1: booking reference, 2: guest name. */
								__(
									'%1$s (%2$s) will be erased for good, together with its payments and invoices. Nothing is kept and this cannot be undone. To free the dates without losing the booking, release it instead.',
									'booking-suite'
								),
								pendingDelete.reference ||
									`#${ pendingDelete.id }`,
								pendingDelete.customerName ||
									__( 'Guest', 'booking-suite' )
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
						{ __( 'Delete booking', 'booking-suite' ) }
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);

	// The detail view replaces the list rather than sitting over it, so it
	// reads as its own page.
	if ( selectedBooking ) {
		return (
			<>
				<BookingDetail
					booking={ selectedBooking }
					onEdit={ () => setEditing( selectedBooking ) }
					onBack={ () => setSelectedBooking( null ) }
					onDelete={ setPendingDelete }
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

				{ deleteDialog }
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

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
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
						{ /*
						 * The status filter takes two forms, because five pills
						 * with counts do not fit one phone row and wrapping them
						 * leaves a ragged two-line block above everything else.
						 * Below `sm` it collapses to a dropdown: one control,
						 * one row, always tidy, and it still shows the current
						 * filter and its count without being opened.
						 */ }
						<Select value={ status } onValueChange={ setStatus }>
							<SelectTrigger
								className="w-full capitalize sm:hidden"
								aria-label={ __(
									'Filter by status',
									'booking-suite'
								) }
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ tabs.map( ( value ) => (
									<SelectItem
										key={ value }
										value={ value }
										className="capitalize"
									>
										{ statusLabel( value ) } (
										{ countFor( value ) })
									</SelectItem>
								) ) }
							</SelectContent>
						</Select>

						{ /*
						 * `h-auto` is doing real work here. shadcn's TabsList is
						 * a fixed h-9 strip, so `flex-wrap` alone wraps the
						 * triggers while the box stays one row tall and the
						 * second row draws on top of the first. Letting the
						 * height follow the content is what makes wrapping
						 * legible; the gap keeps the rows apart once it does.
						 */ }
						<Tabs
							value={ status }
							onValueChange={ setStatus }
							className="hidden sm:block xl:w-auto"
						>
							<TabsList className="h-auto w-full flex-wrap justify-start gap-1 xl:w-auto">
								{ tabs.map( ( value ) => (
									<TabsTrigger
										key={ value }
										value={ value }
										className="gap-2 capitalize"
									>
										{ statusLabel( value ) }
										<Badge
											variant="secondary"
											className="px-1.5 py-0 text-[11px] font-normal tabular-nums"
										>
											{ countFor( value ) }
										</Badge>
									</TabsTrigger>
								) ) }
							</TabsList>
						</Tabs>

						{ /*
						 * Two rows on a phone, one from `sm` up. The pairing is
						 * deliberate: refresh belongs beside the search because
						 * both act on the list you are looking at, and Add
						 * Booking is the only thing here that creates something,
						 * so it gets its own line and the full width rather than
						 * being squeezed between an icon and a count.
						 *
						 * Everything here has a fixed place. The previous
						 * flex-wrap let each control break wherever it happened
						 * to run out of room, which is what made it look
						 * unarranged rather than merely narrow.
						 */ }
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:shrink-0">
							<div className="flex items-center gap-2">
								<div className="relative flex-1 sm:w-56 sm:flex-none">
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
										className="w-full pl-8"
									/>
								</div>

								<Button
									size="icon"
									variant="outline"
									className="shrink-0"
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
							</div>

							<div className="flex items-center gap-3">
								<Button
									className="flex-1 sm:flex-none"
									onClick={ () => setEditing( 'new' ) }
								>
									<Plus className="h-4 w-4" />
									{ __( 'Add Booking', 'booking-suite' ) }
								</Button>

								{ /*
								 * A note about the list rather than a control:
								 * it never moves, so it sits at the end on every
								 * width and stays quiet.
								 */ }
								<span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
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
					</div>

					{ /*
					 * No Card around this: below `lg` the list IS cards, and a
					 * card of cards reads as a box somebody forgot to remove.
					 * BookingsTable puts the surface where it belongs — around
					 * the table, and around the empty state.
					 */ }
					{ bookings.length > 0 ? (
						<BookingsTable
							bookings={ paged.rows }
							onSelectBooking={ setSelectedBooking }
							busyId={ busyId }
							onApprove={ ( booking ) =>
								runQuickAction( booking, {
									status: 'confirmed',
								} )
							}
							onMarkPaid={ ( booking ) =>
								runQuickAction( booking, {
									payment_status: 'paid',
								} )
							}
							onViewPayment={ setPayingBooking }
							onDelete={ setPendingDelete }
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
						<Card className="overflow-hidden">
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
						</Card>
					) }

					<ListPager
						page={ paged.page }
						pageCount={ paged.pageCount }
						onPage={ paged.setPage }
						from={ paged.from }
						to={ paged.to }
						total={ paged.total }
					/>
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

			{ deleteDialog }

			{ payingBooking && (
				<PaymentDialog
					booking={ payingBooking }
					onClose={ () => setPayingBooking( null ) }
					onMarkPaid={ ( booking ) => {
						setPayingBooking( null );
						runQuickAction( booking, { payment_status: 'paid' } );
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
