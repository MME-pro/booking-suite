/**
 * CalendarSyncPage — keeping this site's calendar level with the portals.
 *
 * Two ways in, and they write to the same place. A one-off upload is the way to
 * try a portal export, or to deal with a portal that will only give you a file;
 * a subscription is the way to leave it running, and is what the scheduled pull
 * reads. Both end up as availability locks, so anything imported here shows up
 * on the Availability and Calendar screens and stops the booking form dead.
 *
 * What this does NOT do is publish this site's own bookings back to the
 * portals. That is the other half of a two-way sync and it is a separate piece
 * of work; saying so on the screen is better than letting an operator assume it
 * and find out through a double booking.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	AlertCircle,
	CalendarClock,
	CalendarDays,
	Loader2,
	Plus,
	RefreshCw,
	Rss,
} from 'lucide-react';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../../components/StatCard';
import { icalService } from '../../services';
import { ExportCard } from './components/ExportCard';
import { FeedForm } from './components/FeedForm';
import { FeedList } from './components/FeedList';
import { ImportReport } from './components/ImportReport';
import { ImportCard } from './components/ImportCard';

export default function CalendarSyncPage() {
	const [ feeds, setFeeds ] = useState( [] );
	const [ apartments, setApartments ] = useState( [] );
	const [ sources, setSources ] = useState( [] );
	const [ schedule, setSchedule ] = useState( { nextRun: '' } );

	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ busyId, setBusyId ] = useState( null );
	const [ syncingAll, setSyncingAll ] = useState( false );

	/** null when closed; a feed when editing; 'new' when adding. */
	const [ editing, setEditing ] = useState( null );

	/** The feed awaiting delete confirmation, and whether to drop its dates. */
	const [ pendingDelete, setPendingDelete ] = useState( null );
	const [ dropBlocks, setDropBlocks ] = useState( false );

	/** The most recent sync report, shown under the list. */
	const [ lastReport, setLastReport ] = useState( null );
	const [ lastSummary, setLastSummary ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await icalService.list( signal );

			setFeeds( payload.feeds );
			setApartments( payload.apartments );
			setSources( payload.sources );
			setSchedule( payload.schedule );
			setError( null );
		} catch ( cause ) {
			if ( 'AbortError' !== cause.name ) {
				setError( cause.message );
			}
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		const controller = new AbortController();

		load( controller.signal );

		return () => controller.abort();
	}, [ load ] );

	const stats = useMemo( () => {
		const active = feeds.filter( ( feed ) => feed.active ).length;
		const failing = feeds.filter(
			( feed ) => 'error' === feed.lastStatus
		).length;

		// The freshest successful read across all of them: the honest answer to
		// "is what I am looking at current?".
		const lastRead = feeds
			.filter( ( feed ) => '' !== feed.lastSyncAt )
			.map( ( feed ) => feed.lastSyncAt )
			.sort()
			.pop();

		return { active, failing, lastRead: lastRead ?? '' };
	}, [ feeds ] );

	/*
	 * Merge the new link in place rather than reloading: the rest of the screen
	 * has not changed, and a full refetch would throw away a sync report the
	 * operator may still be reading.
	 */
	const handleExportChanged = ( apartmentId, links ) =>
		setApartments( ( current ) =>
			current.map( ( apartment ) =>
				apartment.id === apartmentId
					? { ...apartment, ...links }
					: apartment
			)
		);

	const handleSaved = ( saved ) => {
		if ( ! saved ) {
			setEditing( null );
			return;
		}

		setFeeds( ( current ) => {
			const exists = current.some( ( feed ) => feed.id === saved.id );

			return exists
				? current.map( ( feed ) =>
						feed.id === saved.id ? saved : feed
				  )
				: [ ...current, saved ];
		} );

		setEditing( null );
	};

	const syncOne = async ( feed ) => {
		setBusyId( feed.id );
		setError( null );
		setLastSummary( null );

		try {
			const { report, feed: updated } = await icalService.syncFeed(
				feed.id
			);

			setLastReport( report );

			if ( updated ) {
				setFeeds( ( current ) =>
					current.map( ( item ) =>
						item.id === updated.id ? updated : item
					)
				);
			}
		} catch ( cause ) {
			setError( cause.message );

			/*
			 * A failed pull is recorded on the feed row, and the API hands the
			 * updated row back with the error — so the card shows why and when
			 * even though the request did not succeed.
			 */
			const carried = cause.data?.feed;

			if ( carried ) {
				setFeeds( ( current ) =>
					current.map( ( item ) =>
						item.id === carried.id ? carried : item
					)
				);
			}
		} finally {
			setBusyId( null );
		}
	};

	const syncEverything = async () => {
		setSyncingAll( true );
		setError( null );
		setLastReport( null );

		try {
			const { results, feeds: updated } = await icalService.syncAll();

			setFeeds( updated );
			setLastSummary( results );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setSyncingAll( false );
		}
	};

	const confirmDelete = async () => {
		const feed = pendingDelete;

		if ( ! feed ) {
			return;
		}

		const alsoDrop = dropBlocks;

		setPendingDelete( null );
		setDropBlocks( false );
		setBusyId( feed.id );

		try {
			await icalService.removeFeed( feed.id, alsoDrop );

			setFeeds( ( current ) =>
				current.filter( ( item ) => item.id !== feed.id )
			);
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	const statCards = [
		{
			id: 'feeds',
			title: __( 'Subscriptions', 'booking-suite' ),
			value: feeds.length,
			unit: sprintf(
				/* translators: %d: number of subscriptions syncing automatically. */
				_n(
					'%d syncing automatically',
					'%d syncing automatically',
					stats.active,
					'booking-suite'
				),
				stats.active
			),
			Icon: Rss,
			tone: 'brand',
			badge: __( 'Portals', 'booking-suite' ),
		},
		{
			id: 'health',
			title: __( 'Failing', 'booking-suite' ),
			value: stats.failing,
			unit:
				stats.failing > 0
					? __( 'Check the calendar links', 'booking-suite' )
					: __( 'Every calendar reads cleanly', 'booking-suite' ),
			Icon: AlertCircle,
			tone: stats.failing > 0 ? 'warning' : 'success',
			badge:
				stats.failing > 0
					? __( 'Needs a look', 'booking-suite' )
					: __( 'Healthy', 'booking-suite' ),
		},
		{
			id: 'last',
			title: __( 'Last read', 'booking-suite' ),
			value: stats.lastRead ? stats.lastRead.slice( 5, 16 ) : '—',
			unit: stats.lastRead
				? __( 'Most recent portal read, UTC', 'booking-suite' )
				: __( 'No calendar read yet', 'booking-suite' ),
			Icon: CalendarDays,
			tone: 'accent',
			badge: __( 'Freshness', 'booking-suite' ),
		},
		{
			id: 'next',
			title: __( 'Next automatic sync', 'booking-suite' ),
			value: schedule.nextRun ? schedule.nextRun.slice( 11, 16 ) : '—',
			unit: schedule.nextRun
				? sprintf(
						/* translators: %s: date of the next scheduled sync. */
						__( 'On %s, then every 15 minutes', 'booking-suite' ),
						schedule.nextRun.slice( 0, 10 )
				  )
				: __( 'Not scheduled', 'booking-suite' ),
			Icon: CalendarClock,
			tone: schedule.nextRun ? 'muted' : 'warning',
			badge: __( 'Schedule', 'booking-suite' ),
		},
	];

	if ( isLoading ) {
		return (
			<div className="flex flex-col gap-4">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{ [ 0, 1, 2, 3 ].map( ( key ) => (
						<Skeleton key={ key } className="h-32 w-full" />
					) ) }
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Something went wrong', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription className="flex flex-wrap items-center gap-3">
						<span>{ error }</span>
						<Button
							size="sm"
							variant="outline"
							onClick={ () => load() }
						>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					</AlertDescription>
				</Alert>
			) }

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{ statCards.map( ( { id, Icon, ...card } ) => (
					<StatCard key={ id } icon={ Icon } { ...card } />
				) ) }
			</div>

			{ /*
			 * Subscriptions lead the screen. They are the standing arrangement
			 * — set up once, then keeping themselves level with the portals —
			 * so they are what the operator comes here to check on. A file
			 * upload is the occasional job, and sits underneath.
			 */ }
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-card-foreground">
						{ __( 'Automatic subscriptions', 'booking-suite' ) }
					</h2>
					<p className="text-sm text-muted-foreground">
						{ __(
							'Calendar links read every 15 minutes. Dates the portal holds are blocked here; this site’s own bookings are not sent back.',
							'booking-suite'
						) }
					</p>
				</div>

				{ /*
				 * Both buttons share the row and stretch to fill it on a phone,
				 * where "Sync all now" and "Add subscription" together are wider
				 * than the screen and would otherwise break at whatever point
				 * they ran out of room.
				 */ }
				<div className="flex items-center gap-2 lg:shrink-0">
					{ feeds.length > 0 && (
						<Button
							variant="outline"
							className="min-w-0 flex-1 lg:flex-none"
							onClick={ syncEverything }
							disabled={ syncingAll }
						>
							{ syncingAll ? (
								<Loader2 className="h-4 w-4 shrink-0 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4 shrink-0" />
							) }
							<span className="truncate">
								{ __( 'Sync all now', 'booking-suite' ) }
							</span>
						</Button>
					) }
					<Button
						className="min-w-0 flex-1 lg:flex-none"
						onClick={ () => setEditing( 'new' ) }
					>
						<Plus className="h-4 w-4 shrink-0" />
						<span className="truncate">
							{ __( 'Add subscription', 'booking-suite' ) }
						</span>
					</Button>
				</div>
			</div>

			{ lastSummary && (
				<Card>
					<CardContent className="flex flex-col gap-1 p-4 text-sm">
						{ lastSummary.map( ( result ) => (
							<span key={ result.feedId }>
								<strong className="font-medium">
									{ result.name }
								</strong>
								{ ' — ' }
								{ result.ok
									? sprintf(
											/* translators: 1: added, 2: changed, 3: released. */
											__(
												'%1$d blocked, %2$d changed, %3$d released',
												'booking-suite'
											),
											result.counts.added,
											result.counts.updated,
											result.counts.removed
									  )
									: result.message }
							</span>
						) ) }
					</CardContent>
				</Card>
			) }

			{ feeds.length > 0 ? (
				<FeedList
					feeds={ feeds }
					busyId={ busyId }
					onEdit={ setEditing }
					onDelete={ ( feed ) => {
						setDropBlocks( false );
						setPendingDelete( feed );
					} }
					onSync={ syncOne }
				/>
			) : (
				<Card>
					<CardContent className="flex flex-col items-center gap-2 px-6 py-14 text-center">
						<span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<Rss className="h-6 w-6" />
						</span>
						<h2 className="text-base font-semibold text-card-foreground">
							{ __(
								'No calendars subscribed yet',
								'booking-suite'
							) }
						</h2>
						<p className="max-w-md text-sm text-muted-foreground">
							{ __(
								'Paste the calendar link from Airbnb or Booking.com and their bookings will block those dates here automatically — no more checking two calendars by hand.',
								'booking-suite'
							) }
						</p>
						<Button
							className="mt-2"
							onClick={ () => setEditing( 'new' ) }
						>
							<Plus className="h-4 w-4" />
							{ __( 'Add subscription', 'booking-suite' ) }
						</Button>
					</CardContent>
				</Card>
			) }

			{ lastReport && (
				<Card>
					<CardContent className="p-4">
						<h3 className="mb-3 text-sm font-semibold text-card-foreground">
							{ sprintf(
								/* translators: %s: subscription name. */
								__( 'Last sync — %s', 'booking-suite' ),
								lastReport.feedName ?? lastReport.sourceLabel
							) }
						</h3>
						<ImportReport report={ lastReport } />
					</CardContent>
				</Card>
			) }

			{ /*
			 * The outgoing direction, under the incoming one. Reading a portal
			 * is what most operators set up first and the half that stops this
			 * site overselling; publishing is what stops the portals doing the
			 * same, and reads as the natural second step.
			 */ }
			{ apartments.length > 0 && (
				<ExportCard
					apartments={ apartments }
					onChanged={ handleExportChanged }
				/>
			) }

			{ /*
			 * The one-off route, below the standing one: for trying a portal
			 * export before subscribing to it, or for a portal that will only
			 * hand over a file. It writes to exactly the same place.
			 */ }
			{ apartments.length > 0 && (
				<div className="flex flex-col gap-3 border-t pt-4">
					<div>
						<h2 className="text-base font-semibold text-card-foreground">
							{ __( 'One-off file import', 'booking-suite' ) }
						</h2>
						<p className="text-sm text-muted-foreground">
							{ __(
								'For trying a portal export before subscribing to it, or for a portal that only offers a download.',
								'booking-suite'
							) }
						</p>
					</div>

					<ImportCard
						apartments={ apartments }
						onImported={ () => load() }
					/>
				</div>
			) }

			{ editing && (
				<FeedForm
					feed={ 'new' === editing ? null : editing }
					apartments={ apartments }
					sources={ sources }
					onClose={ () => setEditing( null ) }
					onSaved={ handleSaved }
				/>
			) }

			<AlertDialog
				open={ null !== pendingDelete }
				onOpenChange={ ( open ) => ! open && setPendingDelete( null ) }
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ __(
								'Remove this subscription?',
								'booking-suite'
							) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ pendingDelete &&
								sprintf(
									/* translators: %s: subscription name. */
									__(
										'"%s" will stop being read. The dates it already blocked stay blocked unless you say otherwise below.',
										'booking-suite'
									),
									pendingDelete.name
								) }
						</AlertDialogDescription>
					</AlertDialogHeader>

					<div className="flex items-start gap-2">
						<Checkbox
							id="bks-feed-drop-blocks"
							checked={ dropBlocks }
							onCheckedChange={ ( next ) =>
								setDropBlocks( Boolean( next ) )
							}
						/>
						<Label
							htmlFor="bks-feed-drop-blocks"
							className="text-sm font-normal leading-snug"
						>
							{ __(
								'Also release the dates this calendar blocked',
								'booking-suite'
							) }
							<span className="block text-xs text-muted-foreground">
								{ __(
									'Puts them back on sale. Only do this if the portal is no longer selling the apartment — dates it has sold would otherwise become bookable here too.',
									'booking-suite'
								) }
							</span>
						</Label>
					</div>

					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Cancel', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={ confirmDelete }
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{ __( 'Remove', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
