/**
 * BookingDetail — one booking, in full.
 *
 * The row handed in from the list is shown immediately; the full record, with
 * its extras, is fetched behind that so the page never opens empty.
 *
 * Built on shadcn/ui. "Release dates" confirms through an AlertDialog rather
 * than window.confirm(), matching the delete flow on the Apartments screen.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Mail, Phone, Pencil, Trash2 } from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { bookingService } from '../../../../services';
import { formatDateTime, formatMoney } from '../../data/format';
import './BookingDetail.css';

const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	reserved: 'bg-primary/10 text-primary hover:bg-primary/10',
	confirmed: 'bg-success/10 text-success hover:bg-success/10',
	completed: 'bg-muted text-muted-foreground hover:bg-muted',
	cancelled: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
};

const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
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
			variant: 'outline',
			changes: { status: 'reserved' },
		} );
	}

	if ( [ 'pending', 'reserved' ].includes( status ) ) {
		actions.push( {
			key: 'approve',
			label: __( 'Approve', 'booking-suite' ),
			variant: 'default',
			changes: { status: 'confirmed' },
		} );
	}

	if ( 'confirmed' === status ) {
		actions.push( {
			key: 'complete',
			label: __( 'Mark completed', 'booking-suite' ),
			variant: 'outline',
			changes: { status: 'completed' },
		} );
	}

	if ( 'paid' !== paymentStatus ) {
		actions.push( {
			key: 'paid',
			label: __( 'Mark as paid', 'booking-suite' ),
			variant: 'confirmed' === status ? 'outline' : 'default',
			changes: { payment_status: 'paid' },
		} );
	}

	/*
	 * Releasing frees the dates and puts the booking back in the queue, which
	 * is what you want when a held slot is wanted for someone else but the
	 * request itself is still live. Cancelling it outright is the status
	 * dropdown on the edit form — and is what the hourly sweep does on its own
	 * once a pending request's window has closed.
	 */
	if ( [ 'reserved', 'confirmed' ].includes( status ) ) {
		actions.push( {
			key: 'release',
			label: __( 'Release dates', 'booking-suite' ),
			variant: 'destructive',
			confirm: __(
				'Send this booking back to pending? The dates become bookable again.',
				'booking-suite'
			),
			changes: { status: 'pending' },
		} );
	}

	return actions;
};

