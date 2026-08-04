import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import {
	ApartmentIcon,
	Button,
	Card,
	DashboardStats,
	EmptyState,
	Notice,
	PlusIcon,
} from '../../components';
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
	const [ isFormOpen, setFormOpen ] = useState( false );
	const [ busyId, setBusyId ] = useState( null );

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

	const handleDelete = async ( apartment ) => {
		// eslint-disable-next-line no-alert
		const confirmed = window.confirm(
			sprintf(
				/* translators: %s: apartment name. */
				__( 'Delete "%s"? This cannot be undone.', 'booking-suite' ),
				apartment.name
			)
		);

		if ( ! confirmed ) {
			return;
		}

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

	const addButton = (
		<Button variant="primary" icon={ <PlusIcon /> } onClick={ openCreate }>
			{ __( 'Add Apartment', 'booking-suite' ) }
		</Button>
	);

	const hasApartments = apartments.length > 0;

	return (
		<div className="bks-apartments-page">
			{ error && (
				<Notice
					tone="error"
					className="bks-apartments-page__notice"
					actions={
						<Button size="sm" onClick={ () => load() }>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					}
				>
					{ error }
				</Notice>
			) }

			<DashboardStats apartments={ apartments } />

			{ isLoading && ! hasApartments ? (
				<Card padded={ false }>
					<EmptyState
						title={ __( 'Loading apartments…', 'booking-suite' ) }
					/>
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

					{ hasApartments ? (
						<Card padded={ false }>
							<ApartmentsTable
								apartments={ visible }
								busyId={ busyId }
								onEdit={ openEdit }
								onDelete={ handleDelete }
								emptyContent={
									<EmptyState
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
						</Card>
					) : (
						<Card padded={ false }>
							<EmptyState
								icon={ <ApartmentIcon /> }
								title={ __(
									'No apartments yet',
									'booking-suite'
								) }
								description={ __(
									'Add your first apartment to start taking bookings for it.',
									'booking-suite'
								) }
								action={ addButton }
							/>
						</Card>
					) }
				</>
			) }

			{ isFormOpen && (
				<ApartmentForm
					apartment={ editing }
					onClose={ closeForm }
					onSaved={ handleSaved }
				/>
			) }
		</div>
	);
}
