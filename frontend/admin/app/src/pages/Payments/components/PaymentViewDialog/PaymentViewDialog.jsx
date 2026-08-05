/**
 * PaymentViewDialog — one payment in full, with the moves available on it.
 *
 * Everything shown comes from the row the table already has, so the dialog
 * opens complete and does no fetching of its own.
 */

import { __ } from '@wordpress/i18n';
import { ExternalLink, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import { formatDateTime, formatMoney } from '../../../Bookings/data/format';

const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	failed: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function PaymentViewDialog( {
	payment,
	onClose,
	onSetStatus,
	isBusy = false,
} ) {
	const { proof } = payment;

	return (
		<Dialog open onOpenChange={ ( next ) => ! next && onClose() }>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{ __( 'Payment', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ payment.bookingReference ||
							`#${ payment.bookingId }` }{ ' ' }
						·{ ' ' }
						{ payment.customerName ||
							__( 'Guest', 'booking-suite' ) }
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					<Fact term={ __( 'Status', 'booking-suite' ) }>
						<Badge
							variant="secondary"
							className={ `capitalize ${
								STATUS_CLASSES[ payment.status ] ?? ''
							}` }
						>
							{ label( payment.status ) }
						</Badge>
					</Fact>

					<Fact term={ __( 'Amount', 'booking-suite' ) }>
						<strong className="text-lg font-semibold tabular-nums text-card-foreground">
							{ formatMoney( payment.amount, payment.currency ) }
						</strong>
					</Fact>

					<Fact term={ __( 'Booking total', 'booking-suite' ) }>
						<span className="tabular-nums">
							{ formatMoney(
								payment.bookingTotal,
								payment.currency
							) }
						</span>
					</Fact>

					<Fact term={ __( 'Method', 'booking-suite' ) }>
						<span className="capitalize">
							{ label( payment.method ) }
						</span>
					</Fact>

					{ payment.invoiceNo && (
						<Fact term={ __( 'Invoice', 'booking-suite' ) }>
							<span className="tabular-nums">
								{ payment.invoiceNo }
							</span>
						</Fact>
					) }

					{ payment.reference && (
						<Fact term={ __( 'Reference', 'booking-suite' ) }>
							<span>{ payment.reference }</span>
						</Fact>
					) }

					<Fact term={ __( 'Received', 'booking-suite' ) }>
						<span>
							{ payment.paidAt
								? formatDateTime( payment.paidAt )
								: __( 'Not yet', 'booking-suite' ) }
						</span>
					</Fact>

					<Fact term={ __( 'Recorded', 'booking-suite' ) }>
						<span>{ formatDateTime( payment.createdAt ) }</span>
					</Fact>

					{ payment.notes && (
						<>
							<Separator />
							<p className="whitespace-pre-line text-sm text-muted-foreground">
								{ payment.notes }
							</p>
						</>
					) }

					<Separator />

					<div className="flex flex-col gap-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{ __( 'Payment proof', 'booking-suite' ) }
						</span>

						{ ! proof && (
							<p className="text-sm text-muted-foreground">
								{ __(
									'The guest has not uploaded a receipt.',
									'booking-suite'
								) }
							</p>
						) }

						{ proof && proof.mime?.startsWith( 'image/' ) && (
							<a
								href={ proof.url }
								target="_blank"
								rel="noreferrer"
								className="block overflow-hidden rounded-lg border"
							>
								<img
									src={ proof.url }
									alt={ __(
										'Payment receipt uploaded by the guest',
										'booking-suite'
									) }
									className="max-h-72 w-full object-contain"
								/>
							</a>
						) }

						{ proof && ! proof.mime?.startsWith( 'image/' ) && (
							<Button asChild variant="outline" className="w-fit">
								<a
									href={ proof.url }
									target="_blank"
									rel="noreferrer"
								>
									<Receipt className="h-4 w-4" />
									{ __(
										'Open uploaded receipt',
										'booking-suite'
									) }
								</a>
							</Button>
						) }

						{ proof && (
							<a
								href={ proof.url }
								target="_blank"
								rel="noreferrer"
								className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:underline"
							>
								<ExternalLink className="h-3 w-3" />
								{ __( 'Open in a new tab', 'booking-suite' ) }
							</a>
						) }
					</div>
				</div>

				<DialogFooter className="flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={ onClose }
						disabled={ isBusy }
					>
						{ __( 'Close', 'booking-suite' ) }
					</Button>

					{ 'refunded' !== payment.status && (
						<Button
							type="button"
							variant="outline"
							disabled={ isBusy }
							onClick={ () => onSetStatus( payment, 'refunded' ) }
						>
							{ __( 'Mark refunded', 'booking-suite' ) }
						</Button>
					) }

					{ 'failed' !== payment.status &&
						'paid' !== payment.status && (
							<Button
								type="button"
								variant="outline"
								disabled={ isBusy }
								onClick={ () =>
									onSetStatus( payment, 'failed' )
								}
							>
								{ __( 'Mark failed', 'booking-suite' ) }
							</Button>
						) }

					{ 'paid' !== payment.status && (
						<Button
							type="button"
							disabled={ isBusy }
							onClick={ () => onSetStatus( payment, 'paid' ) }
						>
							{ __( 'Mark as paid', 'booking-suite' ) }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Fact( { term, children } ) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-sm text-muted-foreground">{ term }</span>
			<span className="text-right text-sm text-card-foreground">
				{ children }
			</span>
		</div>
	);
}
