/**
 * ApartmentForm — every writable column of `mmebk_rooms`, in a dialog.
 *
 * Built on the shadcn/ui Form (react-hook-form + zod). Values are kept in the
 * same shapes the REST layer already received — numbers stay strings — so the
 * saved payload is unchanged from the previous hand-rolled version; the schema
 * adds the validation that used to be left to the server.
 *
 * ImageUpload is deliberately still the existing component: it wraps wp.media,
 * which has no shadcn equivalent.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, HelpCircle } from 'lucide-react';

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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

import { ImageUpload } from '../../../../components';
import { apartmentService } from '../../../../services';
import {
	MAX_CAPACITY,
	MAX_LENGTH_191,
	MIN_CAPACITY,
	cleaningOptions,
	emptyApartment,
} from '../../data/apartment.schema';
import './ApartmentForm.css';

const DESCRIPTION_MODES = [
	{ value: 'text', label: __( 'Text', 'booking-suite' ) },
	{ value: 'html', label: __( 'HTML', 'booking-suite' ) },
];

/**
 * A whole number held as a string, within the column's range.
 *
 * @param {Object} range
 * @param {number} range.min     Lowest accepted value.
 * @param {number} [range.max]   Highest accepted value, if the column caps it.
 * @param {string} range.message Shown when the value falls outside the range.
 * @return {import('zod').ZodString} The guarded string schema.
 */
const numericString = ( { min, max, message } ) =>
	z.string().refine( ( value ) => {
		const parsed = Number( value );

		return (
			'' !== value &&
			Number.isFinite( parsed ) &&
			parsed >= min &&
			( undefined === max || parsed <= max )
		);
	}, message );

const schema = z.object( {
	name: z
		.string()
		.min( 1, __( 'Give the apartment a name.', 'booking-suite' ) )
		.max( MAX_LENGTH_191 ),
	colour: z
		.string()
		.regex(
			/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
			__( 'Pick a colour.', 'booking-suite' )
		),
	active: z.boolean(),
	capacity: numericString( {
		min: MIN_CAPACITY,
		max: MAX_CAPACITY,
		message: __( 'Enter how many guests fit.', 'booking-suite' ),
	} ),
	cleaningMin: z.string(),
	holidayHesse: z.boolean(),
	weekdayRate: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	weekendRate: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	internalShortLink: z.string().max( MAX_LENGTH_191 ).optional(),
	bookingShortLink: z.string().max( MAX_LENGTH_191 ).optional(),
	description: z.string().optional(),
	images: z.any(),
} );

/**
 * A stored apartment into form values.
 *
 * capacity and cleaningMin come back from the REST layer as numbers, while the
 * form (and the schema) works in strings — the inputs produce strings, and
 * apartmentService.toPayload() parses them back on the way out. Coercing here
 * keeps editing an existing apartment from failing validation on type alone.
 *
 * @param {Object} apartment The apartment as returned by apartmentService.
 * @return {Object} Form values.
 */
const fromApartment = ( apartment ) => ( {
	...emptyApartment(),
	...apartment,
	capacity: String( apartment.capacity ?? '' ),
	cleaningMin: String( apartment.cleaningMin ?? '' ),
} );

