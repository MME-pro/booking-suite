/**
 * AvailabilityPage — the same month as the Calendar, from the other direction.
 *
 * The Calendar answers "who is staying"; this answers "what is open". It shows
 * locks rather than bookings, and is where dates are taken off the board.
 *
 * Nothing else needs teaching about locks: BookingsRepository::is_available()
 * already refuses a window overlapping one, so a lock made here immediately
 * stops the booking modal offering those dates.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	AlertCircle,
	Boxes,
	Building2,
	CalendarOff,
	ChevronLeft,
	ChevronRight,
	Lock,
	ShieldAlert,
	Trash2,
} from 'lucide-react';
import { de, enUS } from 'date-fns/locale';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { LockDialog } from './components/LockDialog';
import { MonthGrid } from '../Calendar/components/MonthGrid';
import { dayKey, toDate } from '../../lib/dates';
import { blockService } from '../../services';
import { settings } from '../../settings';
import { formatDateTime } from '../Bookings/data/format';

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

const dateLocale = String( settings.locale || 'de_DE' ).startsWith( 'de' )
	? de
	: enUS;

const formatMonth = ( date ) =>
	new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		month: 'long',
		year: 'numeric',
	} ).format( date );

export default function AvailabilityPage() {
	const [ blocks, setBlocks ] = useState( [] );
	const [ apartments, setApartments ] = useState( [] );
	const [ extras, setExtras ] = useState( [] );

	/** Which side of the board is on show: 'apartment' or 'extra'. */
	const [ scope, setScope ] = useState( 'apartment' );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ month, setMonth ] = useState( () => new Date() );
	const [ selected, setSelected ] = useState( () => new Date() );

	/** null, 'apartment' or 'master' — which lock dialog is open. */
	const [ locking, setLocking ] = useState( null );

	/**
	 * Which apartments (or extras) are shown; null means all of them.
	 *
	 * Reset whenever the tab changes, since the two boards hold different ids
	 * and carrying a selection across would hide things at random.
	 */
	const [ visibleIds, setVisibleIds ] = useState( null );

	/** The lock awaiting release confirmation. */
	const [ pendingRelease, setPendingRelease ] = useState( null );

	const load = useCallback( async ( currentScope, signal ) => {
		setLoading( true );

		try {
			const payload = await blockService.list(
				{ scope: currentScope },
				signal
			);

			setBlocks( payload.blocks );
			setApartments( payload.apartments );
			setExtras( payload.extras );
			setVisibleIds(
				new Set(
					( 'extra' === currentScope
						? payload.extras
						: payload.apartments
					).map( ( item ) => item.id )
				)
			);
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

		load( scope, controller.signal );

		return () => controller.abort();
	}, [ load, scope ] );

	/**
	 * The locks the filter lets through.
	 *
	 * A master lock always shows: it covers every apartment, so hiding it
	 * because one apartment is filtered out would misreport that apartment as
	 * open when it is not.
	 */
	const visibleBlocks = useMemo( () => {
		if ( ! visibleIds ) {
			return blocks;
		}

		return blocks.filter(
			( block ) =>
				block.isMaster ||
				visibleIds.has( block.extraId ?? block.apartmentId )
		);
	}, [ blocks, visibleIds ] );

	/** Day key → the locks covering that day. */
	const byDay = useMemo( () => {
		const days = new Map();

		for ( const block of visibleBlocks ) {
			const start = toDate( block.startsAt );
			const end = toDate( block.endsAt );

			if ( ! start || ! end ) {
				continue;
			}

			const cursor = new Date(
				start.getFullYear(),
				start.getMonth(),
				start.getDate()
			);

			// Guarded: a bad timestamp must not spin here.
			for ( let guard = 0; guard < 400; guard++ ) {
				const key = dayKey( cursor );

				if ( ! days.has( key ) ) {
					days.set( key, [] );
				}

				days.get( key ).push( block );

				cursor.setDate( cursor.getDate() + 1 );

				if ( cursor > end ) {
					break;
				}
			}
		}

		return days;
	}, [ visibleBlocks ] );

	const selectedLocks = byDay.get( dayKey( selected ) ) ?? [];
	const isExtraScope = 'extra' === scope;

	/** What the lock dialog offers to lock, for the tab in view. */
	const lockable = isExtraScope ? extras : apartments;

	const toggleVisible = ( id ) =>
		setVisibleIds( ( current ) => {
			const next = new Set( current );

			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}

			return next;
		} );

	const shiftMonth = ( delta ) =>
		setMonth(
			( current ) =>
				new Date( current.getFullYear(), current.getMonth() + delta, 1 )
		);

	const release = async () => {
		const block = pendingRelease;

		setPendingRelease( null );

		try {
			await blockService.remove( block.id );
			setBlocks( ( current ) =>
				current.filter( ( item ) => item.id !== block.id )
			);
			setError( null );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	/**
	 * A locked day is filled with a diagonal hatch and carries a padlock.
	 *
	 * A single slash read as a stray line rather than a closed day. Hatching is
	 * the convention for "not available" on a booking calendar, and the padlock
	 * says it in a second channel so the meaning never rests on texture alone.
	 *
	 * @param {Date} date The day being drawn.
	 * @return {JSX.Element|null} The cell content, or null when nothing is locked.
	 */
	const renderDayContent = ( date ) => {
		const locks = byDay.get( dayKey( date ) ) ?? [];

		if ( ! locks.length ) {
			return null;
		}

		const master = locks.find( ( lock ) => lock.isMaster );

		const ink = master
			? 'hsl(var(--destructive) / 0.22)'
			: 'hsl(var(--muted-foreground) / 0.22)';

		return (
			<>
				{ /*
				 * Sits over the whole cell but never eats a click, so the day
				 * stays selectable underneath.
				 */ }
				<span
					aria-hidden="true"
					className={ cn(
						'pointer-events-none absolute inset-0',
						master ? 'bg-destructive/5' : 'bg-muted/40'
					) }
					style={ {
						backgroundImage: `repeating-linear-gradient(45deg, ${ ink } 0 3px, transparent 3px 9px)`,
					} }
				/>

				{ /* Second channel: the state is named, not just shaded. */ }
				<span
					aria-hidden="true"
					className={ cn(
						'pointer-events-none absolute right-1.5 top-1.5',
						master ? 'text-destructive' : 'text-muted-foreground'
					) }
				>
					{ master ? (
						<ShieldAlert className="h-3.5 w-3.5" />
					) : (
						<Lock className="h-3.5 w-3.5" />
					) }
				</span>

				{ /*
				 * `relative` lifts the names clear of the hatch: an absolutely
				 * positioned sibling paints over static ones whatever the DOM
				 * order, which had the stripes running straight through the
				 * text. The chips are opaque for the same reason.
				 */ }
				<span className="relative flex flex-col gap-0.5">
					{ master && (
						<span className="truncate rounded-sm border border-destructive/30 bg-card px-1.5 py-0.5 text-[11px] font-medium leading-tight text-destructive">
							{ __( 'Master lock', 'booking-suite' ) }
						</span>
					) }

					{ locks
						.filter( ( lock ) => ! lock.isMaster )
						.slice( 0, 2 )
						.map( ( lock ) => (
							<span
								key={ lock.id }
								className="truncate rounded-sm border bg-card px-1.5 py-0.5 text-[11px] leading-tight text-card-foreground"
							>
								{ lock.extraName ||
									lock.apartmentName ||
									__( 'Locked', 'booking-suite' ) }
							</span>
						) ) }
				</span>
			</>
		);
	};

	if ( isLoading ) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-72" />
				<Skeleton className="h-[520px] w-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{ /* Same page, two boards: rooms and the things that go in them. */ }
			<Tabs value={ scope } onValueChange={ setScope }>
				<TabsList>
					<TabsTrigger value="apartment" className="gap-2">
						<Building2 className="h-4 w-4" />
						{ __( 'Apartments', 'booking-suite' ) }
					</TabsTrigger>
					<TabsTrigger value="extra" className="gap-2">
						<Boxes className="h-4 w-4" />
						{ __( 'Extras', 'booking-suite' ) }
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Something went wrong', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			{ /* Narrows the month to the ones being worked on. */ }
			{ lockable.length > 1 && (
				<div className="flex flex-wrap items-center gap-2">
					{ lockable.map( ( item ) => {
						const isOn = ! visibleIds || visibleIds.has( item.id );

						return (
							<button
								key={ item.id }
								type="button"
								onClick={ () => toggleVisible( item.id ) }
								aria-pressed={ isOn }
								className={ cn(
									'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
									isOn
										? 'bg-card text-card-foreground'
										: 'border-dashed bg-muted/50 text-muted-foreground line-through'
								) }
							>
								<span
									aria-hidden="true"
									className="h-2.5 w-2.5 rounded-full"
									style={ {
										backgroundColor: item.colour,
										opacity: isOn ? 1 : 0.3,
									} }
								/>
								{ item.name }
							</button>
						);
					} ) }
				</div>
			) }

			<Card className="overflow-hidden">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={ () => shiftMonth( -1 ) }
						>
							<ChevronLeft className="h-4 w-4" />
							{ __( 'Back', 'booking-suite' ) }
						</Button>

						<h2 className="px-2 text-lg font-semibold tracking-tight text-card-foreground">
							{ formatMonth( month ) }
						</h2>

						<Button
							variant="outline"
							size="sm"
							onClick={ () => shiftMonth( 1 ) }
						>
							{ __( 'Next', 'booking-suite' ) }
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button size="sm" onClick={ () => setLocking( 'one' ) }>
							<Lock className="h-4 w-4" />
							{ isExtraScope
								? __( 'Lock Extra', 'booking-suite' )
								: __( 'Lock Apartment', 'booking-suite' ) }
						</Button>
						<Button
							size="sm"
							variant="destructive"
							onClick={ () => setLocking( 'master' ) }
						>
							<ShieldAlert className="h-4 w-4" />
							{ __( 'Master Lock', 'booking-suite' ) }
						</Button>
					</div>
				</div>

				<MonthGrid
					month={ month }
					onMonthChange={ setMonth }
					selected={ selected }
					onSelect={ setSelected }
					occupancy={ new Map() }
					visibleIds={ null }
					apartmentsById={ new Map() }
					locale={ dateLocale }
					renderDayContent={ renderDayContent }
				/>
			</Card>

			<Card>
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
					<div className="flex flex-col gap-0.5">
						<h3 className="text-base font-semibold text-card-foreground">
							{ __( 'Locks', 'booking-suite' ) }
						</h3>
						<p className="text-sm text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of locks. */
								_n(
									'%d lock in place',
									'%d locks in place',
									visibleBlocks.length,
									'booking-suite'
								),
								visibleBlocks.length
							) }
						</p>
					</div>

					{ selectedLocks.length > 0 && (
						<Badge variant="secondary">
							{ sprintf(
								/* translators: %d: locks on the selected day. */
								__( '%d on the selected day', 'booking-suite' ),
								selectedLocks.length
							) }
						</Badge>
					) }
				</div>

				<CardContent className="p-0">
					{ ! visibleBlocks.length && (
						<div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<CalendarOff className="h-6 w-6" />
							</span>
							<h4 className="text-base font-semibold text-card-foreground">
								{ __( 'Nothing locked', 'booking-suite' ) }
							</h4>
							<p className="max-w-sm text-sm text-muted-foreground">
								{ __(
									'Every apartment is open for booking. Lock one for maintenance, or lock everything for a closure.',
									'booking-suite'
								) }
							</p>
						</div>
					) }

					<ul className="divide-y">
						{ visibleBlocks.map( ( block ) => (
							<li
								key={ block.id }
								className="flex flex-wrap items-center gap-3 px-5 py-3"
							>
								<span
									className={ `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
										block.isMaster
											? 'bg-destructive/10 text-destructive'
											: 'bg-muted text-muted-foreground'
									}` }
								>
									{ block.isMaster ? (
										<ShieldAlert className="h-4 w-4" />
									) : (
										<Lock className="h-4 w-4" />
									) }
								</span>

								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium text-card-foreground">
										{ block.isMaster &&
											__(
												'Master lock — every apartment',
												'booking-suite'
											) }
										{ ! block.isMaster &&
											( block.extraName ||
												block.apartmentName ||
												__(
													'Locked',
													'booking-suite'
												) ) }
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{ formatDateTime( block.startsAt ) } →{ ' ' }
										{ formatDateTime( block.endsAt ) }
										{ block.reason &&
											` · ${ block.reason }` }
									</span>
								</div>

								<Button
									size="sm"
									variant="outline"
									onClick={ () => setPendingRelease( block ) }
								>
									<Trash2 className="h-4 w-4" />
									{ __( 'Release', 'booking-suite' ) }
								</Button>
							</li>
						) ) }
					</ul>
				</CardContent>
			</Card>

			{ /* Unmounted when closed, so the form starts clean each time. */ }
			{ locking && (
				<LockDialog
					master={ 'master' === locking }
					scope={ scope }
					apartments={ lockable }
					onClose={ () => setLocking( null ) }
					onSaved={ ( created, options = {} ) => {
						setBlocks( ( current ) => [ ...current, ...created ] );

						if ( ! options.keepOpen ) {
							setLocking( null );
						}
					} }
				/>
			) }

			<AlertDialog
				open={ null !== pendingRelease }
				onOpenChange={ ( open ) => ! open && setPendingRelease( null ) }
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ __( 'Release this lock?', 'booking-suite' ) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ __(
								'Those dates go back on the board and can be booked again.',
								'booking-suite'
							) }
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Cancel', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction onClick={ release }>
							{ __( 'Release', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
