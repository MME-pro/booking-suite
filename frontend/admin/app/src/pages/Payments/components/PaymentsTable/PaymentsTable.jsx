/**
 * PaymentsTable — the ledger, in whichever shape the screen can hold.
 *
 * A table from `lg` up, cards below it, matching the Bookings and Customers
 * lists. Both are rendered and one is hidden by CSS rather than switching on a
 * measured width, which would flash the wrong layout before the first paint.
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Eye, Receipt } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
import { PAYMENT_STATUS_CLASSES, label } from '../../data/status';
import { PaymentCard } from '../PaymentCard';

export default function PaymentsTable( {
	payments,
	onView,
	onMarkPaid,
	busyId = null,
	emptyContent = null,
} ) {
	if ( ! payments.length && emptyContent ) {
		return <Card className="overflow-hidden">{ emptyContent }</Card>;
	}

	return (
		<>
			{ /*
			 * Cards below 1024px, the ledger above it. Method and received-date
			 * are the columns the table gives up first, and they are most of
			 * what separates one payment from another once the amount is known.
			 */ }
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
				{ payments.map( ( payment ) => (
					<PaymentCard
						key={ payment.id }
						payment={ payment }
						onView={ onView }
						onMarkPaid={ onMarkPaid }
						busyId={ busyId }
					/>
				) ) }
			</div>

			<Card className="hidden overflow-hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-[150px]">
								{ __( 'Booking', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Guest', 'booking-suite' ) }
							</TableHead>
							<TableHead>
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
													__(
														'Guest',
														'booking-suite'
													) }
											</span>
											{ payment.customerEmail && (
												<span className="truncate text-xs text-muted-foreground">
													{ payment.customerEmail }
												</span>
											) }
										</div>
									</TableCell>

									<TableCell className="capitalize">
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
												PAYMENT_STATUS_CLASSES[
													payment.status
												] ?? ''
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
												onClick={ () =>
													onView( payment )
												}
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
			</Card>
		</>
	);
}
