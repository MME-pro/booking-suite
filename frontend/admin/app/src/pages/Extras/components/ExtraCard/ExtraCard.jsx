/**
 * ExtraCard — one add-on, for screens too narrow to hold the table.
 *
 * Unlike the other card views this one is not tappable, because the extras
 * table has no row action either: an extra has three things you can do to it
 * and no obvious default among them. Inventing one here — making the card open
 * the edit form — would mean a stray tap while scrolling puts you in a form,
 * so the three buttons stay the only way in.
 *
 * The image earns its place. An extra is a thing rather than a record, and the
 * picture identifies it faster than the name does when several are breakfasts.
 */

import { __, sprintf } from '@wordpress/i18n';
import { Eye, EyeOff, ImageIcon, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { CardField } from '../../../../components/CardField';
import { formatMoney } from '../../../Bookings/data/format';

export default function ExtraCard( {
	extra,
	booked = 0,
	onEdit,
	onDelete,
	onToggleActive,
	busyId = null,
} ) {
	const isBusy = busyId === extra.id;
	const isUnlimited = null === extra.stock;
	const isSoldOut = ! isUnlimited && extra.stock < 1;

	return (
		<div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3 shadow-sm">
			<div className="flex items-center gap-2.5">
				{ extra.imageUrl ? (
					<img
						src={ extra.imageUrl }
						alt=""
						className="h-10 w-10 shrink-0 rounded-md border object-cover"
					/>
				) : (
					<span
						aria-hidden="true"
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
					>
						<ImageIcon className="h-4 w-4" />
					</span>
				) }

				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium leading-tight text-card-foreground">
						{ extra.name }
					</span>
					{ extra.description && (
						<span className="truncate text-[11px] leading-tight text-muted-foreground">
							{ extra.description }
						</span>
					) }
				</div>

				<Badge
					variant="secondary"
					className={ `shrink-0 ${
						extra.active
							? 'bg-success/10 text-success hover:bg-success/10'
							: 'bg-muted text-muted-foreground hover:bg-muted'
					}` }
				>
					{ extra.active
						? __( 'Active', 'booking-suite' )
						: __( 'Inactive', 'booking-suite' ) }
				</Badge>
			</div>

			<div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-2.5">
				<CardField title={ __( 'Price', 'booking-suite' ) }>
					<span className="font-semibold tabular-nums">
						{ formatMoney( Number( extra.price ) ) }
					</span>
				</CardField>

				<CardField
					title={ __( 'Stock', 'booking-suite' ) }
					className="items-end text-right"
				>
					{ isUnlimited ? (
						<Badge
							variant="secondary"
							className="bg-muted text-muted-foreground hover:bg-muted"
						>
							{ __( 'Unlimited', 'booking-suite' ) }
						</Badge>
					) : (
						<Badge
							variant="secondary"
							className={
								isSoldOut
									? 'bg-destructive/10 text-destructive hover:bg-destructive/10'
									: 'bg-success/10 text-success hover:bg-success/10'
							}
						>
							{ isSoldOut
								? __( 'Out of stock', 'booking-suite' )
								: sprintf(
										/* translators: %d: quantity in stock. */
										__( '%d left', 'booking-suite' ),
										extra.stock
								  ) }
						</Badge>
					) }
				</CardField>

				<CardField title={ __( 'Booked', 'booking-suite' ) }>
					<span className="tabular-nums">{ booked }</span>
				</CardField>

				<CardField
					title={ __( 'Sort', 'booking-suite' ) }
					className="text-right"
				>
					<span className="tabular-nums">{ extra.sortOrder }</span>
				</CardField>
			</div>

			{ /*
			 * Equal shares of one row. Delete keeps its destructive colour but
			 * loses its word on the narrowest screens — three labelled buttons
			 * do not fit 320px, and the icon plus the colour is unambiguous.
			 */ }
			<div className="flex items-center gap-1.5 border-t pt-2.5">
				{ /*
				 * Deactivating hides the extra from the booking modal without
				 * deleting it, so bookings that already include it keep their
				 * line.
				 */ }
				<Button
					size="sm"
					variant="outline"
					className="min-w-0 flex-1 px-2 text-xs"
					disabled={ isBusy }
					onClick={ () => onToggleActive( extra ) }
					aria-label={
						extra.active
							? sprintf(
									/* translators: %s: extra name. */
									__( 'Deactivate %s', 'booking-suite' ),
									extra.name
							  )
							: sprintf(
									/* translators: %s: extra name. */
									__( 'Activate %s', 'booking-suite' ),
									extra.name
							  )
					}
				>
					{ extra.active ? (
						<EyeOff className="h-3.5 w-3.5 shrink-0" />
					) : (
						<Eye className="h-3.5 w-3.5 shrink-0" />
					) }
					<span className="truncate">
						{ extra.active
							? __( 'Hide', 'booking-suite' )
							: __( 'Show', 'booking-suite' ) }
					</span>
				</Button>

				<Button
					size="sm"
					variant="outline"
					className="min-w-0 flex-1 px-2 text-xs"
					disabled={ isBusy }
					onClick={ () => onEdit( extra ) }
					aria-label={ sprintf(
						/* translators: %s: extra name. */
						__( 'Edit %s', 'booking-suite' ),
						extra.name
					) }
				>
					<Pencil className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">
						{ __( 'Edit', 'booking-suite' ) }
					</span>
				</Button>

				<Button
					size="sm"
					variant="destructive"
					className="shrink-0 px-2.5"
					disabled={ isBusy }
					onClick={ () => onDelete( extra ) }
					aria-label={ sprintf(
						/* translators: %s: extra name. */
						__( 'Delete %s', 'booking-suite' ),
						extra.name
					) }
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	);
}
