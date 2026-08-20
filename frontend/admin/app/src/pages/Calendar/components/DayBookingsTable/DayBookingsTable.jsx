/**
 * The bookings touching the selected calendar day.
 *
 * Same two shapes as the Bookings list, and deliberately the same card: a
 * booking should not look like one thing on one screen and something else on
 * the next. Below `lg` the rows become BookingCards; from `lg` up they stay a
 * table, which is what a set of like records wants to be when there is room.
 *
 * What this screen adds is the day itself. A booking listed under the 17th is
 * arriving, departing or simply in residence, and that is the reason for
 * looking at a day at all — so it travels into the card as its `tag` rather
 * than being dropped along with the column it lived in.
 *
 * The cards carry no action buttons. This screen has no approve or mark-paid
 * handlers to give them, and BookingCard leaves the footer out entirely rather
 * than drawing controls that would do nothing; tapping the card opens the
 * booking, which is the one thing this panel offers.
 */

import { __, sprintf } from '@wordpress/i18n';
import { Eye } from 'lucide-react';

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

import { BookingCard } from '../../../Bookings/components/BookingCard';
import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
import {
	PAYMENT_CLASSES,
	STATUS_CLASSES,
	label,
} from '../../../Bookings/data/status';
import { ARRIVAL, DEPARTURE } from '../../data/occupancy';

/**
 * What this booking is doing on the day being looked at.
 *
 * @param {string} role The booking's relationship to the day.
 * @return {string} The label.
 */
const roleLabel = ( role ) => {
	if ( ARRIVAL === role ) {
		return __( 'Arrives', 'booking-suite' );
	}

	if ( DEPARTURE === role ) {
		return __( 'Departs', 'booking-suite' );
	}

	return __( 'In house', 'booking-suite' );
};

/*
 * Arrivals and departures are the two the operator has to act on, so they are
 * the two that carry a colour; a guest mid-stay needs nothing done and stays
 * neutral.
 */
const ROLE_CLASSES = {
	[ ARRIVAL ]: 'bg-success/10 text-success hover:bg-success/10',
	[ DEPARTURE ]: 'bg-warning/10 text-warning hover:bg-warning/10',
};

/**
 * The day-role badge, shared by both shapes so they cannot drift.
 *
 * @param {Object} props
 * @param {string} props.role The booking's relationship to the day.
 * @return {JSX.Element} The badge.
 */
function RoleBadge( { role } ) {
	return (
		<Badge variant="secondary" className={ ROLE_CLASSES[ role ] ?? '' }>
			{ roleLabel( role ) }
		</Badge>
	);
}

export default function DayBookingsTable( {
	entries,
	apartmentsById,
	onSelectBooking,
} ) {
	return (
		<>
			{ /*
			 * Padding lives here rather than on the panel: the table wants to
			 * meet the panel edges, and the cards want room to breathe.
			 */ }
			<div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:hidden">
				{ entries.map( ( { booking, role } ) => (
					<BookingCard
						key={ `${ booking.id }-${ role }` }
						booking={ booking }
						onSelectBooking={ onSelectBooking }
						tag={ <RoleBadge role={ role } /> }
					/>
				) ) }
			</div>

			<div className="hidden w-full overflow-x-auto lg:block">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>
								{ __( 'Apartment', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Guest', 'booking-suite' ) }
							</TableHead>
							<TableHead className="w-[110px]">
								{ __( 'Today', 'booking-suite' ) }
							</TableHead>
							<TableHead className="hidden xl:table-cell">
								{ __( 'Stay', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Status', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Payment', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-right">
								{ __( 'Total', 'booking-suite' ) }
							</TableHead>
							<TableHead className="w-[60px] text-right">
								<span className="sr-only">
									{ __( 'Actions', 'booking-suite' ) }
								</span>
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{ entries.map( ( { booking, role } ) => {
							const apartment = apartmentsById.get(
								booking.apartmentId
							);

							return (
								<TableRow
									key={ `${ booking.id }-${ role }` }
									onClick={ () => onSelectBooking( booking ) }
									className="cursor-pointer"
								>
									<TableCell>
										<div className="flex items-center gap-2">
											<span
												aria-hidden="true"
												className="h-3 w-3 shrink-0 rounded-full"
												style={ {
													background:
														apartment?.colour ??
														'hsl(var(--muted-foreground))',
												} }
											/>
											<span className="font-medium text-card-foreground">
												{ booking.apartmentName ||
													apartment?.name ||
													'—' }
											</span>
										</div>
									</TableCell>

									<TableCell>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium text-card-foreground">
												{ booking.customerName ||
													__(
														'Guest',
														'booking-suite'
													) }
											</span>
											<span className="text-xs text-muted-foreground">
												{ booking.reference ||
													`#${ booking.id }` }
											</span>
										</div>
									</TableCell>

									<TableCell>
										<RoleBadge role={ role } />
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
									</TableCell>

									<TableCell className="text-right font-semibold tabular-nums">
										{ formatMoney(
											booking.total,
											booking.currency
										) }
									</TableCell>

									{ /*
									 * The row itself is clickable; this repeats
									 * the action as something keyboard users can
									 * reach and everyone can see.
									 */ }
									<TableCell className="text-right">
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8"
											onClick={ ( event ) => {
												event.stopPropagation();
												onSelectBooking( booking );
											} }
											title={ __(
												'Booking details',
												'booking-suite'
											) }
										>
											<Eye className="h-4 w-4" />
											<span className="sr-only">
												{ sprintf(
													/* translators: %s: booking reference. */
													__(
														'Details for %s',
														'booking-suite'
													),
													booking.reference ||
														booking.id
												) }
											</span>
										</Button>
									</TableCell>
								</TableRow>
							);
						} ) }
					</TableBody>
				</Table>
			</div>
		</>
	);
}
