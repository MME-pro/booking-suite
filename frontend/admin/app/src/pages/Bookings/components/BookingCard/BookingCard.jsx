/**
 * BookingCard — one booking, for screens too narrow to hold the table.
 *
 * A table below about 1024px has only bad options: scroll it sideways, which
 * hides the columns an operator is looking for, or drop columns, which hides
 * the data outright. The card takes the third way — the row is re-laid out top
 * to bottom, and nothing is left out. Everything the widest table shows is
 * here, including the stay dates and payment state the table gives up first.
 *
 * The body is a two-column grid, and the pairs are chosen rather than merely
 * fitted: apartment beside guests, check-in beside check-out, total beside what
 * has been paid of it. Each row answers one question, which is what makes the
 * card scannable at a glance instead of a list to read down.
 *
 * Splitting the stay into two columns is the change that pays for itself twice
 * — it is the natural shape for a pair of dates, and it removes the full-width
 * block that made the card tall.
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Check, CreditCard, Receipt, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { CardField } from '../../../../components/CardField';
import { formatDateTime, formatMoney } from '../../data/format';
import {
	PAYMENT_CLASSES,
	STATUS_CLASSES,
	canApprove,
	initialsOf,
	label,
} from '../../data/status';

export default function BookingCard( {
	booking,
	onSelectBooking,
	onApprove = null,
	onMarkPaid = null,
	onViewPayment = null,
	onDelete = null,
	busyId = null,
	tag = null,
} ) {
	const hasProof = Boolean( booking.paymentProof );
	const isBusy = busyId === booking.id;
	const reference = booking.reference || `#${ booking.id }`;

	/*
	 * Each action needs both a handler and a reason to exist. The Bookings list
	 * passes all three; the Calendar's day panel passes none, because the only
	 * thing it offers is opening the booking — and a row of dead buttons would
	 * be worse than no row. Deciding here rather than at each call site means
	 * the footer border and padding come and go with the buttons.
	 */
	const showApprove = Boolean( onApprove ) && canApprove( booking );
	const showMarkPaid =
		Boolean( onMarkPaid ) && 'paid' !== booking.paymentStatus;
	const showPayment = Boolean( onViewPayment );
	const showDelete = Boolean( onDelete );
	const hasActions = showApprove || showMarkPaid || showPayment || showDelete;

	const open = () => onSelectBooking( booking );

	const stopPropagation = ( event ) => event.stopPropagation();

	return (
		/*
		 * The card opens the booking, exactly as the table row does. A div with
		 * a role rather than a <button>, because it contains links and buttons
		 * of its own and HTML does not allow those inside a button.
		 *
		 * That also removes the need for a "Details" action: the whole card is
		 * the target, so a button repeating it would only take up a row.
		 */
		<div
			role="button"
			tabIndex={ 0 }
			onClick={ open }
			onKeyDown={ ( event ) => {
				if ( 'Enter' === event.key || ' ' === event.key ) {
					event.preventDefault();
					open();
				}
			} }
			aria-label={ sprintf(
				/* translators: %s: booking reference. */
				__( 'Open booking %s', 'booking-suite' ),
				reference
			) }
			className="flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{ /*
			 * Reference, guest and status on one line. The avatar carries the
			 * identity, so the name can sit beside it rather than under it, and
			 * the whole header costs one row instead of three.
			 */ }
			<div className="flex items-center gap-2.5">
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
					{ initialsOf( booking.customerName ) }
				</span>

				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium leading-tight text-card-foreground">
						{ booking.customerName ||
							__( 'Guest', 'booking-suite' ) }
					</span>
					<span className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
						{ reference }
					</span>
				</div>

				{ /*
				 * `tag` is whatever the screen showing this card needs said
				 * about it that the booking itself does not carry. The Calendar
				 * puts "Arrives" or "Departs" here — which is the whole point
				 * of looking at a particular day, and is lost if the card only
				 * repeats the fields.
				 */ }
				<div className="flex shrink-0 flex-col items-end gap-1">
					<Badge
						variant="secondary"
						className={ `capitalize ${
							STATUS_CLASSES[ booking.status ] ?? ''
						}` }
					>
						{ label( booking.status ) }
					</Badge>
					{ tag }
				</div>
			</div>

			{ /*
			 * Contact stays out of the grid: these are links, not values to
			 * compare, and on the device most likely to be showing a card the
			 * phone number is what starts the call.
			 */ }
			{ ( booking.customerEmail || booking.customerPhone ) && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					{ booking.customerEmail && (
						<a
							href={ `mailto:${ booking.customerEmail }` }
							onClick={ stopPropagation }
							className="min-w-0 truncate text-muted-foreground hover:text-primary hover:underline"
						>
							{ booking.customerEmail }
						</a>
					) }

					{ booking.customerPhone && (
						<a
							href={ `tel:${ booking.customerPhone }` }
							onClick={ stopPropagation }
							className="shrink-0 text-muted-foreground hover:text-primary hover:underline"
						>
							{ booking.customerPhone }
						</a>
					) }
				</div>
			) }

			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-2.5">
				<CardField title={ __( 'Apartment', 'booking-suite' ) }>
					{ booking.apartmentName ? (
						<span className="block truncate font-medium">
							{ booking.apartmentName }
						</span>
					) : (
						<em className="text-muted-foreground">
							{ __( 'Deleted', 'booking-suite' ) }
						</em>
					) }
				</CardField>

				<CardField
					title={ __( 'Guests', 'booking-suite' ) }
					className="text-right"
				>
					<span className="tabular-nums">
						{ booking.guests || 1 }
					</span>
				</CardField>

				{ /*
				 * The two ends of the stay, side by side. This is the first
				 * column the table gives up, and on a phone it is usually the
				 * thing being looked up in the first place.
				 */ }
				<CardField title={ __( 'Check-in', 'booking-suite' ) }>
					<span className="text-xs tabular-nums">
						{ formatDateTime( booking.startsAt ) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Check-out', 'booking-suite' ) }
					className="text-right"
				>
					<span className="text-xs tabular-nums">
						{ formatDateTime( booking.endsAt ) }
					</span>
				</CardField>

				<CardField title={ __( 'Total', 'booking-suite' ) }>
					<span className="font-semibold tabular-nums">
						{ formatMoney( booking.total, booking.currency ) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Payment', 'booking-suite' ) }
					className="items-end text-right"
				>
					<div className="flex flex-wrap items-center justify-end gap-1">
						<Badge
							variant="secondary"
							className={ `capitalize ${
								PAYMENT_CLASSES[ booking.paymentStatus ] ?? ''
							}` }
						>
							{ label( booking.paymentStatus ) }
						</Badge>

						{ hasProof && (
							<span
								title={ __(
									'Payment receipt screenshot uploaded',
									'booking-suite'
								) }
								className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
							>
								<Receipt
									aria-hidden="true"
									className="h-3 w-3"
								/>
								{ __( 'Receipt', 'booking-suite' ) }
							</span>
						) }
					</div>
				</CardField>
			</div>

			{ /*
			 * One row that always fills, whatever this booking offers. A card
			 * shows three actions, two or one depending on its status and
			 * whether it is paid — a fixed three-column grid would leave a
			 * settled booking with a single button in a third of the width and
			 * two thirds of nothing. Equal flex shares divide whatever is
			 * actually there, and nothing wraps, so no card ends on a ragged
			 * half-row.
			 */ }
			{ hasActions && (
				<div
					className="flex items-center gap-1.5 border-t pt-2.5"
					onClick={ stopPropagation }
					role="presentation"
				>
					{ showApprove && (
						<Button
							size="sm"
							variant="outline"
							className="min-w-0 flex-1 px-2 text-xs text-success hover:text-success"
							disabled={ isBusy }
							onClick={ () => onApprove( booking ) }
						>
							<Check className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">
								{ __( 'Approve', 'booking-suite' ) }
							</span>
						</Button>
					) }

					{ showMarkPaid && (
						<Button
							size="sm"
							variant="outline"
							className="min-w-0 flex-1 px-2 text-xs"
							disabled={ isBusy }
							onClick={ () => onMarkPaid( booking ) }
						>
							<BadgeEuro className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">
								{ __( 'Mark paid', 'booking-suite' ) }
							</span>
						</Button>
					) }

					{ showPayment && (
						<Button
							size="sm"
							variant="outline"
							className="min-w-0 flex-1 px-2 text-xs"
							onClick={ () => onViewPayment( booking ) }
						>
							<CreditCard className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">
								{ __( 'Payment', 'booking-suite' ) }
							</span>
						</Button>
					) }

					{ /*
					 * The one action here that takes no share of the row. The
					 * others are things an operator does all day and want their
					 * words; this one is reached for rarely, must not be hit by
					 * accident on a phone, and would push the useful buttons
					 * into a quarter of the width if it claimed a quarter.
					 */ }
					{ showDelete && (
						<Button
							size="sm"
							variant="ghost"
							className="h-8 w-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
							disabled={ isBusy }
							onClick={ () => onDelete( booking ) }
							title={ __( 'Delete booking', 'booking-suite' ) }
						>
							<Trash2 className="h-3.5 w-3.5" />
							<span className="sr-only">
								{ __( 'Delete booking', 'booking-suite' ) }
							</span>
						</Button>
					) }
				</div>
			) }
		</div>
	);
}
