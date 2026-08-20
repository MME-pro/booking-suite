/**
 * ExportCard — the calendar link each apartment publishes.
 *
 * The mirror of a subscription. A subscription reads a portal's calendar into
 * this site; this is the address a portal reads to find out what this site has
 * sold, so a booking taken here closes the same dates over there. Between the
 * two the site is the hub every channel agrees with.
 *
 * The link is created on request rather than existing from the start. It is a
 * public URL whose secret is the URL itself — the only arrangement a portal
 * with no login can use, and the same one Airbnb's own links use — so an
 * apartment nobody has published should not have one sitting there live.
 *
 * The file it serves says when the apartment is taken and never who has it. No
 * guest names, no references, no amounts: anyone holding the link sees the
 * whole thing, so there is nothing in it worth seeing.
 */

import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AlertCircle,
	Check,
	Copy,
	Download,
	Link2,
	Loader2,
	RefreshCw,
	Share2,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { copyToClipboard } from '@/lib/clipboard';

import { icalService } from '../../../../services';

function ApartmentRow( { apartment, onChanged } ) {
	const [ busy, setBusy ] = useState( '' );
	const [ copied, setCopied ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ confirming, setConfirming ] = useState( false );

	const url = apartment.exportUrl ?? '';

	const create = async ( regenerate ) => {
		setBusy( regenerate ? 'regenerate' : 'create' );
		setError( null );

		try {
			const result = await icalService.exportLink(
				apartment.id,
				regenerate
			);

			onChanged( apartment.id, result );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( '' );
		}
	};

	const copy = async () => {
		const ok = await copyToClipboard( url );

		if ( ! ok ) {
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
		<div className="flex flex-col gap-2 rounded-lg border p-3">
			{ /*
			 * The apartment on its own line, the buttons on theirs. Three
			 * controls and a name do not share a phone row, and letting them
			 * wrap put a lone button under a half-empty line of text.
			 */ }
			<div className="flex min-w-0 items-center gap-2">
				<span
					aria-hidden="true"
					className="h-3 w-3 shrink-0 rounded-sm"
					style={ { backgroundColor: apartment.colour } }
				/>
				<span className="truncate font-medium text-card-foreground">
					{ apartment.name }
				</span>

				{ ! url && (
					<Button
						size="sm"
						className="ml-auto shrink-0"
						disabled={ '' !== busy }
						onClick={ () => create( false ) }
					>
						{ 'create' === busy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Link2 className="h-4 w-4" />
						) }
						{ __( 'Create link', 'booking-suite' ) }
					</Button>
				) }
			</div>

			{ url && (
				<div className="flex items-center gap-1">
					<Button
						size="sm"
						variant="outline"
						className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3"
						onClick={ copy }
					>
						{ copied ? (
							<Check className="h-4 w-4 shrink-0 text-success" />
						) : (
							<Copy className="h-4 w-4 shrink-0" />
						) }
						<span className="truncate">
							{ copied
								? __( 'Copied', 'booking-suite' )
								: __( 'Copy link', 'booking-suite' ) }
						</span>
					</Button>

					{ /*
					 * A plain anchor, not a fetch: the endpoint answers with
					 * Content-Disposition: attachment, so the browser saves
					 * the file itself. Opening in a new tab keeps the admin
					 * screen where it is.
					 */ }
					<Button
						size="sm"
						variant="ghost"
						className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3"
						asChild
					>
						<a
							href={ url }
							target="_blank"
							rel="noreferrer"
							title={ __(
								'Download the .ics file',
								'booking-suite'
							) }
						>
							<Download className="h-4 w-4 shrink-0" />
							<span className="truncate">
								{ __( 'Download', 'booking-suite' ) }
							</span>
						</a>
					</Button>

					<Button
						size="icon"
						variant="ghost"
						className="shrink-0"
						title={ __( 'Replace this link', 'booking-suite' ) }
						disabled={ '' !== busy }
						onClick={ () => setConfirming( true ) }
					>
						{ 'regenerate' === busy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						) }
						<span className="sr-only">
							{ __( 'Replace this link', 'booking-suite' ) }
						</span>
					</Button>
				</div>
			) }

			{ url ? (
				<Input
					readOnly
					value={ url }
					onFocus={ ( event ) => event.target.select() }
					aria-label={ sprintf(
						/* translators: %s: apartment name. */
						__( 'Calendar link for %s', 'booking-suite' ),
						apartment.name
					) }
					className="font-mono text-xs"
				/>
			) : (
				<p className="text-xs text-muted-foreground">
					{ __(
						'Not published yet. Creating the link makes this apartment’s booked dates readable by anyone holding it.',
						'booking-suite'
					) }
				</p>
			) }

			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			<AlertDialog
				open={ confirming }
				onOpenChange={ ( open ) => ! open && setConfirming( false ) }
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{ __( 'Replace this link?', 'booking-suite' ) }
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ __(
								'The current link stops working immediately. Every portal already using it will fail to read the calendar until you give them the new one — so only do this if the link has been shared somewhere it should not have been.',
								'booking-suite'
							) }
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{ __( 'Cancel', 'booking-suite' ) }
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={ () => {
								setConfirming( false );
								create( true );
							} }
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{ __( 'Replace link', 'booking-suite' ) }
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export default function ExportCard( { apartments, onChanged } ) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Share2 className="h-4 w-4 text-muted-foreground" />
					{ __( 'Export links', 'booking-suite' ) }
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					{ __(
						'Give these to Airbnb or Booking.com and they will block the dates this site has taken. One link per apartment — the same kind of link they give you.',
						'booking-suite'
					) }
				</p>
			</CardHeader>

			<CardContent className="flex flex-col gap-3">
				{ apartments.map( ( apartment ) => (
					<ApartmentRow
						key={ apartment.id }
						apartment={ apartment }
						onChanged={ onChanged }
					/>
				) ) }

				<p className="text-xs text-muted-foreground">
					{ __(
						'The file says only when the apartment is taken — never who by. Anyone holding the link can read it, so treat it as private and replace it if it gets out.',
						'booking-suite'
					) }
				</p>
			</CardContent>
		</Card>
	);
}
