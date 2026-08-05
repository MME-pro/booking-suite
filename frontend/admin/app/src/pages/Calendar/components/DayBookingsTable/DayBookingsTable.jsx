/**
 * The bookings touching the selected calendar day.
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

import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
import { ARRIVAL, DEPARTURE } from '../../data/occupancy';

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

const roleLabel = ( role ) => {
	if ( ARRIVAL === role ) {
		return __( 'Arrives', 'booking-suite' );
	}

	if ( DEPARTURE === role ) {
		return __( 'Departs', 'booking-suite' );
	}

	return __( 'In house', 'booking-suite' );
};

const ROLE_CLASSES = {
	[ ARRIVAL ]: 'bg-success/10 text-success hover:bg-success/10',
	[ DEPARTURE ]: 'bg-warning/10 text-warning hover:bg-warning/10',
};

export default function DayBookingsTable( {
	entries,
	apartmentsById,
	onSelectBooking,
} ) {
	return (
		<div className="w-full overflow-x-auto">
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
						<TableHead className="hidden md:table-cell">
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
												__( 'Guest', 'booking-suite' ) }
										</span>
										<span className="text-xs text-muted-foreground">
											{ booking.reference ||
												`#${ booking.id }` }
										</span>
									</div>
								</TableCell>

								<TableCell>
									<Badge
										variant="secondary"
										className={ ROLE_CLASSES[ role ] ?? '' }
									>
										{ roleLabel( role ) }
									</Badge>
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
								 * The row itself is clickable; this repeats the
								 * action as something keyboard users can reach
								 * and everyone can see.
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
												booking.reference || booking.id
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
	);
}
