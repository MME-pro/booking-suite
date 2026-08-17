/**
 * ImportReport — what an import will do, or has just done.
 *
 * The same component serves both, because the report behind them is the same
 * object: a preview is the import run with nothing written. What the operator
 * agrees to is therefore what they were shown, line for line.
 *
 * Every event in the file gets a row, including the ones that will be skipped.
 * A calendar that quietly imports eight of its ten dates is worse than one that
 * says which two it left and why — that is the difference between a calendar
 * you can trust and one you have to check against the portal by hand.
 */

import { __, _n, sprintf } from '@wordpress/i18n';
import { AlertTriangle, CalendarX2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

// The API sends 'Y-m-d H:i:s', so a slice is enough — no parsing needed.
const day = ( value ) => String( value ?? '' ).slice( 0, 10 );

const time = ( value ) => String( value ?? '' ).slice( 11, 16 );

const ACTIONS = {
	added: {
		label: __( 'New', 'booking-suite' ),
		variant: 'default',
	},
	updated: {
		label: __( 'Changed', 'booking-suite' ),
		variant: 'secondary',
	},
	unchanged: {
		label: __( 'Already there', 'booking-suite' ),
		variant: 'outline',
	},
	skipped: {
		label: __( 'Skipped', 'booking-suite' ),
		variant: 'outline',
	},
};

/*
 * A window as one line.
 *
 * Whole-day events are the norm and read best as two dates; anything with a
 * clock on it keeps its times, because for those the times are the point.
 */
function Window( { event } ) {
	const sameDay = day( event.startsAt ) === day( event.endsAt );

	if ( event.allDay ) {
		return (
			<span className="whitespace-nowrap tabular-nums">
				{ day( event.startsAt ) }
				<span className="mx-1 text-muted-foreground">→</span>
				{ day( event.endsAt ) }
			</span>
		);
	}

	return (
		<span className="whitespace-nowrap tabular-nums">
			{ day( event.startsAt ) } { time( event.startsAt ) }
			<span className="mx-1 text-muted-foreground">→</span>
			{ sameDay ? '' : `${ day( event.endsAt ) } ` }
			{ time( event.endsAt ) }
		</span>
	);
}

export default function ImportReport( { report } ) {
	const { counts, events, orphans, conflicts } = report;

	const summary = [
		{
			key: 'added',
			value: counts.added,
			label: __( 'to add', 'booking-suite' ),
		},
		{
			key: 'updated',
			value: counts.updated,
			label: __( 'to change', 'booking-suite' ),
		},
		{
			key: 'removed',
			value: report.removeMissing ? counts.removed : 0,
			label: __( 'to release', 'booking-suite' ),
		},
		{
			key: 'unchanged',
			value: counts.unchanged,
			label: __( 'unchanged', 'booking-suite' ),
		},
		{
			key: 'skipped',
			value: counts.skipped,
			label: __( 'skipped', 'booking-suite' ),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3">
				{ summary.map( ( item ) => (
					<span
						key={ item.key }
						className="flex items-baseline gap-1.5"
					>
						<span className="text-lg font-semibold tabular-nums text-card-foreground">
							{ item.value }
						</span>
						<span className="text-xs text-muted-foreground">
							{ item.label }
						</span>
					</span>
				) ) }

				<span className="ml-auto text-xs text-muted-foreground">
					{ sprintf(
						/* translators: 1: portal name, 2: apartment name. */
						__( '%1$s → %2$s', 'booking-suite' ),
						report.sourceLabel,
						report.apartmentName
					) }
				</span>
			</div>

			{ conflicts.length > 0 && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Double booking', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription className="flex flex-col gap-1">
						<span>
							{ __(
								'These dates are already sold on this site and the portal has them too. Importing does not cancel anything — settle it at one of the two channels.',
								'booking-suite'
							) }
						</span>
						<ul className="mt-1 flex flex-col gap-0.5">
							{ conflicts.map( ( booking ) => (
								<li key={ booking.id } className="tabular-nums">
									{ booking.reference } ·{ ' ' }
									{ day( booking.startsAt ) } →{ ' ' }
									{ day( booking.endsAt ) } ·{ ' ' }
									{ booking.status }
								</li>
							) ) }
						</ul>
					</AlertDescription>
				</Alert>
			) }

			<div className="overflow-x-auto rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-32">
								{ __( 'Action', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'Dates', 'booking-suite' ) }
							</TableHead>
							<TableHead className="w-20 text-right">
								{ __( 'Nights', 'booking-suite' ) }
							</TableHead>
							<TableHead>
								{ __( 'From the calendar', 'booking-suite' ) }
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{ events.map( ( event, index ) => {
							const action =
								ACTIONS[ event.action ] ?? ACTIONS.skipped;

							return (
								<TableRow
									key={ `${ event.uid }-${ index }` }
									className={
										'skipped' === event.action
											? 'text-muted-foreground'
											: ''
									}
								>
									<TableCell>
										<Badge variant={ action.variant }>
											{ action.label }
										</Badge>
									</TableCell>
									<TableCell className="text-sm">
										<Window event={ event } />
									</TableCell>
									<TableCell className="text-right text-sm tabular-nums">
										{ event.allDay ? event.nights : '—' }
									</TableCell>
									<TableCell className="text-sm">
										{ event.summary }
										{ event.note && (
											<span className="ml-1 text-xs text-muted-foreground">
												({ event.note })
											</span>
										) }
									</TableCell>
								</TableRow>
							);
						} ) }
					</TableBody>
				</Table>
			</div>

			{ orphans.length > 0 && (
				<div className="rounded-lg border border-dashed p-4">
					<h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
						<CalendarX2 className="h-4 w-4 text-muted-foreground" />
						{ sprintf(
							/* translators: %d: number of locks. */
							_n(
								'%d date is blocked here but no longer in the calendar',
								'%d dates are blocked here but no longer in the calendar',
								orphans.length,
								'booking-suite'
							),
							orphans.length
						) }
					</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						{ report.removeMissing
							? __(
									'These will be released, putting the dates back on sale.',
									'booking-suite'
							  )
							: __(
									'These will be left alone. Switch on "release dates the calendar no longer holds" to remove them.',
									'booking-suite'
							  ) }
					</p>
					<ul className="mt-2 flex flex-col gap-0.5 text-sm tabular-nums">
						{ orphans.map( ( orphan ) => (
							<li key={ orphan.id }>
								{ day( orphan.startsAt ) } →{ ' ' }
								{ day( orphan.endsAt ) }
								<span className="ml-2 text-muted-foreground">
									{ orphan.reason }
								</span>
							</li>
						) ) }
					</ul>
				</div>
			) }
		</div>
	);
}
