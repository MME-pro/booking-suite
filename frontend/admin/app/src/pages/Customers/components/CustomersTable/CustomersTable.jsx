/**
 * CustomersTable — the guest list, in whichever shape the screen can hold.
 *
 * A table from `lg` up, cards below it, exactly as the Bookings list works.
 * Both are rendered and one is hidden by CSS rather than switching on a measured
 * width: a width read in JavaScript is not known until after the first paint, so
 * that approach flashes the wrong layout on load and has to be re-measured on
 * every resize and rotate.
 *
 * The cut is at `lg` because that is where the table stops being useful. Below
 * it, contact, city, last stay and the booking count have all been dropped, and
 * what is left — a name and an amount — is not enough to tell two guests apart.
 */

import { __, sprintf, _n } from '@wordpress/i18n';
import { History } from 'lucide-react';

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
import { initialsOf } from '../../../Bookings/data/status';
import { CustomerCard } from '../CustomerCard';

export default function CustomersTable( {
	customers,
	onViewHistory,
	emptyContent = null,
} ) {
	if ( ! customers.length && emptyContent ) {
		return <Card className="overflow-hidden">{ emptyContent }</Card>;
	}

	return (
		<>
			{ /*
			 * Two per row on a tablet: a customer card is shorter than a booking
			 * card, and one per row there would leave half the screen empty.
			 */ }
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
				{ customers.map( ( customer ) => (
					<CustomerCard
						key={ customer.id }
						customer={ customer }
						onViewHistory={ onViewHistory }
					/>
				) ) }
			</div>

			<Card className="hidden overflow-hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>
								{ __( 'Customer', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Contact', 'booking-suite' ) }
							</TableHead>
							{ /*
							 * The only column still dropped, and only between
							 * `lg` and `xl`. The card layout covers every
							 * narrower screen, so this is the whole compromise.
							 */ }
							<TableHead className="hidden xl:table-cell">
								{ __( 'City', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-center">
								{ __( 'Bookings', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Last stay', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-right">
								{ __( 'Lifetime value', 'booking-suite' ) }
							</TableHead>
							<TableHead className="w-[170px] text-right">
								{ __( 'Actions', 'booking-suite' ) }
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{ customers.map( ( customer ) => (
							<TableRow
								key={ customer.id }
								onClick={ () => onViewHistory( customer ) }
								className="cursor-pointer"
							>
								<TableCell>
									<div className="flex items-center gap-3">
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
											{ initialsOf( customer.name ) }
										</span>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium text-card-foreground">
												{ customer.name ||
													__(
														'Customer',
														'booking-suite'
													) }
											</span>
											{ customer.company && (
												<span className="truncate text-xs text-muted-foreground">
													{ customer.company }
												</span>
											) }
										</div>
									</div>
								</TableCell>

								<TableCell>
									<div className="flex min-w-0 flex-col text-xs">
										{ customer.email && (
											<a
												href={ `mailto:${ customer.email }` }
												onClick={ ( event ) =>
													event.stopPropagation()
												}
												className="truncate text-muted-foreground hover:text-primary hover:underline"
											>
												{ customer.email }
											</a>
										) }
										{ customer.phone && (
											<span className="truncate text-muted-foreground">
												{ customer.phone }
											</span>
										) }
									</div>
								</TableCell>

								<TableCell className="hidden xl:table-cell">
									{ customer.city || '—' }
								</TableCell>

								<TableCell className="text-center">
									{ /* Returning customers are the ones worth spotting. */ }
									<Badge
										variant="secondary"
										className={
											customer.bookingsCount > 1
												? 'bg-success/10 text-success hover:bg-success/10'
												: ''
										}
									>
										{ customer.bookingsCount }
									</Badge>
								</TableCell>

								<TableCell className="text-xs">
									{ customer.lastStayAt
										? formatDateTime( customer.lastStayAt )
										: '—' }
								</TableCell>

								<TableCell className="text-right font-semibold tabular-nums">
									{ formatMoney( customer.totalSpent ) }
								</TableCell>

								<TableCell className="text-right">
									<div
										onClick={ ( event ) =>
											event.stopPropagation()
										}
										role="presentation"
									>
										<Button
											size="sm"
											variant="outline"
											onClick={ () =>
												onViewHistory( customer )
											}
											aria-label={ sprintf(
												/* translators: %s: guest name. */
												__(
													'View all bookings for %s',
													'booking-suite'
												),
												customer.name
											) }
										>
											<History className="h-4 w-4" />
											{ sprintf(
												/* translators: %d: number of bookings. */
												_n(
													'%d booking',
													'%d bookings',
													customer.bookingsCount,
													'booking-suite'
												),
												customer.bookingsCount
											) }
										</Button>
									</div>
								</TableCell>
							</TableRow>
						) ) }
					</TableBody>
				</Table>
			</Card>
		</>
	);
}
