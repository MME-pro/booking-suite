/**
 * ExportLinks — the .ics addresses this apartment publishes.
 *
 * There is one link per scope, and the scope decides which locks the file
 * carries. That is what makes this site the hub rather than a third calendar
 * nobody reconciles:
 *
 *   For Booking.com   direct bookings + Airbnb's dates, but not Booking.com's
 *   For Airbnb        direct bookings + Booking.com's dates, but not Airbnb's
 *   Direct only       what was sold or blocked here, and nothing else
 *
 * A portal is never handed back the dates it just gave us. That is not tidiness
 * — a lock re-exported to its own source can bounce between the two calendars,
 * picking up a fresh UID on every lap, and neither side can tell the copies
 * apart afterwards.
 *
 * Which scopes are offered follows the subscription list directly above, read
 * live from the form rather than from the saved record. Subscriptions and
 * exports are two ends of one setting and are now filled in together, so
 * pasting an Airbnb link has to offer the Airbnb-shaped export there and then;
 * waiting for a save and a reload reads as the feature being missing.
 */

import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { AlertCircle, Check, Copy, Link2, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { copyToClipboard } from '../../../../lib/clipboard';
import { icalService } from '../../../../services';
import { settings } from '../../../../settings';

/**
 * The portals this apartment publishes for, matching the subscription rows.
 *
 * The all-channels and direct-only feeds still exist and still serve; they are
 * not offered here because this section is about the two portals.
 */
const PORTALS = [ 'airbnb', 'booking' ];

/**
 * The operator-facing name of a portal, e.g. 'airbnb' => 'Airbnb'.
 *
 * @param {string} source A portal key.
 * @return {string} Its label, or the key itself if the server did not name it.
 */
function sourceLabel( source ) {
	const match = ( settings.icalSources ?? [] ).find(
		( entry ) => entry.value === source
	);

	return match?.label ?? source;
}

/**
 * One address, with its own copy button and its own "copied" state.
 *
 * @param {Object} props
 * @param {Object} props.entry One row of the apartment's export list.
 * @return {JSX.Element} The row.
 */
function ExportRow( { entry } ) {
	const [ copied, setCopied ] = useState( false );
	const [ error, setError ] = useState( null );

	const copy = async () => {
		if ( ! ( await copyToClipboard( entry.url ) ) ) {
			setError(
				__(
					'Could not copy automatically — select the link and copy it by hand.',
					'booking-suite'
				)
			);

			return;
		}

		setCopied( true );
		setError( null );

		window.setTimeout( () => setCopied( false ), 2000 );
	};

	return (
		<div className="flex flex-col gap-1.5 rounded-lg border p-3">
			<div className="flex flex-wrap items-baseline gap-x-2">
				<span className="text-sm font-medium text-card-foreground">
					{ entry.label }
				</span>

				{ /*
				 * Says what the file actually contains rather than leaving the
				 * scope name to be decoded. "Carries Airbnb" is the whole
				 * reason to hand this particular link to Booking.com.
				 */ }
				{ entry.carries.length > 0 && (
					<span className="text-xs text-muted-foreground">
						{ sprintf(
							/* translators: %s: comma-separated portal names. */
							__( 'Direct bookings + %s', 'booking-suite' ),
							entry.carries.map( sourceLabel ).join( ', ' )
						) }
					</span>
				) }
			</div>

			<div className="flex items-center gap-2">
				<Input
					readOnly
					value={ entry.url }
					onFocus={ ( event ) => event.target.select() }
					aria-label={ sprintf(
						/* translators: %s: which feed, e.g. "For Airbnb". */
						__( 'Export link — %s', 'booking-suite' ),
						entry.label
					) }
					className="font-mono text-xs"
				/>
				<Button
					type="button"
					size="icon"
					variant="outline"
					className="shrink-0"
					onClick={ copy }
					title={ __( 'Copy link', 'booking-suite' ) }
				>
					{ copied ? (
						<Check className="h-4 w-4 text-success" />
					) : (
						<Copy className="h-4 w-4" />
					) }
					<span className="sr-only">
						{ __( 'Copy link', 'booking-suite' ) }
					</span>
				</Button>
			</div>

			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }
		</div>
	);
}

/**
 * @param {Object} props
 * @param {Object} [props.apartment] The saved record, absent while creating.
 * @param {Object} props.form        The parent react-hook-form instance.
 * @return {JSX.Element} The export section.
 */
export default function ExportLinks( { apartment, form } ) {
	const [ exports, setExports ] = useState( apartment?.icalExports ?? [] );
	const [ isBusy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );

	/*
	 * Watched, not read once: which exports make sense has to follow the rows
	 * above as they are edited. A row with no link is one the operator opened
	 * and did not fill in — it names no portal, so it grants nothing.
	 */
	const feeds = form.watch( 'icalFeeds' ) ?? [];

	const subscribed = [
		...new Set(
			feeds
				.filter( ( feed ) => '' !== ( feed?.url ?? '' ).trim() )
				.map( ( feed ) => feed?.source )
				.filter( ( source ) => source && 'other' !== source )
		),
	];

	/*
	 * The server minted one URL per scope; two of them are shown, in the same
	 * order as the rows above. Each leaves out the dates its own portal gave
	 * us, and carries whatever the other one did — that is what routes both
	 * portals through this site rather than at each other.
	 */
	const byScope = new Map(
		exports.map( ( entry ) => [ entry.scope, entry ] )
	);

	const offered = PORTALS.map( ( scope ) => byScope.get( scope ) )
		.filter( ( entry ) => entry?.url )
		.map( ( entry ) => ( {
			...entry,
			carries: subscribed.filter( ( source ) => source !== entry.scope ),
		} ) );

	const isPublished = exports.some( ( entry ) => entry.url );

	const publish = async () => {
		setBusy( true );
		setError( null );

		try {
			const result = await icalService.exportLink( apartment.id );

			setExports( result.exports ?? [] );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( false );
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium leading-none">
					{ __( 'Export links (.ics)', 'booking-suite' ) }
				</span>
				<p className="text-xs text-muted-foreground">
					{ __(
						'Give each to the portal it is named for. Each leaves out that portal’s own dates, and is readable by anyone holding it.',
						'booking-suite'
					) }
				</p>
			</div>

			{ /*
			 * There is nothing to publish until the apartment has an id, so a
			 * new one is told when the links arrive rather than shown a button
			 * that cannot work.
			 */ }
			{ ! apartment && (
				<p className="text-xs text-muted-foreground">
					{ __(
						'Save the apartment first — the export links can be created once it exists.',
						'booking-suite'
					) }
				</p>
			) }

			{ apartment && ! isPublished && (
				<>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="w-fit"
						disabled={ isBusy }
						onClick={ publish }
					>
						{ isBusy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Link2 className="h-4 w-4" />
						) }
						{ __( 'Create export links', 'booking-suite' ) }
					</Button>
					<p className="text-xs text-muted-foreground">
						{ __(
							'Not published yet. Creating them makes this apartment’s booked dates readable by anyone holding a link — each says when the apartment is taken, never who by.',
							'booking-suite'
						) }
					</p>
				</>
			) }

			{ apartment && isPublished && (
				<>
					<div className="flex flex-col gap-2">
						{ offered.map( ( entry ) => (
							<ExportRow key={ entry.scope } entry={ entry } />
						) ) }
					</div>
				</>
			) }

			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }
		</div>
	);
}
