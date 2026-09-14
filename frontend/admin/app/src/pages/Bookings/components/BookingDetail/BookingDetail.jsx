/**
 * BookingDetail — one booking, in full.
 *
 * The row handed in from the list is shown immediately; the full record — its
 * extras, every payment against it, and the history of what has been changed on
 * it — is fetched behind that so the page never opens empty.
 *
 * Built on shadcn/ui. "Release dates" confirms through an AlertDialog rather
 * than window.confirm(), matching the delete flow on the Apartments screen.
 */

import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	ArrowLeft,
	BadgeEuro,
	FileText,
	Mail,
	Pencil,
	Phone,
	Repeat,
	Trash2,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import { bookingService } from '../../../../services';
import { RecordPaymentDialog } from '../../../../components/RecordPaymentDialog';
import { BookingHistory } from '../BookingHistory';
import { BookingPayments } from '../BookingPayments';
import { formatDateTime, formatMoney } from '../../data/format';
import './BookingDetail.css';

const STATUS_CLASSES = {
	awaiting_transfer: 'bg-warning/10 text-warning hover:bg-warning/10',
	transfer_declared: 'bg-primary/10 text-primary hover:bg-primary/10',
	/*
	 * Amber, not red. An overdue booking is not a cancelled one — the
	 * money may still arrive, and the operator may still honour it. Red is
	 * reserved for the decision they take themselves.
	 */
	payment_overdue: 'bg-warning/10 text-warning hover:bg-warning/10',
	confirmed: 'bg-success/10 text-success hover:bg-success/10',
	completed: 'bg-muted text-muted-foreground hover:bg-muted',
	cancelled: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
	// Retired names, still on older rows.
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	reserved: 'bg-primary/10 text-primary hover:bg-primary/10',
};

const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	// Money the owner is holding that is not theirs yet.
	overpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

/**
 * What the two booking types are called on screen.
 *
 * Named rather than shown raw, because the operator is being asked to
 * understand a tax consequence and "hourly" alone does not carry one.
 */
