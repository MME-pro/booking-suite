/**
 * ApartmentsTable — column definitions for the apartments list.
 *
 * Rendering is delegated to the shared DataTable; this file only decides what
 * an apartment row looks like.
 */

import { __, sprintf } from '@wordpress/i18n';

import { Badge, Button, DataTable } from '../../../../components';
import './ApartmentsTable.css';

export default function ApartmentsTable( {
	apartments,
	onEdit,
	onDelete,
	busyId = null,
	emptyContent = null,
} ) {
	const columns = [
		{
			key: 'name',
			header: __( 'Apartment', 'booking-suite' ),
			render: ( apartment ) => (
				<span className="bks-apartments-table__name">
					{ apartment.images?.[ 0 ]?.url ? (
						<img
							className="bks-apartments-table__thumb"
							src={ apartment.images[ 0 ].url }
							alt=""
							style={ { borderColor: apartment.colour } }
						/>
					) : (
						<span
							className="bks-apartments-table__swatch"
							style={ { background: apartment.colour } }
							aria-hidden="true"
						/>
					) }
					{ apartment.name }
				</span>
			),
		},
		{
			key: 'capacity',
			header: __( 'Guests', 'booking-suite' ),
			align: 'center',
			width: '120px',
		},
		{
			key: 'cleaningMin',
			header: __( 'Cleaning', 'booking-suite' ),
			align: 'center',
			width: '140px',
			render: ( apartment ) =>
				sprintf(
					/* translators: %d: turnaround time in minutes. */
					__( '%d min', 'booking-suite' ),
					apartment.cleaningMin
				),
		},
		{
			key: 'active',
			header: __( 'Status', 'booking-suite' ),
			width: '140px',
			render: ( apartment ) => (
				<Badge tone={ apartment.active ? 'success' : 'neutral' }>
					{ apartment.active
						? __( 'Active', 'booking-suite' )
						: __( 'Inactive', 'booking-suite' ) }
				</Badge>
			),
		},
		{
			key: 'actions',
			header: (
				<span className="bks-sr-only">
					{ __( 'Actions', 'booking-suite' ) }
				</span>
			),
			align: 'end',
			width: '200px',
			render: ( apartment ) => (
				<div className="bks-apartments-table__actions">
					<Button
						size="sm"
						disabled={ busyId === apartment.id }
						onClick={ () => onEdit( apartment ) }
						aria-label={ sprintf(
							/* translators: %s: apartment name. */
							__( 'Edit %s', 'booking-suite' ),
							apartment.name
						) }
					>
						{ __( 'Edit', 'booking-suite' ) }
					</Button>
					<Button
						size="sm"
						variant="danger"
						disabled={ busyId === apartment.id }
						onClick={ () => onDelete( apartment ) }
						aria-label={ sprintf(
							/* translators: %s: apartment name. */
							__( 'Delete %s', 'booking-suite' ),
							apartment.name
						) }
					>
						{ busyId === apartment.id
							? __( 'Deleting…', 'booking-suite' )
							: __( 'Delete', 'booking-suite' ) }
					</Button>
				</div>
			),
		},
	];

	return (
		<DataTable
			columns={ columns }
			rows={ apartments }
			emptyContent={ emptyContent }
		/>
	);
}
