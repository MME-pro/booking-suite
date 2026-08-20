/**
 * TemplateEditor — the right pane: the email that is open, and its preview.
 *
 * One template at a time, which is what makes the pane worth having: with the
 * whole width to itself the message box is wide enough to read a real line of
 * the email in.
 *
 * Edit and Preview take turns behind a tab rather than sharing the pane. An
 * email is a column of text and both halves want the full width — side by side
 * they become two narrow strips, and neither is comfortable to read or to type
 * into.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Mail, RotateCcw, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import RichText from '@/components/RichText/RichText';

import EmailPreview from '../EmailPreview/EmailPreview';

export default function TemplateEditor( {
	template,
	value,
	isDirty,
	isBusy,
	onEdit,
	onSave,
	onReset,
	onTest,
} ) {
	return (
		<Card className="flex h-full flex-col lg:min-h-[calc(100vh-16rem)]">
			<CardHeader className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 space-y-0">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="flex items-center gap-2 text-base font-semibold text-card-foreground">
						<Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0 truncate">
							{ template.label }
						</span>
						{ template.isCustom && (
							<Badge variant="secondary" className="font-normal">
								{ __( 'Edited', 'booking-suite' ) }
							</Badge>
						) }
					</h2>
					<p className="text-sm text-muted-foreground">
						{ template.description }
					</p>
				</div>

				{ /* Off means this one email stops; the others carry on. */ }
				<div className="flex shrink-0 items-center gap-2 text-sm">
					<Switch
						id={ `${ template.key }-enabled` }
						checked={ value.enabled }
						onCheckedChange={ ( enabled ) => onEdit( { enabled } ) }
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

			<CardContent className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={ `${ template.key }-subject` }>
						{ __( 'Subject', 'booking-suite' ) }
					</Label>
					<Input
						id={ `${ template.key }-subject` }
						value={ value.subject }
						onChange={ ( event ) =>
							onEdit( { subject: event.target.value } )
						}
					/>
				</div>

				{ /*
				 * Only the message is edited here. The header, the logo and the
				 * footer come from the master layout, which is why the preview
				 * shows more than what is being typed.
				 *
				 * Edit and Preview take turns rather than sitting side by side.
				 * Both need the full width of the pane to be worth reading — an
				 * email is a column of text, and half a pane each turns them
				 * into two narrow strips.
				 */ }
				<Tabs
					defaultValue="edit"
					className="flex min-h-0 flex-1 flex-col gap-1.5"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Label htmlFor={ `${ template.key }-body` }>
							{ __( 'Message', 'booking-suite' ) }
						</Label>

						<TabsList>
							<TabsTrigger value="edit">
								{ __( 'Edit', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="preview">
								{ __( 'Preview', 'booking-suite' ) }
							</TabsTrigger>
						</TabsList>
					</div>

					{ /*
					 * forceMount keeps the editor in the DOM while Preview is
					 * showing. TinyMCE cannot survive being unmounted and
					 * remounted on every tab switch.
					 */ }
					<TabsContent
						value="edit"
						forceMount
						className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
					>
						<RichText
							fill
							id={ `${ template.key }-body` }
							rows={ 16 }
							value={ value.body }
							onChange={ ( body ) => onEdit( { body } ) }
						/>
						<p className="mt-1.5 shrink-0 text-xs text-muted-foreground">
							{ __(
								'The logo, header and footer are added automatically from Settings.',
								'booking-suite'
							) }
						</p>
					</TabsContent>

					{ /*
					 * `data-[state=inactive]:hidden` is doing real work, not
					 * belt and braces. Radix hides an inactive panel with the
					 * `hidden` attribute, which relies on `[hidden]{display:none}`
					 * — and the `flex` class on this same element overrides it,
					 * because the two have equal specificity and utilities come
					 * later in the stylesheet. Without this the hidden panel
					 * stays a flex item and takes half the height the editor
					 * should have had.
					 */ }
					<TabsContent
						value="preview"
						className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
					>
						<EmailPreview
							templateKey={ template.key }
							subject={ value.subject }
							body={ value.body }
						/>
					</TabsContent>
				</Tabs>

				<Separator />

				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
					<TestSend disabled={ isBusy } onSend={ onTest } />

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="min-w-0 flex-1 sm:flex-none"
							disabled={ isBusy || ! template.isCustom }
							onClick={ onReset }
						>
							<RotateCcw className="h-4 w-4 shrink-0" />
							<span className="truncate">
								{ __( 'Reset', 'booking-suite' ) }
							</span>
						</Button>

						<Button
							size="sm"
							className="min-w-0 flex-1 sm:flex-none"
							disabled={ isBusy || ! isDirty }
							onClick={ onSave }
						>
							<span className="truncate">
								{ isBusy
									? __( 'Saving…', 'booking-suite' )
									: __( 'Save', 'booking-suite' ) }
							</span>
						</Button>
					</div>
				</div>
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
				<Send className="h-4 w-4 shrink-0" />
				<span className="truncate">
					{ __( 'Send test', 'booking-suite' ) }
				</span>
			</Button>
		</form>
	);
}
