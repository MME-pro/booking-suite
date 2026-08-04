import { __ } from '@wordpress/i18n';
import { Button, SearchField, PlusIcon } from '../../../../components';
import './ApartmentsToolbar.css';

export default function ApartmentsToolbar( {
	search,
	onSearchChange,
	statusFilter = 'all',
	onStatusFilterChange,
	onAddApartment,
	count = null,
} ) {
	return (
		<div className="bks-apartments-toolbar">
			<div className="bks-apartments-toolbar__left">
				<SearchField
					id="bks-apartments-search"
					value={ search }
					onChange={ onSearchChange }
					label={ __( 'Search apartments', 'booking-suite' ) }
					placeholder={ __( 'Filter by name…', 'booking-suite' ) }
				/>

				<div className="bks-apartments-toolbar__status-filters">
					<button
						type="button"
						className={ `bks-toolbar-filter-btn ${
							statusFilter === 'all' ? 'is-active' : ''
						}` }
						onClick={ () => onStatusFilterChange( 'all' ) }
					>
						{ __( 'All', 'booking-suite' ) }
					</button>
					<button
						type="button"
						className={ `bks-toolbar-filter-btn ${
							statusFilter === 'active' ? 'is-active' : ''
						}` }
						onClick={ () => onStatusFilterChange( 'active' ) }
					>
						{ __( 'Active', 'booking-suite' ) }
					</button>
					<button
						type="button"
						className={ `bks-toolbar-filter-btn ${
							statusFilter === 'inactive' ? 'is-active' : ''
						}` }
						onClick={ () => onStatusFilterChange( 'inactive' ) }
					>
						{ __( 'Inactive', 'booking-suite' ) }
					</button>
				</div>

				{ null !== count && (
					<span className="bks-apartments-toolbar__count">
						{ count }
					</span>
				) }
			</div>

			<div className="bks-apartments-toolbar__right">
				<Button
					variant="primary"
					icon={ <PlusIcon /> }
					onClick={ onAddApartment }
				>
					{ __( 'Add Apartment', 'booking-suite' ) }
				</Button>
			</div>
		</div>
	);
}
