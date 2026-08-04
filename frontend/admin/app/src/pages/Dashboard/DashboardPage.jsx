/**
 * Dashboard — overview of the whole booking operation.
 *
 * Reads the same apartments endpoint the Apartments screen uses; it owns no
 * writes of its own.
 */

import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import {
	ApartmentIcon,
	Button,
	Card,
	DashboardStats,
	EmptyState,
	Notice,
} from '../../components';
import { apartmentService } from '../../services';
import { settings } from '../../settings';
import './DashboardPage.css';

export default function DashboardPage() {
	const [ apartments, setApartments ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );

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

	// Each screen is its own admin page, so this is a full navigation.
	const manageButton = (
		<Button
			variant="primary"
			onClick={ () => {
				window.location.href = settings.apartmentsUrl;
			} }
		>
			{ __( 'Manage apartments', 'booking-suite' ) }
		</Button>
	);

	return (
		<div className="bks-dashboard-page">
			{ error && (
				<Notice
					tone="error"
					className="bks-dashboard-page__notice"
					actions={
						<Button size="sm" onClick={ () => load() }>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					}
				>
					{ error }
				</Notice>
			) }

			{ isLoading ? (
				<Card padded={ false }>
					<EmptyState
						title={ __( 'Loading overview…', 'booking-suite' ) }
					/>
				</Card>
			) : (
				<>
					<DashboardStats apartments={ apartments } />

					{ ! apartments.length && (
						<Card padded={ false }>
							<EmptyState
								icon={ <ApartmentIcon /> }
								title={ __(
									'Nothing to report yet',
									'booking-suite'
								) }
								description={ __(
									'Add your first apartment and its numbers will show up here.',
									'booking-suite'
								) }
								action={ manageButton }
							/>
						</Card>
					) }
				</>
			) }
		</div>
	);
}
