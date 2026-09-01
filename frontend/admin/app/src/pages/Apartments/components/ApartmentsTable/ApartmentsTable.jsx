/**
 * ApartmentsTable — the apartments list, on the shadcn/ui Table primitives.
 */

import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check, Copy, Pencil, Trash2 } from 'lucide-react';

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

import { copyToClipboard } from '../../../../lib/clipboard';
import { settings } from '../../../../settings';

/**
 * One apartment's internal short link, with a button that copies it.
 *
 * Shown as the path rather than the whole URL — the host is the same on every
 * row and repeating it seven times crowds out the part that differs. The copy
 * button puts the FULL address on the clipboard, because that is what gets
 * pasted into a newsletter or a message to a cleaner.
 *
 * @param {Object} props           Component props.
 * @param {string} props.shortLink The stored slug, or '' when there is none.
 * @return {JSX.Element} The cell's content.
 */
function ShortLink( { shortLink } ) {
	const [ copied, setCopied ] = useState( false );

	if ( ! shortLink ) {
		/*
		 * Only a draft should reach this: publishing mints one, and every
		 * apartment that already existed was given one on upgrade.
		 */
		return (
			<span className="text-xs text-muted-foreground">
				{ __( 'Not published yet', 'booking-suite' ) }
			</span>
		);
	}

	const path = `/${ String( shortLink ).replace( /^\/+/, '' ) }`;
	const url = `${ settings.siteUrl }${ path.slice( 1 ) }`;

	const copy = async () => {
		if ( await copyToClipboard( url ) ) {
			setCopied( true );
			window.setTimeout( () => setCopied( false ), 2000 );
		}
	};

	return (
		<span className="flex items-center gap-1">
			<a
				href={ url }
				target="_blank"
				rel="noreferrer"
				title={ url }
				className="truncate font-mono text-xs text-primary hover:underline"
			>
				{ path }
			</a>

			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6 shrink-0"
				onClick={ copy }
				aria-label={ __( 'Copy short link', 'booking-suite' ) }
			>
				{ copied ? (
					<Check className="h-3 w-3 text-success" />
				) : (
					<Copy className="h-3 w-3" />
				) }
			</Button>
		</span>
	);
}

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
						<TableHead className="hidden w-[210px] lg:table-cell">
							{ __( 'Short link', 'booking-suite' ) }
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

								<TableCell className="hidden lg:table-cell">
									<ShortLink
										shortLink={
											apartment.internalShortLink
										}
									/>
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
