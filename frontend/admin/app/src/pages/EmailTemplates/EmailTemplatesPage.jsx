/**
 * EmailTemplatesPage — the three emails a guest receives.
 *
 * Each one is tied to a moment in the booking: the request arriving, the owner
 * approving it, and the payment landing. Switching a template off stops that
 * email without touching the rest.
 */

import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { AlertCircle, CheckCircle2, Mail, RotateCcw, Send } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import RichText from '@/components/RichText/RichText';

import { emailTemplateService } from '../../services';
import EmailPreview from './components/EmailPreview/EmailPreview';

export default function EmailTemplatesPage() {
	const [ templates, setTemplates ] = useState( [] );
	const [ placeholders, setPlaceholders ] = useState( {} );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ notice, setNotice ] = useState( null );

	/** Unsaved edits, keyed by template. */
	const [ drafts, setDrafts ] = useState( {} );
	const [ busyKey, setBusyKey ] = useState( null );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await emailTemplateService.list( signal );

			setTemplates( payload.templates );
			setPlaceholders( payload.placeholders );
			setDrafts( {} );
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

	/**
	 * The draft if the template has been touched, otherwise what was stored.
	 *
	 * @param {Object} template The stored template.
	 * @return {Object} What the fields should show.
	 */
	const valueOf = ( template ) => drafts[ template.key ] ?? template;

	const edit = ( key, changes ) =>
		setDrafts( ( current ) => ( {
			...current,
			[ key ]: { ...( current[ key ] ?? {} ), ...changes },
		} ) );

	const applyResult = ( saved ) => {
		setTemplates( ( current ) =>
			current.map( ( item ) => ( item.key === saved.key ? saved : item ) )
		);

		setDrafts( ( current ) => {
			const next = { ...current };

			delete next[ saved.key ];

			return next;
		} );
	};

	const run = async ( key, work, message ) => {
		setBusyKey( key );
		setNotice( null );

		try {
			const result = await work();

			if ( result?.key ) {
				applyResult( result );
			}

			setError( null );
			setNotice( message );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyKey( null );
		}
	};

	if ( isLoading ) {
		return (
			<div className="flex flex-col gap-4">
				{ [ 0, 1, 2 ].map( ( key ) => (
					<Card key={ key }>
						<CardContent className="flex flex-col gap-3 p-5">
							<Skeleton className="h-5 w-52" />
							<Skeleton className="h-9 w-full" />
							<Skeleton className="h-40 w-full" />
						</CardContent>
					</Card>
				) ) }
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
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			{ notice && (
				<Alert className="border-success/30 bg-success/5 text-success [&>svg]:text-success">
					<CheckCircle2 className="h-4 w-4" />
					<AlertDescription>{ notice }</AlertDescription>
				</Alert>
			) }

			<PlaceholderHelp placeholders={ placeholders } />

			{ /*
			 * Side by side, wrapping to one column when there is no room. Two
			 * across is the ceiling rather than three: each card holds a
			 * full-width message box, and a third column would leave it too
			 * narrow to read a line of the email in.
			 */ }
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				{ templates.map( ( template ) => {
					const value = valueOf( template );
					const isDirty = Boolean( drafts[ template.key ] );
					const isBusy = busyKey === template.key;

					return (
						<Card key={ template.key } className="flex flex-col">
							{ /* Wraps rather than squeezing the switch on a phone. */ }
							<CardHeader className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 space-y-0">
								<div className="flex min-w-0 flex-col gap-1">
									<CardTitle className="flex items-center gap-2 text-base">
										<Mail className="h-4 w-4 text-muted-foreground" />
										{ template.label }
										{ template.isCustom && (
											<Badge
												variant="secondary"
												className="font-normal"
											>
												{ __(
													'Edited',
													'booking-suite'
												) }
											</Badge>
										) }
									</CardTitle>
									<CardDescription>
										{ template.description }
									</CardDescription>
								</div>

								{ /* Off means this one email stops; the others carry on. */ }
								<div className="flex shrink-0 items-center gap-2 text-sm">
									<Switch
										id={ `${ template.key }-enabled` }
										checked={ value.enabled }
										onCheckedChange={ ( enabled ) =>
											edit( template.key, { enabled } )
										}
									/>
									<Label
										htmlFor={ `${ template.key }-enabled` }
										className="text-muted-foreground"
									>
										{ value.enabled
											? __( 'On', 'booking-suite' )
											: __( 'Off', 'booking-suite' ) }
									</Label>
								</div>
							</CardHeader>

							{ /* flex-1 so cards in the same row end level. */ }
							<CardContent className="flex flex-1 flex-col gap-4">
								<div className="flex flex-col gap-1.5">
									<Label
										htmlFor={ `${ template.key }-subject` }
									>
										{ __( 'Subject', 'booking-suite' ) }
									</Label>
									<Input
										id={ `${ template.key }-subject` }
										value={ value.subject }
										onChange={ ( event ) =>
											edit( template.key, {
												subject: event.target.value,
											} )
										}
									/>
								</div>

								{ /*
								 * Only the message is edited here. The header,
								 * the logo and the footer come from the master
								 * layout, which is why Preview shows more than
								 * what is being typed.
								 */ }
								<Tabs
									defaultValue="edit"
									className="flex flex-1 flex-col gap-1.5"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<Label
											htmlFor={ `${ template.key }-body` }
										>
											{ __( 'Message', 'booking-suite' ) }
										</Label>

										<TabsList>
											<TabsTrigger value="edit">
												{ __(
													'Edit',
													'booking-suite'
												) }
											</TabsTrigger>
											<TabsTrigger value="preview">
												{ __(
													'Preview',
													'booking-suite'
												) }
											</TabsTrigger>
										</TabsList>
									</div>

									{ /*
									 * forceMount keeps the editor in the DOM
									 * while Preview is showing. TinyMCE cannot
									 * survive being unmounted and remounted on
									 * every tab switch.
									 */ }
									<TabsContent
										value="edit"
										forceMount
										className="mt-0 flex-1 data-[state=inactive]:hidden"
									>
										<RichText
											id={ `${ template.key }-body` }
											rows={ 14 }
											value={ value.body }
											onChange={ ( body ) =>
												edit( template.key, { body } )
											}
										/>
										<p className="mt-1.5 text-xs text-muted-foreground">
											{ __(
												'The logo, header and footer are added automatically from Settings.',
												'booking-suite'
											) }
										</p>
									</TabsContent>

									<TabsContent
										value="preview"
										className="mt-0 flex-1"
									>
										<EmailPreview
											templateKey={ template.key }
											subject={ value.subject }
											body={ value.body }
										/>
									</TabsContent>
								</Tabs>

								<Separator />

								<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
									<TestSend
										templateKey={ template.key }
										disabled={ isBusy }
										onSend={ ( email ) =>
											run(
												template.key,
												() =>
													emailTemplateService.test(
														template.key,
														email
													),
												__(
													'Test email sent.',
													'booking-suite'
												)
											)
										}
									/>

									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											disabled={
												isBusy || ! template.isCustom
											}
											onClick={ () =>
												run(
													template.key,
													() =>
														emailTemplateService.reset(
															template.key
														),
													__(
														'Template restored to the original text.',
														'booking-suite'
													)
												)
											}
										>
											<RotateCcw className="h-4 w-4" />
											{ __( 'Reset', 'booking-suite' ) }
										</Button>

										<Button
											size="sm"
											disabled={ isBusy || ! isDirty }
											onClick={ () =>
												run(
													template.key,
													() =>
														emailTemplateService.save(
															template.key,
															{
																subject:
																	value.subject,
																body: value.body,
																enabled:
																	value.enabled,
															}
														),
													__(
														'Template saved.',
														'booking-suite'
													)
												)
											}
										>
											{ isBusy
												? __(
														'Saving…',
														'booking-suite'
												  )
												: __(
														'Save',
														'booking-suite'
												  ) }
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				} ) }
			</div>
		</div>
	);
}

function PlaceholderHelp( { placeholders } ) {
	const entries = Object.entries( placeholders );

	if ( ! entries.length ) {
		return null;
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">
					{ __( 'Placeholders', 'booking-suite' ) }
				</CardTitle>
				<CardDescription>
					{ __(
						'Drop any of these into a subject or message and the booking fills them in. Anything unrecognised is left alone.',
						'booking-suite'
					) }
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
					{ entries.map( ( [ token, description ] ) => (
						<div
							key={ token }
							className="flex items-baseline justify-between gap-3 text-sm"
						>
							<dt className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-card-foreground">
								{ token }
							</dt>
							<dd className="text-right text-xs text-muted-foreground">
								{ description }
							</dd>
						</div>
					) ) }
				</dl>
			</CardContent>
		</Card>
	);
}

function TestSend( { disabled, onSend } ) {
	const [ email, setEmail ] = useState( '' );

	return (
		<form
			/* Takes the row on a phone rather than pushing the buttons off it. */
			className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap"
			onSubmit={ ( event ) => {
				event.preventDefault();

				if ( email ) {
					onSend( email );
				}
			} }
		>
			<Input
				type="email"
				value={ email }
				onChange={ ( event ) => setEmail( event.target.value ) }
				placeholder={ __( 'you@example.com', 'booking-suite' ) }
				aria-label={ __( 'Send a test to', 'booking-suite' ) }
				className="w-full min-w-0 flex-1 sm:w-56 sm:flex-none"
			/>
			<Button
				type="submit"
				variant="outline"
				size="sm"
				disabled={ disabled || ! email }
			>
				<Send className="h-4 w-4" />
				{ __( 'Send test', 'booking-suite' ) }
			</Button>
		</form>
	);
}
