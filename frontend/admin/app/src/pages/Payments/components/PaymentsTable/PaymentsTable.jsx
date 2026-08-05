/**
 * PaymentsTable — the ledger, on the shadcn/ui Table primitives.
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Eye, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { formatDateTime, formatMoney } from '../../../Bookings/data/format';

const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	failed: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function PaymentsTable( {
	payments,
	onView,
	onMarkPaid,
	busyId = null,
	emptyContent = null,
} ) {
	if ( ! payments.length && emptyContent ) {
		return emptyContent;
	}

	return (
		<div className="w-full overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-[150px]">
							{ __( 'Booking', 'booking-suite' ) }
						</TableHead>
						<TableHead>
							{ __( 'Guest', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden lg:table-cell">
							{ __( 'Method', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden xl:table-cell">
							{ __( 'Received', 'booking-suite' ) }
						</TableHead>
						<TableHead className="text-right">
							{ __( 'Amount', 'booking-suite' ) }
						</TableHead>
						<TableHead>
							{ __( 'Status', 'booking-suite' ) }
						</TableHead>
						<TableHead className="w-[130px] text-right">
							{ __( 'Actions', 'booking-suite' ) }
						</TableHead>
					</TableRow>
				</TableHeader>

				<TableBody>
					{ payments.map( ( payment ) => {
						const isBusy = busyId === payment.id;
						const isPaid = 'paid' === payment.status;

						return (
							<TableRow
								key={ payment.id }
								onClick={ () => onView( payment ) }
								className="cursor-pointer"
							>
								<TableCell className="font-medium tabular-nums">
									<div className="flex flex-col">
										<span>
											{ payment.bookingReference ||
												`#${ payment.bookingId }` }
										</span>
										{ payment.invoiceNo && (
											<span className="text-xs font-normal text-muted-foreground">
												{ payment.invoiceNo }
											</span>
										) }
									</div>
								</TableCell>

								<TableCell>
									<div className="flex min-w-0 flex-col">
										<span className="truncate font-medium text-card-foreground">
											{ payment.customerName ||
												__( 'Guest', 'booking-suite' ) }
										</span>
										{ payment.customerEmail && (
											<span className="truncate text-xs text-muted-foreground">
												{ payment.customerEmail }
											</span>
										) }
									</div>
								</TableCell>

								<TableCell className="hidden capitalize lg:table-cell">
									<span className="flex items-center gap-1.5">
										{ label( payment.method ) }
										{ payment.proof && (
											<span
												title={ __(
													'Payment receipt uploaded',
													'booking-suite'
												) }
												className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
											>
												<Receipt className="h-3 w-3" />
												{ __(
													'Receipt',
													'booking-suite'
												) }
											</span>
										) }
									</span>
								</TableCell>

								<TableCell className="hidden text-xs xl:table-cell">
									{ payment.paidAt
										? formatDateTime( payment.paidAt )
										: '—' }
								</TableCell>

								<TableCell className="text-right font-semibold tabular-nums">
									{ formatMoney(
										payment.amount,
										payment.currency
									) }
								</TableCell>

								<TableCell>
									<Badge
										variant="secondary"
										className={ `capitalize ${
											STATUS_CLASSES[ payment.status ] ??
											''
										}` }
									>
										{ label( payment.status ) }
									</Badge>
								</TableCell>

								<TableCell className="text-right">
									<div
										className="flex items-center justify-end gap-1"
										onClick={ ( event ) =>
											event.stopPropagation()
										}
										role="presentation"
									>
										{ ! isPaid && (
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8 text-success hover:text-success"
												disabled={ isBusy }
												onClick={ () =>
													onMarkPaid( payment )
												}
												title={ __(
													'Mark as paid',
													'booking-suite'
												) }
											>
												<BadgeEuro className="h-4 w-4" />
												<span className="sr-only">
													{ sprintf(
														/* translators: %s: booking reference. */
														__(
															'Mark payment for %s as paid',
															'booking-suite'
														),
														payment.bookingReference ||
															payment.bookingId
													) }
												</span>
											</Button>
										) }

										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8"
											onClick={ () => onView( payment ) }
											title={ __(
												'View payment',
												'booking-suite'
											) }
										>
											<Eye className="h-4 w-4" />
											<span className="sr-only">
												{ __(
													'View payment',
													'booking-suite'
												) }
											</span>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					} ) }
				</TableBody>
			</Table>
		</div>
	);
}