export default function BookingDetail( {
	booking: initial,
	onBack,
	onEdit,
	onDelete = null,
	onUpdated,
} ) {
	const [ booking, setBooking ] = useState( initial );
	const [ error, setError ] = useState( null );
	const [ busyAction, setBusyAction ] = useState( '' );

	/** The action awaiting confirmation, if it asks for one. */
	const [ pendingAction, setPendingAction ] = useState( null );

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

	const isBusy = '' !== busyAction;

	return (
		<div className="bks-booking-detail flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				{ /*
				 * Optional: the Calendar screen shows this inside a dialog,
				 * which has its own close control and nothing to go back to.
				 */ }
				{ onBack && (
					<Button variant="ghost" onClick={ onBack }>
						<ArrowLeft className="h-4 w-4" />
						{ __( 'Back to bookings', 'booking-suite' ) }
					</Button>
				) }

				<div className="ml-auto flex items-center gap-2">
					<Badge
						variant="secondary"
						className={ `capitalize ${
							STATUS_CLASSES[ booking.status ] ?? ''
						}` }
					>
						{ label( booking.status ) }
					</Badge>
					<Badge
						variant="secondary"
						className={ `capitalize ${
							PAYMENT_CLASSES[ booking.paymentStatus ] ?? ''
						}` }
					>
						{ label( booking.paymentStatus ) }
					</Badge>
				</div>
			</div>

			{ error && (
				<Alert variant="destructive">
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			<Card>
				<CardContent className="flex flex-col gap-5 p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex flex-col gap-0.5">
							<span className="text-xs uppercase tracking-wide text-muted-foreground">
								{ __( 'Booking reference', 'booking-suite' ) }
							</span>
							<h2 className="text-2xl font-semibold tracking-tight text-card-foreground">
								{ booking.reference || `#${ booking.id }` }
							</h2>
							<span className="text-xs text-muted-foreground">
								{ __( 'Received', 'booking-suite' ) }{ ' ' }
								{ formatDateTime( booking.createdAt ) }
							</span>
						</div>

						<div className="flex flex-col items-end">
							<span className="text-xs uppercase tracking-wide text-muted-foreground">
								{ __( 'Total', 'booking-suite' ) }
							</span>
							<strong className="text-2xl font-semibold tabular-nums text-card-foreground">
								{ formatMoney(
									booking.total,
									booking.currency
								) }
							</strong>
						</div>
					</div>

					<Separator />

					<div className="flex flex-wrap gap-2">
						{ onEdit && (
							<Button
								variant="outline"
								onClick={ onEdit }
								disabled={ isBusy }
							>
								<Pencil className="h-4 w-4" />
								{ __( 'Edit booking', 'booking-suite' ) }
							</Button>
						) }

						{ /*
						 * Deleting is confirmed by whichever screen owns the
						 * list, not here: the booking is about to stop
						 * existing, and this component would be left showing a
						 * record that is gone. It hands the booking over and
						 * lets the page decide what to show next.
						 */ }
						{ onDelete && (
							<Button
								variant="outline"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								disabled={ isBusy }
								onClick={ () => onDelete( booking ) }
							>
								<Trash2 className="h-4 w-4" />
								{ __( 'Delete booking', 'booking-suite' ) }
							</Button>
						) }

						{ nextActions( booking ).map( ( action ) => (
							<Button
								key={ action.key }
								variant={ action.variant ?? 'outline' }
								disabled={ isBusy }
								onClick={ () =>
									action.confirm
										? setPendingAction( action )
										: runAction( action )
								}
							>
								{ busyAction === action.key
									? __( 'Saving…', 'booking-suite' )
									: action.label }
							</Button>
						) ) }
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							{ __( 'Guest', 'booking-suite' ) }
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-3">
							<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
								{ initials }
							</span>
							<div className="flex min-w-0 flex-col gap-0.5">
								<strong className="truncate text-card-foreground">
									{ booking.customerName ||
										__( 'No name given', 'booking-suite' ) }
								</strong>
								{ booking.customerEmail && (
									<a
										href={ `mailto:${ booking.customerEmail }` }
										className="flex items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-primary hover:underline"
									>
										<Mail className="h-3.5 w-3.5 shrink-0" />
										{ booking.customerEmail }
									</a>
								) }
								{ booking.customerPhone && (
									<a
										href={ `tel:${ booking.customerPhone }` }
										className="flex items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-primary hover:underline"
									>
										<Phone className="h-3.5 w-3.5 shrink-0" />
										{ booking.customerPhone }
									</a>
								) }
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							{ __( 'Stay', 'booking-suite' ) }
						</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="flex flex-col gap-2 text-sm">
							<Fact
								term={ __( 'Apartment', 'booking-suite' ) }
								value={ booking.apartmentName }
							/>
							<Fact
								term={ __( 'Arrival', 'booking-suite' ) }
								value={ formatDateTime( booking.startsAt ) }
							/>
							<Fact
								term={ __( 'Departure', 'booking-suite' ) }
								value={ formatDateTime( booking.endsAt ) }
							/>
							<Fact
								term={ __( 'Guests', 'booking-suite' ) }
								value={ String( booking.guests ) }
							/>
							<Fact
								term={ __( 'Source', 'booking-suite' ) }
								value={ booking.source }
							/>
						</dl>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						{ __( 'Charges', 'booking-suite' ) }
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2 text-sm">
					{ extras.map( ( extra, index ) => (
						<div
							key={ `${ extra.name }-${ index }` }
							className="flex items-center justify-between gap-4"
						>
							<span className="text-muted-foreground">
								{ extra.name } × { extra.quantity }
							</span>
							<span className="tabular-nums">
								{ formatMoney(
									extra.price * extra.quantity,
									booking.currency
								) }
							</span>
						</div>
					) ) }

					{ extras.length > 0 && (
						<>
							<div className="flex items-center justify-between gap-4">
								<span className="text-muted-foreground">
									{ __( 'Extras', 'booking-suite' ) }
								</span>
								<span className="tabular-nums">
									{ formatMoney(
										extrasTotal,
										booking.currency
									) }
								</span>
							</div>
							<Separator />
						</>
					) }

					<div className="flex items-center justify-between gap-4 font-semibold text-card-foreground">
						<span>{ __( 'Total', 'booking-suite' ) }</span>
						<span className="tabular-nums">
							{ formatMoney( booking.total, booking.currency ) }
						</span>
					</div>

					{ ! extras.length && (
						<p className="text-xs text-muted-foreground">
							{ __(
								'No extras were booked. The total is accommodation and any guest charge.',
								'booking-suite'
							) }
						</p>
					) }
				</CardContent>
			</Card>

			{ proof && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							{ __( 'Payment proof', 'booking-suite' ) }
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{ proof.mime?.startsWith( 'image/' ) ? (
							<a
								href={ proof.url }
								target="_blank"
								rel="noreferrer"
								className="block w-fit overflow-hidden rounded-lg border"
							>
								<img
									src={ proof.url }
									alt={ __(
										'Payment receipt uploaded by the guest',
										'booking-suite'
									) }
									className="max-h-72 w-auto"
								/>
							</a>
						) : (
							<Button asChild variant="outline" className="w-fit">
								<a
									href={ proof.url }
									target="_blank"
									rel="noreferrer"
								>
									{ __(
										'Open uploaded receipt',
										'booking-suite'
									) }
								</a>
							</Button>
						) }

						{ payment?.paidAt && (
							<p className="text-xs text-muted-foreground">
								{ __( 'Guest paid on', 'booking-suite' ) }{ ' ' }
								{ formatDateTime( payment.paidAt ) }
							</p>
						) }
					</CardContent>
				</Card>
			) }

			{ booking.notes && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							{ __( 'Guest notes', 'booking-suite' ) }
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="whitespace-pre-line text-sm text-muted-foreground">
							{ booking.notes }
						</p>
					</CardContent>
				</Card>
			) }

			<AlertDialog
				open={ null !== pendingAction }
				onOpenChange={ ( open ) => ! open && setPendingAction( null ) }
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ pendingAction?.label }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ pendingAction?.confirm }
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Cancel', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={ () => {
								const action = pendingAction;

								setPendingAction( null );
								runAction( action );
							} }
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{ __( 'Confirm', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function Fact( { term, value } ) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<dt className="text-muted-foreground">{ term }</dt>
			<dd className="text-right font-medium capitalize text-card-foreground">
				{ value || '—' }
			</dd>
		</div>
	);
}
