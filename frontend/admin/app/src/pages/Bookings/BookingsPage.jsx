/**
 * BookingsPage — modern, classy admin interface for guest booking management.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import {
	Button,
	Card,
	EmptyState,
	Notice,
	SearchField,
} from '../../components';
import {
	ClockIcon,
	CheckCircleIcon,
	TrendingUpIcon,
	RefreshIcon,
	PlusIcon,
} from '../../components/icons';
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

	// Calculate overall KPI summary metrics
	const metrics = useMemo( () => {
		const pendingCount = counts.pending ?? 0;
		const confirmedCount = counts.confirmed ?? 0;
		const totalCount = bookings.length;
		const totalRevenue = bookings.reduce(
			( sum, item ) => sum + ( Number( item.total ) || 0 ),
			0
		);
		const currency = bookings[ 0 ]?.currency ?? 'EUR';

		return {
			totalCount,
			pendingCount,
			confirmedCount,
			totalRevenue,
			currency,
		};
	}, [ bookings, counts ] );

	// Instant client-side filtering
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

	return (
		<div className="bks-bookings-page">
			{ error && (
				<Notice
					tone="error"
					className="bks-bookings-page__notice"
					actions={
						<Button size="sm" onClick={ () => load() }>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					}
				>
					{ error }
				</Notice>
			) }

			{ /* Top KPI Metrics Cards Header */ }
			<div className="bks-bookings-stats">
				<div className="bks-stat-card">
					<div className="bks-stat-card__icon bks-stat-card__icon--brand">
						<TrendingUpIcon width="20" height="20" />
					</div>
					<div className="bks-stat-card__content">
						<span className="bks-stat-card__label">
							{ __( 'Total Value', 'booking-suite' ) }
						</span>
						<strong className="bks-stat-card__value">
							{ formatMoney(
								metrics.totalRevenue,
								metrics.currency
							) }
						</strong>
					</div>
				</div>

				<div className="bks-stat-card">
					<div className="bks-stat-card__icon bks-stat-card__icon--warning">
						<ClockIcon width="20" height="20" />
					</div>
					<div className="bks-stat-card__content">
						<span className="bks-stat-card__label">
							{ __( 'Pending Requests', 'booking-suite' ) }
						</span>
						<strong className="bks-stat-card__value">
							{ metrics.pendingCount }
						</strong>
					</div>
				</div>

				<div className="bks-stat-card">
					<div className="bks-stat-card__icon bks-stat-card__icon--success">
						<CheckCircleIcon width="20" height="20" />
					</div>
					<div className="bks-stat-card__content">
						<span className="bks-stat-card__label">
							{ __( 'Confirmed Stays', 'booking-suite' ) }
						</span>
						<strong className="bks-stat-card__value">
							{ metrics.confirmedCount }
						</strong>
					</div>
				</div>
			</div>

			{ isLoading && ! bookings.length ? (
				<Card padded={ false }>
					<EmptyState
						title={ __( 'Loading bookings…', 'booking-suite' ) }
					/>
				</Card>
			) : (
				<>
					{ /* Classy Toolbar */ }
					<div className="bks-bookings-toolbar">
						<div className="bks-bookings-toolbar__filters">
							{ tabs.map( ( value ) => (
								<button
									key={ value }
									type="button"
									className={ `bks-bookings-filter${
										status === value ? ' is-active' : ''
									}` }
									onClick={ () => setStatus( value ) }
								>
									{ value.replace( /_/g, ' ' ) }
									<span>
										{ counts[ value ] ??
											( 'all' === value
												? bookings.length
												: 0 ) }
									</span>
								</button>
							) ) }
						</div>

						<div className="bks-bookings-toolbar__right">
							<SearchField
								id="bks-bookings-search"
								value={ search }
								onChange={ setSearch }
								label={ __(
									'Search bookings',
									'booking-suite'
								) }
								placeholder={ __(
									'Reference, guest, email…',
									'booking-suite'
								) }
							/>

							<button
								type="button"
								className="bks-bookings-refresh"
								onClick={ () => load() }
								title={ __(
									'Refresh bookings list',
									'booking-suite'
								) }
							>
								<RefreshIcon
									width="16"
									height="16"
									className={ isLoading ? 'bks-spin' : '' }
								/>
							</button>

							<Button
								variant="primary"
								icon={ <PlusIcon /> }
								onClick={ () => setEditing( 'new' ) }
							>
								{ __( 'Add Booking', 'booking-suite' ) }
							</Button>

							<span className="bks-bookings-toolbar__count">
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

					{ /* Classy Table Container */ }
					<Card padded={ false } className="bks-bookings-card">
						{ bookings.length > 0 ? (
							<BookingsTable
								bookings={ visible }
								onSelectBooking={ setSelectedBooking }
								emptyContent={
									<EmptyState
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
							<EmptyState
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
