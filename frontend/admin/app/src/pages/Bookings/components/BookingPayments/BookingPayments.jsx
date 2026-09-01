/**
 * Every payment recorded against one booking.
 *
 * The detail screen used to show a single payment — whichever one carried the
 * guest's uploaded receipt — and nothing else. That is fine while a booking is
 * paid once, and wrong the moment it is not: amend a booking's price and the
 * plugin raises a balance, settles it, issues an invoice number for it, and
 * every one of those was invisible here. An operator asking "what has this
 * guest actually paid me" had to go to the Payments screen and filter.
 *
 * So the whole ledger is shown, newest first, with what was settled and what is
 * still outstanding totalled underneath. Refunds are stored as negative
 * amounts, so the sums net off rather than double-counting.
 */

import { __ } from '@wordpress/i18n';
import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { formatDateTime, formatMoney } from '../../data/format';

/** Matches PaymentsTable::STATUSES. */
const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	failed: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const STATUS_LABELS = {
	pending: __( 'Awaiting payment', 'booking-suite' ),
	paid: __( 'Settled', 'booking-suite' ),
	failed: __( 'Failed', 'booking-suite' ),
	refunded: __( 'Refunded', 'booking-suite' ),
};

/** Matches PaymentsTable::METHODS. */
const METHOD_LABELS = {
	transfer: __( 'Bank transfer', 'booking-suite' ),
	cash: __( 'Cash', 'booking-suite' ),
	card: __( 'Card', 'booking-suite' ),
};

export default function BookingPayments( { payments = [], currency = 'EUR' } ) {
	if ( 0 === payments.length ) {
		return null;
	}

	const settled = payments
		.filter( ( payment ) => 'paid' === payment.status )
		.reduce( ( sum, payment ) => sum + Number( payment.amount || 0 ), 0 );

	const outstanding = payments
		.filter( ( payment ) => 'pending' === payment.status )
		.reduce( ( sum, payment ) => sum + Number( payment.amount || 0 ), 0 );

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">
					{ __( 'Payment history', 'booking-suite' ) }
				</CardTitle>
			</CardHeader>

			<CardContent className="flex flex-col gap-3 text-sm">
				<ul className="flex flex-col gap-3">
					{ payments.map( ( payment ) => (
						<li
							key={ payment.id }
							className="flex flex-col gap-1 rounded-lg border p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="flex items-center gap-2">
									<span className="font-medium tabular-nums">
										{ formatMoney(
											payment.amount,
											payment.currency || currency
										) }
									</span>
									<Badge
										variant="secondary"
										className={
											STATUS_CLASSES[ payment.status ] ??
											''
										}
									>
										{ STATUS_LABELS[ payment.status ] ??
											payment.status }
									</Badge>
								</span>

								<span className="text-xs text-muted-foreground">
									{ METHOD_LABELS[ payment.method ] ??
										payment.method }
								</span>
							</div>

							<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{ /*
								 * The invoice number is the thing a guest
								 * quotes back on the phone, so it reads at the
								 * same weight as the money.
								 */ }
								{ payment.invoiceNo && (
									<span className="flex items-center gap-1 font-medium text-card-foreground">
										<FileText className="h-3 w-3" />
										{ payment.invoiceNo }
									</span>
								) }

								<span>
									{ __( 'Recorded', 'booking-suite' ) }{ ' ' }
									{ formatDateTime( payment.createdAt ) }
								</span>

								{ payment.paidAt && (
									<span>
										{ __( 'Settled', 'booking-suite' ) }{ ' ' }
										{ formatDateTime( payment.paidAt ) }
									</span>
								) }
							</div>

							{ /*
							 * The note is where the plugin explains itself —
							 * "Balance after the booking was changed" is the
							 * answer to why a second row exists at all.
							 */ }
							{ payment.notes && (
								<p className="text-xs text-muted-foreground">
									{ payment.notes }
								</p>
							) }
						</li>
					) ) }
				</ul>

				<Separator />

				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">
							{ __( 'Settled', 'booking-suite' ) }
						</span>
						<span className="font-medium tabular-nums">
							{ formatMoney( settled, currency ) }
						</span>
					</div>

					{ outstanding > 0 && (
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">
								{ __( 'Still outstanding', 'booking-suite' ) }
							</span>
							<span className="font-medium tabular-nums text-warning">
								{ formatMoney( outstanding, currency ) }
							</span>
						</div>
					) }
				</div>
			</CardContent>
		</Card>
	);
}
