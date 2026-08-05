/**
 * BookingsTable — the bookings list, built on the shadcn/ui Table primitives.
 *
 * Secondary columns fall away as the viewport narrows rather than forcing a
 * horizontal scroll for the columns that matter (reference, guest, status).
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Check, CreditCard, Eye, Receipt } from 'lucide-react';

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

import { formatDateTime, formatMoney } from '../../data/format';

/**
 * Status colours.
 *
 * shadcn's Badge ships four variants; the booking lifecycle needs its own, so
 * these map onto the Booking Suite tokens instead of editing the upstream
 * component, which would be overwritten by the next `shadcn add`.
 */
const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	reserved: 'bg-primary/10 text-primary hover:bg-primary/10',
	confirmed: 'bg-success/10 text-success hover:bg-success/10',
	completed: 'bg-muted text-muted-foreground hover:bg-muted',
};

const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

const initialsOf = ( name ) =>
	( name || 'G' )
		.split( ' ' )
		.map( ( part ) => part[ 0 ] )
		.join( '' )
		.toUpperCase()
		.slice( 0, 2 );

/**
 * A booking is approvable while it is still waiting on the owner.
 *
 * @param {Object} booking The booking row.
 * @return {boolean} Whether Approve applies.
 */
const canApprove = ( booking ) =>
	[ 'pending', 'reserved' ].includes( booking.status );

export default function BookingsTable( {
	bookings,
	onSelectBooking,
	onApprove,
	onMarkPaid,
	onViewPayment,
	busyId = null,
	emptyContent = null,
} ) {
	if ( ! bookings.length && emptyContent ) {
		return emptyContent;
	}

	return (
		<div className="w-full overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-[130px]">
							{ __( 'Reference', 'booking-suite' ) }
						</TableHead>
						<TableHead>
							{ __( 'Guest', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden lg:table-cell">
							{ __( 'Apartment', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden xl:table-cell">
							{ __( 'Stay dates', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden text-center sm:table-cell">
							{ __( 'Guests', 'booking-suite' ) }
						</TableHead>
						<TableHead className="text-right">
							{ __( 'Total', 'booking-suite' ) }
						</TableHead>
						<TableHead>
							{ __( 'Status', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden md:table-cell">
							{ __( 'Payment', 'booking-suite' ) }
						</TableHead>
						<TableHead className="w-[190px] text-right">
							{ __( 'Actions', 'booking-suite' ) }
						</TableHead>
					</TableRow>
				</TableHeader>

				<TableBody>
					{ bookings.map( ( booking ) => {
						const hasProof = Boolean( booking.paymentProof );

						return (
							<TableRow
								key={ booking.id }
								onClick={ () => onSelectBooking( booking ) }
								className="cursor-pointer"
							>
								<TableCell className="font-medium tabular-nums">
									{ booking.reference || `#${ booking.id }` }
								</TableCell>

								<TableCell>
									<div className="flex items-center gap-3">
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
											{ initialsOf(
												booking.customerName
											) }
										</span>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium text-card-foreground">
												{ booking.customerName ||
													__(
														'Guest',
														'booking-suite'
													) }
											</span>
											{ booking.customerEmail && (
												<a
													href={ `mailto:${ booking.customerEmail }` }
													onClick={ ( event ) =>
														event.stopPropagation()
													}
													className="truncate text-xs text-muted-foreground hover:text-primary hover:underline"
												>
													{ booking.customerEmail }
												</a>
											) }
										</div>
									</div>
								</TableCell>

								<TableCell className="hidden lg:table-cell">
									{ booking.apartmentName || (
										<em className="text-muted-foreground">
											{ __(
												'Deleted apartment',
												'booking-suite'
											) }
										</em>
									) }
								</TableCell>

								<TableCell className="hidden xl:table-cell">
									<div className="flex flex-col text-xs">
										<span>
											{ formatDateTime(
												booking.startsAt
											) }
										</span>
										<span className="text-muted-foreground">
											→{ ' ' }
											{ formatDateTime( booking.endsAt ) }
										</span>
									</div>
								</TableCell>

								<TableCell className="hidden text-center tabular-nums sm:table-cell">
									{ booking.guests || 1 }
								</TableCell>

								<TableCell className="text-right font-semibold tabular-nums">
									{ formatMoney(
										booking.total,
										booking.currency
									) }
								</TableCell>

								<TableCell>
									<Badge
										variant="secondary"
										className={ `capitalize ${
											STATUS_CLASSES[ booking.status ] ??
											''
										}` }
									>
										{ label( booking.status ) }
									</Badge>
								</TableCell>

								<TableCell className="hidden md:table-cell">
									<div className="flex flex-wrap items-center gap-1.5">
										<Badge
											variant="secondary"
											className={ `capitalize ${
												PAYMENT_CLASSES[
													booking.paymentStatus
												] ?? ''
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
												<Receipt className="h-3 w-3" />
												{ __(
													'Receipt',
													'booking-suite'
												) }
											</span>
										) }
									</div>
								</TableCell>

								<TableCell className="text-right">
									{ /*
									 * Icon buttons: four actions in a row need
									 * to stay narrow, and every one repeats on
									 * every row — the label lives in the
									 * tooltip and the accessible name.
									 */ }
									<div
										className="flex items-center justify-end gap-1"
										onClick={ ( event ) =>
											event.stopPropagation()
										}
										role="presentation"
									>
										{ canApprove( booking ) && (
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8 text-success hover:text-success"
												disabled={
													busyId === booking.id
												}
												onClick={ () =>
													onApprove( booking )
												}
												title={ __(
													'Approve booking',
													'booking-suite'
												) }
											>
												<Check className="h-4 w-4" />
												<span className="sr-only">
													{ sprintf(
														/* translators: %s: booking reference. */
														__(
															'Approve %s',
															'booking-suite'
														),
														booking.reference ||
															booking.id
													) }
												</span>
											</Button>
										) }

										{ 'paid' !== booking.paymentStatus && (
											<Button
												size="icon"
												variant="outline"
												className="h-8 w-8"
												disabled={
													busyId === booking.id
												}
												onClick={ () =>
													onMarkPaid( booking )
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
															'Mark %s as paid',
															'booking-suite'
														),
														booking.reference ||
															booking.id
													) }
												</span>
											</Button>
										) }

										<Button
											size="icon"
											variant="outline"
											className="h-8 w-8"
											onClick={ () =>
												onViewPayment( booking )
											}
											title={ __(
												'View payment',
												'booking-suite'
											) }
										>
											<CreditCard className="h-4 w-4" />
											<span className="sr-only">
												{ __(
													'View payment',
													'booking-suite'
												) }
											</span>
										</Button>

										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8"
											onClick={ () =>
												onSelectBooking( booking )
											}
											title={ __(
												'Booking details',
												'booking-suite'
											) }
										>
											<Eye className="h-4 w-4" />
											<span className="sr-only">
												{ __(
													'Details',
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
