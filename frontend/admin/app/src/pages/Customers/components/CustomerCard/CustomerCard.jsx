/**
 * CustomerCard — one guest, for screens too narrow to hold the table.
 *
 * The customers table drops four of its seven columns before it reaches a
 * phone — contact, city, last stay and the booking count all go — which leaves
 * a list of names and amounts and no way to tell one guest from another. The
 * card keeps every column and lays them out top to bottom instead.
 *
 * Like the Bookings and Calendar cards, the whole card opens the record; there
 * is exactly one thing to do with a customer here — read their booking history
 * — so a button repeating it would cost a row and say nothing new. The booking
 * count sits in the header as a badge, where it doubles as the hint that there
 * is a history worth opening.
 */

import { __, sprintf, _n } from '@wordpress/i18n';
import { MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { CardField } from '../../../../components/CardField';
import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
import { initialsOf } from '../../../Bookings/data/status';

export default function CustomerCard( { customer, onViewHistory } ) {
	const open = () => onViewHistory( customer );

	const stopPropagation = ( event ) => event.stopPropagation();

	const name = customer.name || __( 'Customer', 'booking-suite' );

	return (
		<div
			role="button"
			tabIndex={ 0 }
			onClick={ open }
			onKeyDown={ ( event ) => {
				if ( 'Enter' === event.key || ' ' === event.key ) {
					event.preventDefault();
					open();
				}
			} }
			aria-label={ sprintf(
				/* translators: %s: guest name. */
				__( 'View all bookings for %s', 'booking-suite' ),
				name
			) }
			className="flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex items-center gap-2.5">
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
					{ initialsOf( customer.name ) }
				</span>

				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium leading-tight text-card-foreground">
						{ name }
					</span>
					{ customer.company && (
						<span className="truncate text-[11px] leading-tight text-muted-foreground">
							{ customer.company }
						</span>
					) }
				</div>

				{ /*
				 * A returning guest is the one fact worth spotting from across
				 * the list, so the count keeps the green it has in the table
				 * rather than becoming another grey number.
				 */ }
				<Badge
					variant="secondary"
					className={ `shrink-0 ${
						customer.bookingsCount > 1
							? 'bg-success/10 text-success hover:bg-success/10'
							: ''
					}` }
				>
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
				</Badge>
			</div>

			{ /*
			 * Contact sits outside the grid: these are links to act on, not
			 * values to compare, and on a phone they are how the guest actually
			 * gets contacted.
			 */ }
			{ ( customer.email || customer.phone ) && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					{ customer.email && (
						<a
							href={ `mailto:${ customer.email }` }
							onClick={ stopPropagation }
							className="min-w-0 truncate text-muted-foreground hover:text-primary hover:underline"
						>
							{ customer.email }
						</a>
					) }

					{ customer.phone && (
						<a
							href={ `tel:${ customer.phone }` }
							onClick={ stopPropagation }
							className="shrink-0 text-muted-foreground hover:text-primary hover:underline"
						>
							{ customer.phone }
						</a>
					) }
				</div>
			) }

			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-2.5">
				<CardField title={ __( 'City', 'booking-suite' ) }>
					{ customer.city ? (
						<span className="flex min-w-0 items-center gap-1.5">
							<MapPin
								aria-hidden="true"
								className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
							/>
							<span className="truncate">{ customer.city }</span>
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					) }
				</CardField>

				<CardField
					title={ __( 'Last stay', 'booking-suite' ) }
					className="text-right"
				>
					<span className="text-xs tabular-nums">
						{ customer.lastStayAt ? (
							formatDateTime( customer.lastStayAt )
						) : (
							<span className="text-muted-foreground">—</span>
						) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Lifetime value', 'booking-suite' ) }
					className="col-span-2"
				>
					<span className="text-base font-semibold tabular-nums">
						{ formatMoney( customer.totalSpent ) }
					</span>
				</CardField>
			</div>
		</div>
	);
}