const TYPE_LABELS = {
	overnight: __( 'Overnight stay', 'booking-suite' ),
	hourly: __( 'Hourly booking', 'booking-suite' ),
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

/**
 * Where a booking stands financially, in one line.
 *
 * The figure the operator needs is not "how much was paid" but "how much is
 * missing" or "how much is spare" — a number they act on, in the sentence that
 * says what to do about it. The arithmetic is the server's; this only draws it,
 * so the screen and the status badge can never disagree.
 *
 * @param {Object} props
 * @param {Object} props.settlement From the booking payload.
 * @param {string} props.currency
 */
function Settlement( { settlement, currency } ) {
	if ( ! settlement ) {
		return null;
	}

	const { state, outstanding, overpaid, paid } = settlement;

	if ( 'unpaid' === state ) {
		return null;
	}

	if ( 'partial' === state ) {
		return (
			<p className="bks-settlement bks-settlement--partial">
				{ sprintf(
					/* translators: %s: the amount still owed, with currency. */
					__( 'Partially paid — outstanding: %s', 'booking-suite' ),
					formatMoney( outstanding, currency )
				) }
			</p>
		);
	}

	if ( 'overpaid' === state ) {
		return (
			<p className="bks-settlement bks-settlement--overpaid">
				{ sprintf(
					/* translators: %s: how much too much came in, with currency. */
					__( 'Overpayment — difference: %s', 'booking-suite' ),
					formatMoney( overpaid, currency )
				) }
			</p>
		);
	}

	return (
		<p className="bks-settlement bks-settlement--paid">
			{ sprintf(
				/* translators: %s: the amount received, with currency. */
				__( 'Paid in full — %s received', 'booking-suite' ),
				formatMoney( paid, currency )
			) }
		</p>
	);
}

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

	/** Whether the "this changes the tax treatment" warning is open. */
	const [ typeChange, setTypeChange ] = useState( false );

	/** Whether the "money has arrived" dialog is open. */
	const [ recordOpen, setRecordOpen ] = useState( false );

	/** The invoice dialog: whether it is open, the rate it will use, the result. */
	const [ invoiceOpen, setInvoiceOpen ] = useState( false );
	const [ invoiceRate, setInvoiceRate ] = useState( null );
	const [ invoice, setInvoice ] = useState( null );

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
	const payments = booking.payments ?? [];
	const history = booking.history ?? [];

	// The list row carries the receipt; the detail fetch adds the payment row
	// it belongs to, which knows when the guest says they paid.
	const payment = payments.find( ( row ) => row.proof );
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

	/**
	 * The rates the invoice may be drawn at.
	 *
	 * Named, not typed in. The operator is picking a tax treatment, and the two
	 * that exist are the two the settings define — a free-text box would invite
	 * a rate the business does not use, on a document that cannot be reissued.
	 * The third entry only appears where the settings carry a general rate that
	 * is neither of them.
	 */
	const taxOptions = booking.taxOptions ?? {};

	const taxChoices = [
		{
			key: 'overnight',
			rate: taxOptions.overnight,
			label: TYPE_LABELS.overnight,
			hint: __( 'Accommodation', 'booking-suite' ),
		},
		{
			key: 'hourly',
			rate: taxOptions.hourly,
			label: TYPE_LABELS.hourly,
			hint: __( 'Everything else', 'booking-suite' ),
		},
	].filter( ( choice ) => undefined !== choice.rate && null !== choice.rate );

	// What the dialog opens on: the rate this booking's own type calls for.
	const chosenRate = invoiceRate ?? taxOptions.current ?? taxChoices[ 0 ]?.rate;

	/**
	 * Flip the booking between its two kinds.
	 *
	 * Only reachable from behind the warning, because the type is what sets the
	 * VAT: changing it changes what an invoice drawn afterwards will say the
	 * guest owed.
	 */
	const changeType = async () => {
		const next =
			'overnight' === booking.bookingType ? 'hourly' : 'overnight';

		setBusyAction( 'type' );
		setError( null );
		setTypeChange( false );

		try {
			const updated = await bookingService.update( booking.id, {
				bookingType: next,
			} );

			setBooking( ( current ) => ( { ...current, ...updated } ) );
			onUpdated?.( updated );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyAction( '' );
		}
	};

	/** Draw the invoice at whichever rate the dialog is showing. */
	const createInvoice = async () => {
		setBusyAction( 'invoice' );
		setError( null );

		try {
			const drawn = await bookingService.invoice( booking.id, invoiceRate );

			setInvoice( drawn );

			// The payment row now carries a number and a rate; reload so the
			// payments card shows them instead of claiming there are none.
			const full = await bookingService.get( booking.id );

			setBooking( ( current ) => ( { ...current, ...full } ) );
			onUpdated?.( full );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyAction( '' );
		}
	};

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

					{ /*
					 * Which of the two kinds this booking is. On screen because
					 * it decides the VAT on the invoice — an operator drawing
					 * one up should not have to infer it from the dates.
					 */ }
					{ booking.bookingType && (
						<Badge variant="outline">
							{ TYPE_LABELS[ booking.bookingType ] ??
								label( booking.bookingType ) }
						</Badge>
					) }
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
							<Settlement
								settlement={ booking.settlement }
								currency={ booking.currency }
							/>
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

						{ /*
						 * Changing the type is deliberately a two-step action.
						 * It decides the VAT on the invoice, so flipping it
						 * quietly would change what the guest is held to have
						 * owed — the dialog says so before anything moves.
						 */ }
						{ booking.bookingType && (
							<Button
								variant="outline"
								disabled={ isBusy }
								onClick={ () => setTypeChange( true ) }
							>
								<Repeat className="h-4 w-4" />
								{ 'overnight' === booking.bookingType
									? __(
											'Change to hourly',
											'booking-suite'
									  )
									: __(
											'Change to overnight',
											'booking-suite'
									  ) }
							</Button>
						) }

						{ /*
						 * The invoice is drawn on request and never on its own,
						 * because the operator chooses which VAT treatment
						 * applies before a number is assigned to it.
						 */ }
						<Button
							variant="outline"
							disabled={ isBusy }
							onClick={ () => setRecordOpen( true ) }
						>
							<BadgeEuro className="h-4 w-4" />
							{ __( 'Record a payment', 'booking-suite' ) }
						</Button>

						<Button
							variant="outline"
							disabled={ isBusy }
							onClick={ () => setInvoiceOpen( true ) }
						>
							<FileText className="h-4 w-4" />
							{ __( 'Create invoice', 'booking-suite' ) }
						</Button>

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

			<BookingPayments
				payments={ payments }
				currency={ booking.currency }
			/>

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

			<BookingHistory history={ history } currency={ booking.currency } />

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

			{ /*
			 * Recording money. Reloads rather than patching state by hand: one
			 * payment moves the settlement line, the payment badge and the
			 * payment history, and three hand-updates are three chances for the
			 * screen to disagree with the database.
			 */ }
			<RecordPaymentDialog
				open={ recordOpen }
				onOpenChange={ setRecordOpen }
				booking={ booking }
				onRecorded={ async () => {
					const full = await bookingService.get( booking.id );

					setBooking( ( current ) => ( { ...current, ...full } ) );
					onUpdated?.( full );
				} }
			/>

			{ /*
			 * Changing the type. The warning is the whole reason this is a
			 * dialog and not a toggle: the type decides the VAT, so flipping it
			 * silently would change what the booking is recorded as owing.
			 */ }
			<AlertDialog open={ typeChange } onOpenChange={ setTypeChange }>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ __(
								'This changes the tax treatment',
								'booking-suite'
							) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ sprintf(
								/* translators: 1: the current booking type, 2: the type it would become. */
								__(
									'This booking is filed as “%1$s”. Filing it as “%2$s” instead changes the VAT rate its invoice is drawn at. Any invoice already issued keeps the rate it was issued with.',
									'booking-suite'
								),
								TYPE_LABELS[ booking.bookingType ] ?? '',
								TYPE_LABELS[
									'overnight' === booking.bookingType
										? 'hourly'
										: 'overnight'
								] ?? ''
							) }
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Leave it as it is', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction onClick={ changeType }>
							{ __( 'Change the type', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{ /* The invoice, and the rate it is drawn at. */ }
			<Dialog
				open={ invoiceOpen }
				onOpenChange={ ( next ) => {
					setInvoiceOpen( next );

					if ( ! next ) {
						setInvoice( null );
						setInvoiceRate( null );
					}
				} }
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{ __( 'Create invoice', 'booking-suite' ) }
						</DialogTitle>
						<DialogDescription>
							{ invoice
								? __(
										'The invoice has been issued. Its number and rate are fixed from here on.',
										'booking-suite'
								  )
								: __(
										'Pick the VAT treatment. It is written onto the invoice and kept, so the same document prints the same way later even if the rates change.',
										'booking-suite'
								  ) }
						</DialogDescription>
					</DialogHeader>

					{ invoice ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-card-foreground">
								{ sprintf(
									/* translators: 1: the invoice number, 2: the VAT rate as a percentage. */
									__(
										'Invoice %1$s, drawn at %2$s%% VAT.',
										'booking-suite'
									),
									invoice.invoiceNo,
									invoice.taxRate
								) }
							</p>

							{ invoice.url && (
								<Button asChild variant="outline">
									<a
										href={ invoice.url }
										target="_blank"
										rel="noreferrer"
									>
										{ __(
											'Open the invoice',
											'booking-suite'
										) }
									</a>
								</Button>
							) }
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{ taxChoices.map( ( choice ) => (
								<label
									key={ choice.key }
									className="bks-taxpick"
									data-selected={
										choice.rate === chosenRate
											? 'true'
											: 'false'
									}
								>
									<input
										type="radio"
										name="bks-invoice-rate"
										className="bks-taxpick__input"
										checked={ choice.rate === chosenRate }
										onChange={ () =>
											setInvoiceRate( choice.rate )
										}
									/>
									<span className="bks-taxpick__body">
										<span className="bks-taxpick__label">
											{ choice.label }
										</span>
										{ choice.hint && (
											<span className="bks-taxpick__hint">
												{ choice.hint }
											</span>
										) }
									</span>
									<span className="bks-taxpick__rate">
										{ sprintf(
											/* translators: %s: a VAT rate. */
											__( '%s%%', 'booking-suite' ),
											choice.rate
										) }
									</span>
								</label>
							) ) }

							<Button
								disabled={ isBusy }
								onClick={ createInvoice }
							>
								{ 'invoice' === busyAction
									? __( 'Creating…', 'booking-suite' )
									: __(
											'Create the invoice',
											'booking-suite'
									  ) }
							</Button>
						</div>
					) }
				</DialogContent>
			</Dialog>
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
