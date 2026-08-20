/**
 * PaymentCard — one payment, for screens too narrow to hold the ledger.
 *
 * The table drops method and received-date before it reaches a phone, which is
 * most of what distinguishes one payment from another once the amount is known.
 * The card keeps both, and keeps the receipt marker with the method it belongs
 * to rather than leaving it behind with the column.
 *
 * As on the other card views, the whole card is the target for the thing this
 * screen mainly does — opening the payment — so there is no button repeating
 * it. Marking as paid is the one action that changes something, and it appears
 * only while it still applies.
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { CardField } from '../../../../components/CardField';
import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
import { PAYMENT_STATUS_CLASSES, label } from '../../data/status';

export default function PaymentCard( {
	payment,
	onView,
	onMarkPaid = null,
	busyId = null,
} ) {
	const isBusy = busyId === payment.id;
	const isPaid = 'paid' === payment.status;
	const reference = payment.bookingReference || `#${ payment.bookingId }`;

	const showMarkPaid = Boolean( onMarkPaid ) && ! isPaid;

	const open = () => onView( payment );

	return (
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
				__( 'View payment for %s', 'booking-suite' ),
				reference
			) }
			className="flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex items-start gap-2.5">
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium leading-tight text-card-foreground">
						{ payment.customerName ||
							__( 'Guest', 'booking-suite' ) }
					</span>
					<span className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
						{ reference }
						{ payment.invoiceNo && ` · ${ payment.invoiceNo }` }
					</span>
				</div>

				<Badge
					variant="secondary"
					className={ `shrink-0 capitalize ${
						PAYMENT_STATUS_CLASSES[ payment.status ] ?? ''
					}` }
				>
					{ label( payment.status ) }
				</Badge>
			</div>

			{ payment.customerEmail && (
				<a
					href={ `mailto:${ payment.customerEmail }` }
					onClick={ ( event ) => event.stopPropagation() }
					className="min-w-0 truncate text-xs text-muted-foreground hover:text-primary hover:underline"
				>
					{ payment.customerEmail }
				</a>
			) }

			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-2.5">
				<CardField title={ __( 'Method', 'booking-suite' ) }>
					<span className="flex min-w-0 flex-wrap items-center gap-1.5">
						<span className="truncate capitalize">
							{ label( payment.method ) }
						</span>

						{ /*
						 * The receipt marker travels with the method rather than
						 * with the column it used to live in: on a phone it is
						 * the difference between a payment that can be checked
						 * and one that has to be chased.
						 */ }
						{ payment.proof && (
							<span
								title={ __(
									'Payment receipt uploaded',
									'booking-suite'
								) }
								className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
							>
								<Receipt
									aria-hidden="true"
									className="h-3 w-3"
								/>
								{ __( 'Receipt', 'booking-suite' ) }
							</span>
						) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Received', 'booking-suite' ) }
					className="text-right"
				>
					<span className="text-xs tabular-nums">
						{ payment.paidAt ? (
							formatDateTime( payment.paidAt )
						) : (
							<span className="text-muted-foreground">—</span>
						) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Amount', 'booking-suite' ) }
					className="col-span-2"
				>
					<span className="text-base font-semibold tabular-nums">
						{ formatMoney( payment.amount, payment.currency ) }
					</span>
				</CardField>
			</div>

			{ showMarkPaid && (
				<div
					className="flex items-center border-t pt-2.5"
					onClick={ ( event ) => event.stopPropagation() }
					role="presentation"
				>
					<Button
						size="sm"
						variant="outline"
						className="min-w-0 flex-1 px-2 text-xs text-success hover:text-success"
						disabled={ isBusy }
						onClick={ () => onMarkPaid( payment ) }
					>
						<BadgeEuro className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">
							{ __( 'Mark as paid', 'booking-suite' ) }
						</span>
					</Button>
				</div>
			) }
		</div>
	);
}
