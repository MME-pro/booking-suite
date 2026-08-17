/**
 * FeedForm — subscribe an apartment to a portal calendar, or amend one.
 *
 * Same shape as the other dialogs on the admin: shadcn Dialog around a
 * react-hook-form + zod form.
 *
 * The URL is the only field that needs care. Portals hand it out as a
 * webcal:// link as often as an https:// one — the two are the same address
 * with a different scheme, so both are accepted and the server stores https.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { icalService } from '../../../../services';

const schema = z.object( {
	apartmentId: z
		.string()
		.min( 1, __( 'Choose an apartment.', 'booking-suite' ) ),
	name: z.string().max( 191 ).optional(),
	url: z
		.string()
		.min( 1, __( 'Paste the calendar link.', 'booking-suite' ) )
		.refine(
			( value ) => /^(https?|webcal):\/\/\S+$/i.test( value.trim() ),
			__(
				'That should be a link starting with https:// or webcal://',
				'booking-suite'
			)
		),
	source: z.string().min( 1 ),
	active: z.boolean(),
} );

export default function FeedForm( {
	feed = null,
	apartments,
	sources,
	onClose,
	onSaved,
} ) {
	const [ error, setError ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: {
			apartmentId: feed ? String( feed.apartmentId ) : '',
			name: feed?.name ?? '',
			url: feed?.url ?? '',
			source: feed?.source ?? 'airbnb',
			active: feed ? feed.active : true,
		},
	} );

	const submit = async ( values ) => {
		setError( null );

		const payload = {
			apartmentId: Number( values.apartmentId ),
			name: values.name ?? '',
			url: values.url.trim(),
			source: values.source,
			active: values.active,
		};

		try {
			const saved = feed
				? await icalService.updateFeed( feed.id, payload )
				: await icalService.createFeed( payload );

			onSaved( saved );
		} catch ( cause ) {
			// A field-scoped rejection belongs on the field, not in a banner.
			if ( cause.field && form.getValues( cause.field ) !== undefined ) {
				form.setError( cause.field, { message: cause.message } );
				return;
			}

			setError( cause.message );
		}
	};

	return (
		<Dialog open onOpenChange={ ( open ) => ! open && onClose() }>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{ feed
							? __( 'Edit subscription', 'booking-suite' )
							: __( 'Add a subscription', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Booking Suite reads the calendar every 15 minutes and blocks the dates it holds. Nothing is sent to the portal.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				{ error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{ error }</AlertDescription>
					</Alert>
				) }

				<Form { ...form }>
					<form
						onSubmit={ form.handleSubmit( submit ) }
						className="flex flex-col gap-4"
					>
						<FormField
							control={ form.control }
							name="apartmentId"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Apartment', 'booking-suite' ) }
									</FormLabel>
									<Select
										value={ field.value }
										onValueChange={ field.onChange }
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue
													placeholder={ __(
														'Choose an apartment…',
														'booking-suite'
													) }
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{ apartments.map( ( apartment ) => (
												<SelectItem
													key={ apartment.id }
													value={ String(
														apartment.id
													) }
												>
													{ apartment.name }
												</SelectItem>
											) ) }
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="source"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Portal', 'booking-suite' ) }
									</FormLabel>
									<Select
										value={ field.value }
										onValueChange={ field.onChange }
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{ sources.map( ( source ) => (
												<SelectItem
													key={ source.value }
													value={ source.value }
												>
													{ source.label }
												</SelectItem>
											) ) }
										</SelectContent>
									</Select>
									<FormDescription>
										{ __(
											'Only used until the first sync — after that the file says who wrote it.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="url"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __(
											'Calendar link',
											'booking-suite'
										) }
									</FormLabel>
									<FormControl>
										<Input
											{ ...field }
											placeholder="https://www.airbnb.com/calendar/ical/…"
											autoComplete="off"
											spellCheck="false"
										/>
									</FormControl>
									<FormDescription>
										{ __(
											'Airbnb: Calendar → Availability → Connect calendars. Booking.com: Rates & Availability → Sync calendars.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="name"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __(
											'Label (optional)',
											'booking-suite'
										) }
									</FormLabel>
									<FormControl>
										<Input
											{ ...field }
											placeholder={ __(
												'e.g. Studio · Airbnb',
												'booking-suite'
											) }
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="active"
							render={ ( { field } ) => (
								<FormItem className="flex flex-row items-start gap-2 space-y-0">
									<FormControl>
										<Checkbox
											checked={ field.value }
											onCheckedChange={ field.onChange }
										/>
									</FormControl>
									<div className="leading-snug">
										<FormLabel className="font-normal">
											{ __(
												'Sync this calendar automatically',
												'booking-suite'
											) }
										</FormLabel>
										<FormDescription>
											{ __(
												'Switch off to pause the scheduled pull without losing the link.',
												'booking-suite'
											) }
										</FormDescription>
									</div>
								</FormItem>
							) }
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={ onClose }
							>
								{ __( 'Cancel', 'booking-suite' ) }
							</Button>
							<Button
								type="submit"
								disabled={ form.formState.isSubmitting }
							>
								{ feed
									? __( 'Save', 'booking-suite' )
									: __(
											'Add subscription',
											'booking-suite'
									  ) }
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
