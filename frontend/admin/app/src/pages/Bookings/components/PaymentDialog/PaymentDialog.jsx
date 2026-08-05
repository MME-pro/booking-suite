/**
 * PaymentDialog — the payment side of one booking, without leaving the list.
 *
 * The list row already carries the receipt the guest uploaded, so the dialog
 * opens with something to show; anything the row cannot know (the payment row
 * behind the receipt, and when the guest says they paid) is fetched behind it.
 */

import { useEffect, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';

import { bookingService } from '../../../../services';
import { formatDateTime, formatMoney } from '../../data/format';

const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function PaymentDialog( {
	booking: initial,
	onClose,
	onMarkPaid,
} ) {
	const [ booking, setBooking ] = useState( initial );
	const [ isLoading, setLoading ] = useState( true );

	useEffect( () => {
		const controller = new AbortController();

		bookingService
			.get( initial.id, controller.signal )
			.then( ( full ) => setBooking( { ...initial, ...full } ) )
			.catch( () => {
				// The row we were handed is still worth showing on its own.
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [ initial ] );

	const payment = ( booking.payments ?? [] ).find( ( row ) => row.proof );
	const proof = payment?.proof ?? booking.paymentProof ?? null;
	const isPaid = 'paid' === booking.paymentStatus;

	return (
		<Dialog open onOpenChange={ ( next ) => ! next && onClose() }>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{ __( 'Payment', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ booking.reference || `#${ booking.id }` } ·{ ' ' }
						{ booking.customerName ||
							__( 'Guest', 'booking-suite' ) }
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-muted-foreground">
							{ __( 'Status', 'booking-suite' ) }
						</span>
						<Badge
							variant="secondary"
							className={ `capitalize ${
								PAYMENT_CLASSES[ booking.paymentStatus ] ?? ''
							}` }
						>
							{ label( booking.paymentStatus ) }
						</Badge>
					</div>

					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-muted-foreground">
							{ __( 'Total', 'booking-suite' ) }
						</span>
						<strong className="text-lg font-semibold tabular-nums text-card-foreground">
							{ formatMoney( booking.total, booking.currency ) }
						</strong>
					</div>

					{ payment?.paidAt && (
						<div className="flex items-center justify-between gap-4">
							<span className="text-sm text-muted-foreground">
								{ __( 'Guest paid on', 'booking-suite' ) }
							</span>
							<span className="text-sm text-card-foreground">
								{ formatDateTime( payment.paidAt ) }
							</span>
						</div>
					) }

					<Separator />

					<div className="flex flex-col gap-2">
						<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{ __( 'Payment proof', 'booking-suite' ) }
						</span>

						{ isLoading && ! proof && (
							<Skeleton className="h-40 w-full" />
						) }

						{ ! isLoading && ! proof && (
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

				<DialogFooter>
					<Button type="button" variant="outline" onClick={ onClose }>
						{ __( 'Close', 'booking-suite' ) }
					</Button>
					{ ! isPaid && (
						<Button
							type="button"
							onClick={ () => onMarkPaid( booking ) }
						>
							{ __( 'Mark as paid', 'booking-suite' ) }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
