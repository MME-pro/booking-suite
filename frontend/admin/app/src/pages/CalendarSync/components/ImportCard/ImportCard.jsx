/**
 * ImportCard — read a portal's .ics export into one apartment's calendar.
 *
 * Deliberately two steps. Picking a file shows what it would do and writes
 * nothing; a second, separate press applies it. An import can take an apartment
 * off sale for a year, and the operator should see that before it happens
 * rather than discover it afterwards.
 *
 * The file is read here in the browser and sent as text — see the note in
 * IcalController for why it never becomes a media library upload.
 */

import { useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AlertCircle,
	CheckCircle2,
	FileUp,
	Loader2,
	Upload,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { icalService } from '../../../../services';
import { ImportReport } from '../ImportReport';

export default function ImportCard( { apartments, onImported } ) {
	const fileInput = useRef( null );

	const [ apartmentId, setApartmentId ] = useState( '' );
	const [ file, setFile ] = useState( null );
	const [ content, setContent ] = useState( '' );
	const [ removeMissing, setRemoveMissing ] = useState( false );
	const [ skipPast, setSkipPast ] = useState( true );

	const [ report, setReport ] = useState( null );
	const [ busy, setBusy ] = useState( '' );
	const [ error, setError ] = useState( null );
	const [ done, setDone ] = useState( null );

	// Any change to what would be imported invalidates the preview on screen,
	// so it can never be applied under options it was not taken with.
	const invalidate = () => {
		setReport( null );
		setDone( null );
	};

	const reset = () => {
		setFile( null );
		setContent( '' );
		invalidate();

		if ( fileInput.current ) {
			fileInput.current.value = '';
		}
	};

	const values = () => ( {
		apartmentId: Number( apartmentId ),
		content,
		removeMissing,
		skipPast,
	} );

	const handleFile = async ( event ) => {
		const picked = event.target.files?.[ 0 ] ?? null;

		invalidate();
		setError( null );
		setFile( picked );
		setContent( '' );

		if ( ! picked ) {
			return;
		}

		try {
			setContent( await icalService.readFile( picked ) );
		} catch ( cause ) {
			setError( cause.message );
			setFile( null );
		}
	};

	const runPreview = async () => {
		setBusy( 'preview' );
		setError( null );
		setDone( null );

		try {
			setReport( await icalService.preview( values() ) );
		} catch ( cause ) {
			setError( cause.message );
			setReport( null );
		} finally {
			setBusy( '' );
		}
	};

	const runImport = async () => {
		setBusy( 'import' );
		setError( null );

		try {
			const applied = await icalService.apply( values() );

			setReport( applied );
			setDone( applied.counts );
			onImported?.( applied );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( '' );
		}
	};

	const ready = '' !== apartmentId && '' !== content;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<FileUp className="h-4 w-4 text-muted-foreground" />
					{ __( 'Import a calendar file', 'booking-suite' ) }
				</CardTitle>
				<p className="text-sm text-muted-foreground">
					{ __(
						'Export the .ics file from Airbnb or Booking.com and upload it here. The dates it holds are blocked for the apartment you choose.',
						'booking-suite'
					) }
				</p>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				{ error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>
							{ __( 'That did not work', 'booking-suite' ) }
						</AlertTitle>
						<AlertDescription>{ error }</AlertDescription>
					</Alert>
				) }

				{ done && (
					<Alert>
						<CheckCircle2 className="h-4 w-4" />
						<AlertTitle>
							{ __( 'Calendar imported', 'booking-suite' ) }
						</AlertTitle>
						<AlertDescription>
							{ sprintf(
								/* translators: 1: dates added, 2: dates changed, 3: dates released. */
								__(
									'%1$d blocked, %2$d changed, %3$d released.',
									'booking-suite'
								),
								done.added,
								done.updated,
								done.removed
							) }
						</AlertDescription>
					</Alert>
				) }

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="bks-ical-apartment">
							{ __( 'Apartment', 'booking-suite' ) }
						</Label>
						<Select
							value={ apartmentId }
							onValueChange={ ( next ) => {
								setApartmentId( next );
								invalidate();
							} }
						>
							<SelectTrigger id="bks-ical-apartment">
								<SelectValue
									placeholder={ __(
										'Choose an apartment…',
										'booking-suite'
									) }
								/>
							</SelectTrigger>
							<SelectContent>
								{ apartments.map( ( apartment ) => (
									<SelectItem
										key={ apartment.id }
										value={ String( apartment.id ) }
									>
										{ apartment.name }
									</SelectItem>
								) ) }
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="bks-ical-file">
							{ __( 'Calendar file', 'booking-suite' ) }
						</Label>
						<input
							id="bks-ical-file"
							ref={ fileInput }
							type="file"
							accept=".ics,text/calendar"
							onChange={ handleFile }
							className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent text-sm text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<div className="flex items-start gap-2">
						<Checkbox
							id="bks-ical-skip-past"
							checked={ skipPast }
							onCheckedChange={ ( next ) => {
								setSkipPast( Boolean( next ) );
								invalidate();
							} }
						/>
						<Label
							htmlFor="bks-ical-skip-past"
							className="text-sm font-normal leading-snug"
						>
							{ __(
								'Ignore dates that have already passed',
								'booking-suite'
							) }
							<span className="block text-xs text-muted-foreground">
								{ __(
									'A portal export usually carries a year of history there is no point blocking.',
									'booking-suite'
								) }
							</span>
						</Label>
					</div>

					<div className="flex items-start gap-2">
						<Checkbox
							id="bks-ical-remove-missing"
							checked={ removeMissing }
							onCheckedChange={ ( next ) => {
								setRemoveMissing( Boolean( next ) );
								invalidate();
							} }
						/>
						<Label
							htmlFor="bks-ical-remove-missing"
							className="text-sm font-normal leading-snug"
						>
							{ __(
								'Release dates this calendar no longer holds',
								'booking-suite'
							) }
							<span className="block text-xs text-muted-foreground">
								{ __(
									'Makes the apartment match the file exactly, so a cancellation at the portal puts the dates back on sale here. Only affects dates imported from this same portal — never a lock you made yourself.',
									'booking-suite'
								) }
							</span>
						</Label>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						onClick={ runPreview }
						disabled={ ! ready || '' !== busy }
						variant={ report ? 'outline' : 'default' }
					>
						{ 'preview' === busy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<FileUp className="h-4 w-4" />
						) }
						{ __( 'Check the file', 'booking-suite' ) }
					</Button>

					{ report && ! done && (
						<Button onClick={ runImport } disabled={ '' !== busy }>
							{ 'import' === busy ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Upload className="h-4 w-4" />
							) }
							{ __( 'Import these dates', 'booking-suite' ) }
						</Button>
					) }

					{ file && (
						<Button
							variant="ghost"
							onClick={ reset }
							disabled={ '' !== busy }
						>
							{ __( 'Clear', 'booking-suite' ) }
						</Button>
					) }

					{ file && (
						<span className="text-xs text-muted-foreground">
							{ file.name }
						</span>
					) }
				</div>

				{ report && <ImportReport report={ report } /> }
			</CardContent>
		</Card>
	);
}