export default function ApartmentForm( {
	apartment = null,
	onClose,
	onSaved,
} ) {
	const isEdit = null !== apartment;

	const [ descriptionMode, setDescriptionMode ] = useState( 'text' );
	const [ error, setError ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: isEdit ? fromApartment( apartment ) : emptyApartment(),
	} );

	const isSaving = form.formState.isSubmitting;

	const handleSave = async ( values ) => {
		setError( null );

		try {
			const saved = isEdit
				? await apartmentService.update( apartment.id, values )
				: await apartmentService.create( values );

			onSaved( saved );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	return (
		<Dialog
			open
			onOpenChange={ ( next ) => {
				if ( ! next && ! isSaving ) {
					onClose();
				}
			} }
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>
						{ isEdit
							? __( 'Edit Apartment', 'booking-suite' )
							: __( 'Add Apartment', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Set up the apartment guests will see and book.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<Form { ...form }>
					<form
						id="bks-apartment-form"
						onSubmit={ form.handleSubmit( handleSave ) }
						className="flex flex-col gap-6"
					>
						{ error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{ error }</AlertDescription>
							</Alert>
						) }

						{ /* name, images, colour, active */ }
						<Section
							title={ __( 'Details', 'booking-suite' ) }
							description={ __(
								'How this apartment is identified across the calendar and the website.',
								'booking-suite'
							) }
						>
							<div className="flex flex-col gap-4 sm:flex-row">
								<FormField
									control={ form.control }
									name="images"
									render={ ( { field } ) => (
										<FormItem className="shrink-0">
											<ImageUpload
												images={ field.value }
												onChange={ field.onChange }
											/>
										</FormItem>
									) }
								/>

								<div className="flex min-w-0 flex-1 flex-col gap-4">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
										<FormField
											control={ form.control }
											name="name"
											render={ ( { field } ) => (
												<FormItem>
													<FormLabel>
														{ __(
															'Name',
															'booking-suite'
														) }{ ' ' }
														<Required />
													</FormLabel>
													<FormControl>
														<Input
															maxLength={
																MAX_LENGTH_191
															}
															placeholder={ __(
																'e.g. Studio Rheinblick',
																'booking-suite'
															) }
															{ ...field }
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											) }
										/>

										<FormField
											control={ form.control }
											name="colour"
											render={ ( { field } ) => (
												<FormItem>
													<FormLabel>
														{ __(
															'Color',
															'booking-suite'
														) }{ ' ' }
														<Required />
													</FormLabel>
													<FormControl>
														<Input
															type="color"
															className="h-9 w-16 cursor-pointer p-1"
															{ ...field }
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											) }
										/>
									</div>

									<FormField
										control={ form.control }
										name="active"
										render={ ( { field } ) => (
											<FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
												<div className="space-y-0.5">
													<FormLabel>
														{ __(
															'Active',
															'booking-suite'
														) }
													</FormLabel>
													<FormDescription>
														{ __(
															'Inactive apartments stay in the list but cannot be booked.',
															'booking-suite'
														) }
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={ field.value }
														onCheckedChange={
															field.onChange
														}
													/>
												</FormControl>
											</FormItem>
										) }
									/>
								</div>
							</div>
						</Section>

						<Separator />

						{ /* capacity, cleaning_min, holiday_hesse */ }
						<Section
							title={ __(
								'Capacity & turnaround',
								'booking-suite'
							) }
							description={ __(
								'How many guests fit, and how long the apartment is blocked between stays.',
								'booking-suite'
							) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<FormField
									control={ form.control }
									name="capacity"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Guests',
													'booking-suite'
												) }{ ' ' }
												<Required />
											</FormLabel>
											<FormControl>
												<Input
													type="number"
													inputMode="numeric"
													min={ MIN_CAPACITY }
													max={ MAX_CAPACITY }
													{ ...field }
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="cleaningMin"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel className="flex items-center gap-1.5">
												{ __(
													'Cleaning time',
													'booking-suite'
												) }{ ' ' }
												<Required />
												<Hint
													text={ __(
														'Turnaround blocked after each stay.',
														'booking-suite'
													) }
												/>
											</FormLabel>
											<Select
												value={ String( field.value ) }
												onValueChange={ field.onChange }
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ cleaningOptions().map(
														( option ) => (
															<SelectItem
																key={
																	option.value
																}
																value={
																	option.value
																}
															>
																{ option.label }
															</SelectItem>
														)
													) }
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>

							<FormField
								control={ form.control }
								name="holidayHesse"
								render={ ( { field } ) => (
									<FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
										<FormControl>
											<Checkbox
												checked={ field.value }
												onCheckedChange={
													field.onChange
												}
											/>
										</FormControl>
										<div className="space-y-0.5 leading-none">
											<FormLabel>
												{ __(
													'Follow Hesse public holidays',
													'booking-suite'
												) }
											</FormLabel>
											<FormDescription>
												{ __(
													'Hesse public holidays are treated as blocked days for this apartment.',
													'booking-suite'
												) }
											</FormDescription>
										</div>
									</FormItem>
								) }
							/>
						</Section>

						<Separator />

						{ /* weekday_rate, weekend_rate */ }
						<Section title={ __( 'Rates', 'booking-suite' ) }>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<RateField
									form={ form }
									name="weekdayRate"
									label={ __(
										'Weekday rate (Sun–Thu)',
										'booking-suite'
									) }
								/>
								<RateField
									form={ form }
									name="weekendRate"
									label={ __(
										'Weekend rate (Fri/Sat)',
										'booking-suite'
									) }
								/>
							</div>
						</Section>

						<Separator />

						{ /* internal_short_link, booking_short_link */ }
						<Section
							title={ __( 'Short links', 'booking-suite' ) }
							description={ __(
								'Optional shortcuts to this apartment. Each must be unique across all apartments.',
								'booking-suite'
							) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<LinkField
									form={ form }
									name="internalShortLink"
									label={ __(
										'Internal short link',
										'booking-suite'
									) }
									placeholder="studio-rheinblick"
								/>
								<LinkField
									form={ form }
									name="bookingShortLink"
									label={ __(
										'Booking short link',
										'booking-suite'
									) }
									placeholder="book-rheinblick"
								/>
							</div>
						</Section>

						<Separator />

						{ /* description */ }
						<Section
							title={ __( 'Description', 'booking-suite' ) }
							description={ __(
								'Shown to guests on the website.',
								'booking-suite'
							) }
						>
							<Tabs
								value={ descriptionMode }
								onValueChange={ setDescriptionMode }
							>
								<TabsList>
									{ DESCRIPTION_MODES.map(
										( { value, label } ) => (
											<TabsTrigger
												key={ value }
												value={ value }
											>
												{ label }
											</TabsTrigger>
										)
									) }
								</TabsList>
							</Tabs>

							<FormField
								control={ form.control }
								name="description"
								render={ ( { field } ) => (
									<FormItem>
										<FormControl>
											<Textarea
												rows={ 8 }
												className={
													'html' === descriptionMode
														? 'font-mono text-xs'
														: ''
												}
												placeholder={
													'html' === descriptionMode
														? '<p>Describe the apartment…</p>'
														: __(
																'Describe the apartment…',
																'booking-suite'
														  )
												}
												{ ...field }
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								) }
							/>
						</Section>
					</form>
				</Form>

				<DialogFooter className="items-center gap-3 sm:justify-between">
					<span className="text-xs text-muted-foreground">
						{ __(
							'Fields marked * are required.',
							'booking-suite'
						) }
					</span>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={ onClose }
							disabled={ isSaving }
						>
							{ __( 'Close', 'booking-suite' ) }
						</Button>
						<Button
							type="submit"
							form="bks-apartment-form"
							disabled={ isSaving }
						>
							{ isSaving
								? __( 'Saving…', 'booking-suite' )
								: __( 'Save Apartment', 'booking-suite' ) }
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Section( { title, description = null, children } ) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{ title }
				</h3>
				{ description && (
					<p className="text-xs text-muted-foreground">
						{ description }
					</p>
				) }
			</div>
			{ children }
		</section>
	);
}

const Required = () => (
	<span className="text-destructive" aria-hidden="true">
		*
	</span>
);

function Hint( { text } ) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="text-muted-foreground"
						aria-label={ text }
					>
						<HelpCircle className="h-3.5 w-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent>{ text }</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function RateField( { form, name, label } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ label }</FormLabel>
					<FormControl>
						<Input
							type="number"
							min="0"
							step="0.01"
							inputMode="decimal"
							{ ...field }
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}

function LinkField( { form, name, label, placeholder } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ label }</FormLabel>
					<FormControl>
						<Input
							maxLength={ MAX_LENGTH_191 }
							placeholder={ placeholder }
							{ ...field }
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}
