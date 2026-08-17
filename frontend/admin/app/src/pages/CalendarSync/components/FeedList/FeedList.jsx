/**
 * FeedList — the standing subscriptions, as cards.
 *
 * Cards rather than a table, following the rest of the admin: a subscription
 * carries a long URL and a sentence about its last sync, neither of which
 * survives a table column on a phone.
 *
 * Each card leads with the outcome of the last pull, because that is the only
 * thing about a subscription that changes on its own and the only thing worth
 * checking on.
 */

import { __, sprintf } from '@wordpress/i18n';
import {
	CalendarClock,
	CheckCircle2,
	Loader2,
	Pencil,
	RefreshCw,
	Trash2,
	XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const SOURCE_TONES = {
	airbnb: 'bg-destructive/10 text-destructive',
	booking: 'bg-primary/10 text-primary',
	vrbo: 'bg-success/10 text-success',
};

export default function FeedList( {
	feeds,
	busyId,
	onEdit,
	onDelete,
	onSync,
} ) {
	return (
		<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
			{ feeds.map( ( feed ) => {
				const failed = 'error' === feed.lastStatus;
				const busy = busyId === feed.id;

				return (
					<Card key={ feed.id }>
						<CardContent className="flex flex-col gap-3 p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-semibold text-card-foreground">
											{ feed.name }
										</span>
										<span
											className={ `rounded px-1.5 py-0.5 text-xs font-medium ${
												SOURCE_TONES[ feed.source ] ??
												'bg-muted text-muted-foreground'
											}` }
										>
											{ feed.source }
										</span>
										{ ! feed.active && (
											<Badge variant="outline">
												{ __(
													'Paused',
													'booking-suite'
												) }
											</Badge>
										) }
									</div>
									<p className="mt-0.5 text-sm text-muted-foreground">
										{ feed.apartmentName }
									</p>
								</div>

								<div className="flex shrink-0 items-center gap-1">
									<Button
										size="icon"
										variant="ghost"
										title={ __(
											'Sync now',
											'booking-suite'
										) }
										disabled={ busy }
										onClick={ () => onSync( feed ) }
									>
										{ busy ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4" />
										) }
									</Button>
									<Button
										size="icon"
										variant="ghost"
										title={ __( 'Edit', 'booking-suite' ) }
										onClick={ () => onEdit( feed ) }
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										title={ __(
											'Remove',
											'booking-suite'
										) }
										onClick={ () => onDelete( feed ) }
									>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</div>

							<p className="truncate font-mono text-xs text-muted-foreground">
								{ feed.url }
							</p>

							<div className="flex items-start gap-2 border-t pt-3 text-xs">
								{ '' === feed.lastSyncAt ? (
									<>
										<CalendarClock className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										<span className="text-muted-foreground">
											{ __(
												'Not read yet — it will be picked up by the next automatic sync.',
												'booking-suite'
											) }
										</span>
									</>
								) : (
									<>
										{ failed ? (
											<XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" />
										) : (
											<CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-success" />
										) }
										<span
											className={
												failed
													? 'text-destructive'
													: 'text-muted-foreground'
											}
										>
											{ sprintf(
												/* translators: 1: date and time, 2: what happened. */
												__(
													'Last read %1$s UTC — %2$s',
													'booking-suite'
												),
												feed.lastSyncAt.slice( 0, 16 ),
												feed.lastMessage
											) }
										</span>
									</>
								) }
							</div>
						</CardContent>
					</Card>
				);
			} ) }
		</div>
	);
}
