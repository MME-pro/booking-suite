/**
 * CustomersTable — the guest list, on the shadcn/ui Table primitives.
 */

import { __, sprintf, _n } from '@wordpress/i18n';
import { History } from 'lucide-react';

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

const initialsOf = ( name ) =>
	( name || 'G' )
		.split( ' ' )
		.map( ( part ) => part[ 0 ] )
		.join( '' )
		.toUpperCase()
		.slice( 0, 2 );

export default function CustomersTable( {
	customers,
	onViewHistory,
	emptyContent = null,
} ) {
	if ( ! customers.length && emptyContent ) {
		return emptyContent;
	}

	return (
		<div className="w-full overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead>
							{ __( 'Customer', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden lg:table-cell">
							{ __( 'Contact', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden xl:table-cell">
							{ __( 'City', 'booking-suite' ) }
						</TableHead>
						<TableHead className="text-center">
							{ __( 'Bookings', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden md:table-cell">
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

							<TableCell className="hidden lg:table-cell">
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

							<TableCell className="hidden text-xs md:table-cell">
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
		</div>
	);
}
