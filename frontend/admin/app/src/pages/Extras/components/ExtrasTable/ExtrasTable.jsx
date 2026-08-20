/**
 * ExtrasTable — the extras list, in whichever shape the screen can hold.
 *
 * A table from lg up, cards below it, matching the other list screens. The
 * table hides stock, booked and sort order well before a phone, which leaves
 * a name, a price and three buttons — not enough to manage a catalogue by.
 */

import { __, sprintf } from '@wordpress/i18n';
import { Eye, EyeOff, ImageIcon, Pencil, Trash2 } from 'lucide-react';

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

import { formatMoney } from '../../../Bookings/data/format';
import { ExtraCard } from '../ExtraCard';

export default function ExtrasTable( {
	extras,
	booked,
	onEdit,
	onDelete,
	onToggleActive,
	busyId = null,
	emptyContent = null,
} ) {
	if ( ! extras.length && emptyContent ) {
		return <Card className="overflow-hidden">{ emptyContent }</Card>;
	}

	return (
		<>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
				{ extras.map( ( extra ) => (
					<ExtraCard
						key={ extra.id }
						extra={ extra }
						booked={ booked[ extra.id ] ?? 0 }
						onEdit={ onEdit }
						onDelete={ onDelete }
						onToggleActive={ onToggleActive }
						busyId={ busyId }
					/>
				) ) }
			</div>

			<Card className="hidden overflow-hidden lg:block">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>
								{ __( 'Extra', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-right">
								{ __( 'Price', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Stock', 'booking-suite' ) }
							</TableHead>
							<TableHead className="text-center">
								{ __( 'Booked', 'booking-suite' ) }
							</TableHead>
							<TableHead className="hidden text-center xl:table-cell">
								{ __( 'Sort', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Status', 'booking-suite' ) }
							</TableHead>
							<TableHead className="w-[320px] text-right">
								<span className="sr-only">
									{ __( 'Actions', 'booking-suite' ) }
								</span>
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{ extras.map( ( extra ) => {
							const isBusy = busyId === extra.id;
							const isUnlimited = null === extra.stock;
							const isSoldOut = ! isUnlimited && extra.stock < 1;

							return (
								<TableRow key={ extra.id }>
									<TableCell>
										<div className="flex items-center gap-3">
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
											<div className="flex min-w-0 flex-col">
												<span className="font-medium text-card-foreground">
													{ extra.name }
												</span>
												{ extra.description && (
													<span className="truncate text-xs text-muted-foreground">
														{ extra.description }
													</span>
												) }
											</div>
										</div>
									</TableCell>

									<TableCell className="text-right font-semibold tabular-nums">
										{ formatMoney( Number( extra.price ) ) }
									</TableCell>

									<TableCell>
										{ isUnlimited ? (
											<Badge
												variant="secondary"
												className="bg-muted text-muted-foreground hover:bg-muted"
											>
												{ __(
													'Unlimited',
													'booking-suite'
												) }
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
													? __(
															'Out of stock',
															'booking-suite'
													  )
													: sprintf(
															/* translators: %d: quantity in stock. */
															__(
																'%d left',
																'booking-suite'
															),
															extra.stock
													  ) }
											</Badge>
										) }
									</TableCell>

									<TableCell className="text-center tabular-nums">
										{ booked[ extra.id ] ?? 0 }
									</TableCell>

									<TableCell className="hidden text-center tabular-nums xl:table-cell">
										{ extra.sortOrder }
									</TableCell>

									<TableCell>
										<Badge
											variant="secondary"
											className={
												extra.active
													? 'bg-success/10 text-success hover:bg-success/10'
													: 'bg-muted text-muted-foreground hover:bg-muted'
											}
										>
											{ extra.active
												? __(
														'Active',
														'booking-suite'
												  )
												: __(
														'Inactive',
														'booking-suite'
												  ) }
										</Badge>
									</TableCell>

									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											{ /*
											 * Deactivating hides the extra from the
											 * booking modal without deleting it, so
											 * bookings that already include it keep
											 * their line.
											 */ }
											<Button
												size="sm"
												variant="outline"
												disabled={ isBusy }
												onClick={ () =>
													onToggleActive( extra )
												}
												aria-label={
													extra.active
														? sprintf(
																/* translators: %s: extra name. */
																__(
																	'Deactivate %s',
																	'booking-suite'
																),
																extra.name
														  )
														: sprintf(
																/* translators: %s: extra name. */
																__(
																	'Activate %s',
																	'booking-suite'
																),
																extra.name
														  )
												}
											>
												{ extra.active ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												) }
												{ extra.active
													? __(
															'Deactivate',
															'booking-suite'
													  )
													: __(
															'Activate',
															'booking-suite'
													  ) }
											</Button>
											<Button
												size="sm"
												variant="outline"
												disabled={ isBusy }
												onClick={ () =>
													onEdit( extra )
												}
												aria-label={ sprintf(
													/* translators: %s: extra name. */
													__(
														'Edit %s',
														'booking-suite'
													),
													extra.name
												) }
											>
												<Pencil className="h-4 w-4" />
												{ __(
													'Edit',
													'booking-suite'
												) }
											</Button>
											<Button
												size="sm"
												variant="destructive"
												disabled={ isBusy }
												onClick={ () =>
													onDelete( extra )
												}
												aria-label={ sprintf(
													/* translators: %s: extra name. */
													__(
														'Delete %s',
														'booking-suite'
													),
													extra.name
												) }
											>
												<Trash2 className="h-4 w-4" />
												{ isBusy
													? __(
															'Deleting…',
															'booking-suite'
													  )
													: __(
															'Delete',
															'booking-suite'
													  ) }
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
