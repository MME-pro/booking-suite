/**
 * BookingsTable — classy column definitions and row action for the bookings list.
 */

import { __ } from '@wordpress/i18n';

import { Badge, Button, DataTable } from '../../../../components';
import { EyeIcon, ReceiptIcon } from '../../../../components/icons';
import { formatDateTime, formatMoney } from '../../data/format';
import './BookingsTable.css';

/** Booking statuses, mapped to badge tone. */
const STATUS_TONES = {
	pending: 'warning',
	reserved: 'brand',
	confirmed: 'success',
	cancelled: 'danger',
	completed: 'brand',
	no_show: 'neutral',
};

const PAYMENT_TONES = {
	unpaid: 'warning',
	partial: 'brand',
	paid: 'success',
	refunded: 'neutral',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function BookingsTable( {
	bookings,
	onSelectBooking,
	emptyContent = null,
} ) {
	const columns = [
		{
			key: 'reference',
			header: __( 'Reference', 'booking-suite' ),
			width: '140px',
			render: ( booking ) => (
				<span className="bks-bookings-table__reference">
					{ booking.reference || `#${ booking.id }` }
				</span>
			),
		},
		{
			key: 'customerName',
			header: __( 'Guest Info', 'booking-suite' ),
			render: ( booking ) => {
				const initials = ( booking.customerName || 'G' )
					.split( ' ' )
					.map( ( p ) => p[ 0 ] )
					.join( '' )
					.toUpperCase()
					.slice( 0, 2 );

				return (
					<div className="bks-bookings-table__guest-cell">
						<div className="bks-bookings-table__avatar">
							{ initials }
						</div>
						<div className="bks-bookings-table__guest">
							<strong>
								{ booking.customerName ||
									__( 'Guest', 'booking-suite' ) }
							</strong>
							{ booking.customerEmail && (
								<a
									href={ `mailto:${ booking.customerEmail }` }
									onClick={ ( e ) => e.stopPropagation() }
								>
									{ booking.customerEmail }
								</a>
							) }
						</div>
					</div>
				);
			},
		},
		{
			key: 'apartmentName',
			header: __( 'Apartment', 'booking-suite' ),
			render: ( booking ) => (
				<span className="bks-bookings-table__apartment">
					{ booking.apartmentName || (
						<em className="bks-bookings-table__missing">
							{ __( 'Deleted apartment', 'booking-suite' ) }
						</em>
					) }
				</span>
			),
		},
		{
			key: 'startsAt',
			header: __( 'Stay Dates', 'booking-suite' ),
			width: '200px',
			render: ( booking ) => (
				<div className="bks-bookings-table__stay">
					<span>{ formatDateTime( booking.startsAt ) }</span>
					<span className="bks-bookings-table__stay-end">
						→ { formatDateTime( booking.endsAt ) }
					</span>
				</div>
			),
		},
		{
			key: 'guests',
			header: __( 'Guests', 'booking-suite' ),
			align: 'center',
			width: '80px',
			render: ( booking ) => (
				<span className="bks-bookings-table__guests-count">
					{ booking.guests || 1 }
				</span>
			),
		},
		{
			key: 'total',
			header: __( 'Total', 'booking-suite' ),
			align: 'end',
			width: '110px',
			render: ( booking ) => (
				<strong className="bks-bookings-table__total">
					{ formatMoney( booking.total, booking.currency ) }
				</strong>
			),
		},
		{
			key: 'status',
			header: __( 'Status', 'booking-suite' ),
			width: '130px',
			render: ( booking ) => (
				<Badge tone={ STATUS_TONES[ booking.status ] ?? 'neutral' }>
					{ label( booking.status ) }
				</Badge>
			),
		},
		{
			key: 'paymentStatus',
			header: __( 'Payment', 'booking-suite' ),
			width: '140px',
			render: ( booking ) => {
				const hasProof = Boolean(
					booking.paymentProof ||
						booking.payment_proof ||
						booking.paymentProofData
				);

				return (
					<div className="bks-bookings-table__payment-cell">
						<Badge
							tone={
								PAYMENT_TONES[ booking.paymentStatus ] ??
								'neutral'
							}
						>
							{ label( booking.paymentStatus ) }
						</Badge>
						{ hasProof && (
							<span
								className="bks-bookings-table__proof-badge"
								title={ __(
									'Payment receipt screenshot uploaded',
									'booking-suite'
								) }
							>
								<ReceiptIcon width="12" height="12" />
								{ __( 'Receipt', 'booking-suite' ) }
							</span>
						) }
					</div>
				);
			},
		},
		{
			key: 'actions',
			header: '',
			align: 'end',
			width: '110px',
			render: ( booking ) => (
				<Button
					size="sm"
					variant="tertiary"
					icon={ <EyeIcon /> }
					onClick={ () => onSelectBooking( booking ) }
				>
					{ __( 'Details', 'booking-suite' ) }
				</Button>
			),
		},
	];

	return (
		<div className="bks-bookings-table-wrapper">
			<DataTable
				columns={ columns }
				rows={ bookings }
				onRowClick={ onSelectBooking }
				emptyContent={ emptyContent }
			/>
		</div>
	);
}
