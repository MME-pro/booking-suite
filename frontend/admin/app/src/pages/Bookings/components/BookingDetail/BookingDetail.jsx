/**
 * BookingDetail — one booking, in full.
 *
 * The row handed in from the list is shown immediately; the full record, with
 * its extras, is fetched behind that so the page never opens empty.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { Badge, Button, Card, Notice } from '../../../../components';
import { bookingService } from '../../../../services';
import { formatDateTime, formatMoney } from '../../data/format';
import './BookingDetail.css';

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

// What can be done next, given where the booking is now. Only the moves that
// make sense are offered — a cancelled booking is not "completed" from here.
const nextActions = ( booking ) => {
	const actions = [];
	const { status, paymentStatus } = booking;

	if ( 'pending' === status ) {
		actions.push( {
			key: 'reserve',
			label: __( 'Reserve', 'booking-suite' ),
			changes: { status: 'reserved' },
		} );
	}

	if ( [ 'pending', 'reserved' ].includes( status ) ) {
		actions.push( {
			key: 'approve',
			label: __( 'Approve', 'booking-suite' ),
			variant: 'primary',
			changes: { status: 'confirmed' },
		} );
	}

	if ( 'confirmed' === status ) {
		actions.push( {
			key: 'complete',
			label: __( 'Mark completed', 'booking-suite' ),
			changes: { status: 'completed' },
		} );

		actions.push( {
			key: 'no_show',
			label: __( 'No show', 'booking-suite' ),
			changes: { status: 'no_show' },
		} );
	}

	if ( 'paid' !== paymentStatus ) {
		actions.push( {
			key: 'paid',
			label: __( 'Mark as paid', 'booking-suite' ),
			variant: 'confirmed' === status ? 'secondary' : 'primary',
			changes: { payment_status: 'paid' },
		} );
	}

	if ( ! [ 'cancelled', 'completed' ].includes( status ) ) {
		actions.push( {
			key: 'cancel',
			label: __( 'Cancel booking', 'booking-suite' ),
			variant: 'danger',
			confirm: __(
				'Cancel this booking? The dates become bookable again.',
				'booking-suite'
			),
			changes: { status: 'cancelled' },
		} );
	}

	return actions;
};

export default function BookingDetail( {
	booking: initial,
	onBack,
	onUpdated,
} ) {
	const [ booking, setBooking ] = useState( initial );
	const [ error, setError ] = useState( null );
	const [ busyAction, setBusyAction ] = useState( '' );

	useEffect( () => {
		const controller = new AbortController();

		bookingService
			.get( initial.id, controller.signal )
			.then( ( full ) => setBooking( { ...initial, ...full } ) )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} );

		return () => controller.abort();
	}, [ initial ] );

	const extras = booking.extras ?? [];

	// The list row carries the receipt; the detail fetch adds the payment row
	// it belongs to, which knows when the guest says they paid.
	const payment = ( booking.payments ?? [] ).find( ( row ) => row.proof );
	const proof = payment?.proof ?? booking.paymentProof ?? null;

	const extrasTotal = extras.reduce(
		( sum, extra ) => sum + extra.price * extra.quantity,
		0
	);

	const initials = ( booking.customerName || 'G' )
		.split( ' ' )
		.map( ( part ) => part[ 0 ] )
		.join( '' )
		.toUpperCase()
		.slice( 0, 2 );

	const runAction = async ( action ) => {
		// eslint-disable-next-line no-alert
		if ( action.confirm && ! window.confirm( action.confirm ) ) {
			return;
		}

		setBusyAction( action.key );
		setError( null );

		try {
			const updated = await bookingService.update(
				booking.id,
				action.changes
			);

			setBooking( ( current ) => ( { ...current, ...updated } ) );

			// The list behind this page is now stale.
			onUpdated?.( updated );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyAction( '' );
		}
	};

	const fact = ( term, value ) => (
		<div className="bks-booking-detail__fact">
			<dt>{ term }</dt>
			<dd>{ value || '—' }</dd>
		</div>
	);

	return (
		<div className="bks-booking-detail">
			<div className="bks-booking-detail__bar">
				<Button onClick={ onBack }>
					{ __( '← Back to bookings', 'booking-suite' ) }
				</Button>

				<div className="bks-booking-detail__badges">
					<Badge tone={ STATUS_TONES[ booking.status ] ?? 'neutral' }>
						{ label( booking.status ) }
					</Badge>
					<Badge
						tone={
							PAYMENT_TONES[ booking.paymentStatus ] ?? 'neutral'
						}
					>
						{ label( booking.paymentStatus ) }
					</Badge>
				</div>
			</div>

			{ error && <Notice tone="error">{ error }</Notice> }

			<div className="bks-booking-detail__actions">
				{ nextActions( booking ).map( ( action ) => (
					<Button
						key={ action.key }
						variant={ action.variant ?? 'secondary' }
						disabled={ '' !== busyAction }
						onClick={ () => runAction( action ) }
					>
						{ busyAction === action.key
							? __( 'Saving…', 'booking-suite' )
							: action.label }
					</Button>
				) ) }
			</div>

			<header className="bks-booking-detail__head">
				<div>
					<p className="bks-booking-detail__eyebrow">
						{ __( 'Booking reference', 'booking-suite' ) }
					</p>
					<h2 className="bks-booking-detail__reference">
						{ booking.reference || `#${ booking.id }` }
					</h2>
					<p className="bks-booking-detail__received">
						{ __( 'Received', 'booking-suite' ) }{ ' ' }
						{ formatDateTime( booking.createdAt ) }
					</p>
				</div>

				<div className="bks-booking-detail__amount">
					<span>{ __( 'Total', 'booking-suite' ) }</span>
					<strong>
						{ formatMoney( booking.total, booking.currency ) }
					</strong>
				</div>
			</header>

			<div className="bks-booking-detail__grid">
				<Card title={ __( 'Guest', 'booking-suite' ) }>
					<div className="bks-booking-detail__guest">
						<span className="bks-booking-detail__avatar">
							{ initials }
						</span>
						<div>
							<strong>
								{ booking.customerName ||
									__( 'No name given', 'booking-suite' ) }
							</strong>
							{ booking.customerEmail && (
								<a href={ `mailto:${ booking.customerEmail }` }>
									{ booking.customerEmail }
								</a>
							) }
							{ booking.customerPhone && (
								<a href={ `tel:${ booking.customerPhone }` }>
									{ booking.customerPhone }
								</a>
							) }
						</div>
					</div>
				</Card>

				<Card title={ __( 'Stay', 'booking-suite' ) }>
					<dl className="bks-booking-detail__facts">
						{ fact(
							__( 'Apartment', 'booking-suite' ),
							booking.apartmentName
						) }
						{ fact(
							__( 'Arrival', 'booking-suite' ),
							formatDateTime( booking.startsAt )
						) }
						{ fact(
							__( 'Departure', 'booking-suite' ),
							formatDateTime( booking.endsAt )
						) }
						{ fact(
							__( 'Guests', 'booking-suite' ),
							String( booking.guests )
						) }
						{ fact(
							__( 'Source', 'booking-suite' ),
							booking.source
						) }
					</dl>
				</Card>
			</div>

			<Card title={ __( 'Charges', 'booking-suite' ) }>
				<ul className="bks-booking-detail__lines">
					{ extras.map( ( extra, index ) => (
						<li key={ `${ extra.name }-${ index }` }>
							<span>
								{ extra.name } × { extra.quantity }
							</span>
							<span>
								{ formatMoney(
									extra.price * extra.quantity,
									booking.currency
								) }
							</span>
						</li>
					) ) }

					{ extras.length > 0 && (
						<li className="bks-booking-detail__subtotal">
							<span>{ __( 'Extras', 'booking-suite' ) }</span>
							<span>
								{ formatMoney( extrasTotal, booking.currency ) }
							</span>
						</li>
					) }

					<li className="bks-booking-detail__total">
						<span>{ __( 'Total', 'booking-suite' ) }</span>
						<span>
							{ formatMoney( booking.total, booking.currency ) }
						</span>
					</li>
				</ul>

				{ ! extras.length && (
					<p className="bks-booking-detail__muted">
						{ __(
							'No extras were booked. The total is accommodation and any guest charge.',
							'booking-suite'
						) }
					</p>
				) }
			</Card>

			{ proof && (
				<Card title={ __( 'Payment proof', 'booking-suite' ) }>
					<div className="bks-booking-detail__proof">
						{ proof.mime?.startsWith( 'image/' ) ? (
							<a
								href={ proof.url }
								target="_blank"
								rel="noreferrer"
							>
								<img
									src={ proof.url }
									alt={ __(
										'Payment receipt uploaded by the guest',
										'booking-suite'
									) }
								/>
							</a>
						) : (
							<a
								className="bks-booking-detail__proof-file"
								href={ proof.url }
								target="_blank"
								rel="noreferrer"
							>
								{ __(
									'Open uploaded receipt',
									'booking-suite'
								) }
							</a>
						) }

						{ payment?.paidAt && (
							<p className="bks-booking-detail__muted">
								{ __( 'Guest paid on', 'booking-suite' ) }{ ' ' }
								{ formatDateTime( payment.paidAt ) }
							</p>
						) }
					</div>
				</Card>
			) }

			{ booking.notes && (
				<Card title={ __( 'Guest notes', 'booking-suite' ) }>
					<p className="bks-booking-detail__notes">
						{ booking.notes }
					</p>
				</Card>
			) }
		</div>
	);
}
