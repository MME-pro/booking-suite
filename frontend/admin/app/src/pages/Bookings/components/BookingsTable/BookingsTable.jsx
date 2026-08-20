/**
 * BookingsTable — the bookings list, in whichever shape the screen can hold.
 *
 * Above `lg` it is a table, which is what a list of like records wants to be
 * when there is room: the eye runs down a column to compare totals or spot the
 * pending ones. Below `lg` the same rows are drawn as cards, one booking each,
 * with nothing left out.
 *
 * Both are rendered and one is hidden by CSS, rather than switching on a
 * measured viewport width. A width read in JavaScript is not known until after
 * the first paint, so that approach flashes the wrong layout on load and has to
 * be re-measured on every resize and rotate; the breakpoint utilities are
 * resolved by the browser before anything is painted.
 *
 * The cut is at `lg` because that is where the table stops being honest. Below
 * it, the columns that would have to go — stay dates, payment state — are
 * exactly the ones an operator is usually looking for.
 */

import { __, sprintf } from '@wordpress/i18n';
import { BadgeEuro, Check, CreditCard, Eye, Receipt } from 'lucide-react';

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

import { formatDateTime, formatMoney } from '../../data/format';
import {
	PAYMENT_CLASSES,
	STATUS_CLASSES,
	canApprove,
	initialsOf,
	label,
} from '../../data/status';
import { BookingCard } from '../BookingCard';

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
		return <Card className="overflow-hidden">{ emptyContent }</Card>;
	}

	const actions = {
		onSelectBooking,
		onApprove,
		onMarkPaid,
		onViewPayment,
		busyId,
	};

	return (
		<>
			{ /*
			 * Cards on anything narrower than a laptop. A grid rather than a
			 * stack: a tablet in landscape fits two side by side, and leaving
			 * one card per row there would waste half the screen.
			 */ }
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
				{ bookings.map( ( booking ) => (
					<BookingCard
						key={ booking.id }
						booking={ booking }
						{ ...actions }
					/>
				) ) }
			</div>

			<Card className="hidden overflow-hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-[130px]">
								{ __( 'Reference', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Guest', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Apartment', 'booking-suite' ) }
							</TableHead>
							{ /*
							 * The one column still dropped, and only between
							 * `lg` and `xl`. Nine columns do not fit at 1024px,
							 * and the card layout below covers every narrower
							 * screen, so this is the whole of the compromise.
							 */ }
							<TableHead className="hidden xl:table-cell">
								{ __( 'Stay dates', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-center">
								{ __( 'Guests', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-right">
								{ __( 'Total', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Status', 'booking-suite' ) }
							</TableHead>
							<TableHead>
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
										{ booking.reference ||
											`#${ booking.id }` }
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
														{
															booking.customerEmail
														}
													</a>
												) }
											</div>
										</div>
									</TableCell>

									<TableCell>
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
												{ formatDateTime(
													booking.endsAt
												) }
											</span>
										</div>
									</TableCell>

									<TableCell className="text-center tabular-nums">
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
												STATUS_CLASSES[
													booking.status
												] ?? ''
											}` }
										>
											{ label( booking.status ) }
										</Badge>
									</TableCell>

									<TableCell>
										<div className="flex flex-wrap items-center gap-1.5">
											<Badge
												variant="secondary"
												className={ `capitalize ${
													PAYMENT_CLASSES[
														booking.paymentStatus
													] ?? ''
												}` }
											>
												{ label(
													booking.paymentStatus
												) }
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
										 * Icon buttons: four actions in a row
										 * need to stay narrow, and every one
										 * repeats on every row — the label
										 * lives in the tooltip and the
										 * accessible name. The card gives them
										 * their words back.
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

											{ 'paid' !==
												booking.paymentStatus && (
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
			</Card>
		</>
	);
}
