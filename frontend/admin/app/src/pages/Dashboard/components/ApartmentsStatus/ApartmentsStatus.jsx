/**
 * ApartmentsStatus — every apartment and where it stands right now.
 *
 * The one widget worth real width: it is scanned daily, so the apartments are
 * laid out as tiles across the page rather than stacked in a narrow column.
 *
 * "Status" here is two separate things, and both matter: whether the apartment
 * is bookable at all (active), and whether someone is in it at this moment. An
 * apartment can be active and occupied, or inactive and still occupied by a
 * stay taken before it was switched off.
 */

import { __, sprintf } from '@wordpress/i18n';
import { Building2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';

import { toDate } from '../../../../lib/dates';
import { formatDateTime } from '../../../Bookings/data/format';

/** Statuses that actually hold the dates; a completed stay is over. */
const OCCUPYING = [ 'pending', 'reserved', 'confirmed' ];

export default function ApartmentsStatus( {
	apartments,
	bookings,
	blocks = [],
} ) {
	const now = new Date();

	const rows = apartments.map( ( apartment ) => {
		/*
		 * A lock is a third state, independent of the other two: an apartment
		 * can be locked and occupied at once, because locking stops NEW
		 * bookings rather than cancelling the stay already in it.
		 */
		const lock = blocks.find( ( block ) => {
			if ( ! block.isMaster && block.apartmentId !== apartment.id ) {
				return false;
			}

			const starts = toDate( block.startsAt );
			const ends = toDate( block.endsAt );

			return starts && ends && starts <= now && ends > now;
		} );

		const stays = bookings.filter(
			( booking ) =>
				booking.apartmentId === apartment.id &&
				OCCUPYING.includes( booking.status )
		);

		const current = stays.find( ( booking ) => {
			const starts = toDate( booking.startsAt );
			const ends = toDate( booking.endsAt );

			return starts && ends && starts <= now && ends > now;
		} );

		// The soonest arrival still ahead of us.
		const next = stays
			.filter( ( booking ) => {
				const starts = toDate( booking.startsAt );

				return starts && starts > now;
			} )
			.sort(
				( a, b ) => toDate( a.startsAt ) - toDate( b.startsAt )
			)[ 0 ];

		return { apartment, current, next, lock };
	} );

	const occupied = rows.filter( ( row ) => row.current ).length;

	return (
		<Card>
			<CardHeader className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 space-y-0 pb-3">
				<div className="flex flex-col gap-1">
					<CardTitle className="text-base">
						{ __( 'Apartments Status', 'booking-suite' ) }
					</CardTitle>
					<CardDescription>
						{ __(
							'Where each one stands right now.',
							'booking-suite'
						) }
					</CardDescription>
				</div>

				{ rows.length > 0 && (
					<span className="text-xs text-muted-foreground">
						{ sprintf(
							/* translators: 1: occupied count, 2: total apartments. */
							__( '%1$d of %2$d occupied', 'booking-suite' ),
							occupied,
							rows.length
						) }
					</span>
				) }
			</CardHeader>

			<CardContent>
				{ ! rows.length && (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Building2 className="h-5 w-5" />
						</span>
						<p className="text-sm text-muted-foreground">
							{ __( 'No apartments yet.', 'booking-suite' ) }
						</p>
					</div>
				) }

				{ /* Tiles, so a long estate spreads across the page. */ }
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{ rows.map( ( { apartment, current, next, lock } ) => (
						<div
							key={ apartment.id }
							className="flex items-center gap-3 rounded-lg border p-3"
						>
							<span
								aria-hidden="true"
								className="h-9 w-9 shrink-0 rounded-md"
								style={ { background: apartment.colour } }
							/>

							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-medium text-card-foreground">
									{ apartment.name }
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{ /* The lock is the more urgent fact, so it leads. */ }
									{ lock &&
										sprintf(
											/* translators: %s: when the lock lifts. */
											__(
												'Locked until %s',
												'booking-suite'
											),
											formatDateTime( lock.endsAt )
										) }
									{ ! lock &&
										current &&
										sprintf(
											/* translators: %s: checkout date and time. */
											__( 'Until %s', 'booking-suite' ),
											formatDateTime( current.endsAt )
										) }
									{ ! lock &&
										! current &&
										next &&
										sprintf(
											/* translators: %s: arrival date and time. */
											__( 'Next %s', 'booking-suite' ),
											formatDateTime( next.startsAt )
										) }
									{ ! lock &&
										! current &&
										! next &&
										__(
											'Nothing booked ahead',
											'booking-suite'
										) }
								</span>
							</div>

							<div className="flex shrink-0 flex-col items-end gap-1">
								{ /*
								 * Locked leads when it applies: "Free" beside a
								 * locked apartment would read as bookable, which
								 * is the one thing it is not.
								 */ }
								{ lock && (
									<Badge
										variant="secondary"
										className="bg-destructive/10 text-destructive hover:bg-destructive/10"
									>
										{ lock.isMaster
											? __(
													'Master locked',
													'booking-suite'
											  )
											: __( 'Locked', 'booking-suite' ) }
									</Badge>
								) }

								<Badge
									variant="secondary"
									className={
										current
											? 'bg-primary/10 text-primary hover:bg-primary/10'
											: 'bg-success/10 text-success hover:bg-success/10'
									}
								>
									{ current
										? __( 'Occupied', 'booking-suite' )
										: __( 'Free', 'booking-suite' ) }
								</Badge>

								{ /* Only worth saying when it is the exception. */ }
								{ ! apartment.active && (
									<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
										{ __( 'Inactive', 'booking-suite' ) }
									</span>
								) }
							</div>
						</div>
					) ) }
				</div>
			</CardContent>
		</Card>
	);
}
