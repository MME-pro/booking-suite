/**
 * ApartmentsTable — the apartments list, on the shadcn/ui Table primitives.
 */

import { __, sprintf } from '@wordpress/i18n';
import { Pencil, Trash2 } from 'lucide-react';

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

export default function ApartmentsTable( {
	apartments,
	onEdit,
	onDelete,
	busyId = null,
	emptyContent = null,
} ) {
	if ( ! apartments.length && emptyContent ) {
		return emptyContent;
	}

	return (
		<div className="w-full overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead>
							{ __( 'Apartment', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden text-center sm:table-cell">
							{ __( 'Guests', 'booking-suite' ) }
						</TableHead>
						<TableHead className="hidden text-center md:table-cell">
							{ __( 'Cleaning', 'booking-suite' ) }
						</TableHead>
						<TableHead className="w-[130px]">
							{ __( 'Status', 'booking-suite' ) }
						</TableHead>
						<TableHead className="w-[190px] text-right">
							<span className="sr-only">
								{ __( 'Actions', 'booking-suite' ) }
							</span>
						</TableHead>
					</TableRow>
				</TableHeader>

				<TableBody>
					{ apartments.map( ( apartment ) => {
						const isBusy = busyId === apartment.id;

						return (
							<TableRow key={ apartment.id }>
								<TableCell>
									<div className="flex items-center gap-3">
										{ apartment.images?.[ 0 ]?.url ? (
											<img
												src={
													apartment.images[ 0 ].url
												}
												alt=""
												className="h-10 w-10 shrink-0 rounded-md border-2 object-cover"
												style={ {
													borderColor:
														apartment.colour,
												} }
											/>
										) : (
											<span
												aria-hidden="true"
												className="h-10 w-10 shrink-0 rounded-md"
												style={ {
													background:
														apartment.colour,
												} }
											/>
										) }
										<span className="font-medium text-card-foreground">
											{ apartment.name }
										</span>
									</div>
								</TableCell>

								<TableCell className="hidden text-center tabular-nums sm:table-cell">
									{ apartment.capacity }
								</TableCell>

								<TableCell className="hidden text-center tabular-nums md:table-cell">
									{ sprintf(
										/* translators: %d: turnaround time in minutes. */
										__( '%d min', 'booking-suite' ),
										apartment.cleaningMin
									) }
								</TableCell>

								<TableCell>
									<Badge
										variant="secondary"
										className={
											apartment.active
												? 'bg-success/10 text-success hover:bg-success/10'
												: 'bg-muted text-muted-foreground hover:bg-muted'
										}
									>
										{ apartment.active
											? __( 'Active', 'booking-suite' )
											: __(
													'Inactive',
													'booking-suite'
											  ) }
									</Badge>
								</TableCell>

								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											size="sm"
											variant="outline"
											disabled={ isBusy }
											onClick={ () =>
												onEdit( apartment )
											}
											aria-label={ sprintf(
												/* translators: %s: apartment name. */
												__(
													'Edit %s',
													'booking-suite'
												),
												apartment.name
											) }
										>
											<Pencil className="h-4 w-4" />
											{ __( 'Edit', 'booking-suite' ) }
										</Button>
										<Button
											size="sm"
											variant="destructive"
											disabled={ isBusy }
											onClick={ () =>
												onDelete( apartment )
											}
											aria-label={ sprintf(
												/* translators: %s: apartment name. */
												__(
													'Delete %s',
													'booking-suite'
												),
												apartment.name
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
		</div>
	);
}
