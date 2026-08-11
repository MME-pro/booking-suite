/**
 * SettingsPage — plugin-wide settings.
 *
 * One for now: the currency bookings are priced in. Stored server-side (see
 * backend/APIs/SettingsController.php), so adding a second here is a field and
 * an enum entry, nothing more.
 *
 * There is deliberately no language setting. The plugin follows the WordPress
 * site language through its own translation catalogue, so a second control
 * could only ever disagree with Settings → General.
 *
 * Built on the shadcn/ui Form.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { settingsService } from '../../services';
import AccentColourField from './AccentColourField';
import InvoiceLogoField from './InvoiceLogoField';

/** Display names for the codes the API accepts. */
const CURRENCY_LABELS = {
	EUR: __( 'Euro (€)', 'booking-suite' ),
	USD: __( 'US Dollar ($)', 'booking-suite' ),
	GBP: __( 'Pound Sterling (£)', 'booking-suite' ),
	CHF: __( 'Swiss Franc (CHF)', 'booking-suite' ),
};

export default function SettingsPage() {
	const [ choices, setChoices ] = useState( { currencies: [], accents: [] } );
	// The logo's preview URL: the form holds only the attachment ID.
	const [ logoUrl, setLogoUrl ] = useState( '' );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ isSaved, setSaved ] = useState( false );

	const form = useForm( {
		defaultValues: {
			currency: 'EUR',
			accentColour: '#2563eb',
			invoiceLogo: 0,
			invoiceSender: '',
			invoicePrefix: 'INV',
			invoiceDueDays: 30,
			invoiceThanks: '',
			invoicePhone: '',
			invoiceEmail: '',
			invoiceNotice: '',
		},
	} );

	const { reset } = form;

	useEffect( () => {
		const controller = new AbortController();

		settingsService
			.get( controller.signal )
			.then( ( payload ) => {
				setChoices( payload.choices );
				setLogoUrl( payload.logo?.url ?? '' );
				reset( payload.settings );
				setError( null );
			} )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [ reset ] );

	const save = async ( values ) => {
		setError( null );
		setSaved( false );

		try {
			const payload = await settingsService.update( {
				...values,
				// The two numeric fields travel as numbers; a text input hands
				// back a string, which the endpoint's integer type rejects.
				invoiceLogo: Number( values.invoiceLogo ) || 0,
				invoiceDueDays: Number( values.invoiceDueDays ) || 0,
			} );

			setLogoUrl( payload.logo?.url ?? '' );
			reset( payload.settings );
			setSaved( true );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	const isSaving = form.formState.isSubmitting;

	if ( isLoading ) {
		return (
			<Card className="max-w-2xl">
				<CardContent className="flex flex-col gap-4 p-5">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="flex max-w-2xl flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not save settings', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			{ isSaved && (
				<Alert className="border-success/30 bg-success/5 text-success [&>svg]:text-success">
					<CheckCircle2 className="h-4 w-4" />
					<AlertDescription>
						{ __( 'Settings saved.', 'booking-suite' ) }
					</AlertDescription>
				</Alert>
			) }

			{ /*
			 * One form across both cards: General and Invoice are separate
			 * sections to read, but a single Save writes them together.
			 */ }
			<Form { ...form }>
				<form
					onSubmit={ form.handleSubmit( save ) }
					className="flex flex-col gap-4"
				>
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								{ __( 'General', 'booking-suite' ) }
							</CardTitle>
							<CardDescription>
								{ __(
									'How prices and the guest-facing booking flow are presented.',
									'booking-suite'
								) }
							</CardDescription>
						</CardHeader>

						<CardContent>
							<div className="flex flex-col gap-6">
								<FormField
									control={ form.control }
									name="currency"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Currency',
													'booking-suite'
												) }
											</FormLabel>
											<Select
												value={ field.value }
												onValueChange={ ( value ) => {
													setSaved( false );
													field.onChange( value );
												} }
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ choices.currencies.map(
														( code ) => (
															<SelectItem
																key={ code }
																value={ code }
															>
																{ CURRENCY_LABELS[
																	code
																] ?? code }
															</SelectItem>
														)
													) }
												</SelectContent>
											</Select>
											<FormDescription>
												{ __(
													'Bookings are priced and invoiced in this currency.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="accentColour"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Accent colour',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<AccentColourField
													value={ field.value }
													presets={ choices.accents }
													onChange={ ( next ) => {
														setSaved( false );
														field.onChange( next );
													} }
												/>
											</FormControl>
											<FormDescription>
												{ __(
													'The brand colour of the guest booking flow. Hover, pressed and tint shades are worked out from it, so one colour is all that is needed.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>
						</CardContent>
					</Card>

					{ /*
					 * The invoice generator. Everything the PDF prints that is not
					 * taken from the booking itself lives here, so the wording is
					 * the owner's to change.
					 */ }
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								{ __( 'Invoice generator', 'booking-suite' ) }
							</CardTitle>
							<CardDescription>
								{ __(
									'The invoice sent to the guest as a PDF when a payment is marked paid.',
									'booking-suite'
								) }
							</CardDescription>
						</CardHeader>

						<CardContent>
							<div className="flex flex-col gap-6">
								<FormField
									control={ form.control }
									name="invoiceLogo"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Logo',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<InvoiceLogoField
													value={ field.value }
													url={ logoUrl }
													onChange={ (
														id,
														nextUrl
													) => {
														setSaved( false );
														setLogoUrl( nextUrl );
														field.onChange( id );
													} }
												/>
											</FormControl>
											<FormDescription>
												{ __(
													'Printed at the top left of the invoice.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="invoiceSender"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Sender block',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<Textarea
													rows={ 6 }
													{ ...field }
													onChange={ ( event ) => {
														setSaved( false );
														field.onChange( event );
													} }
												/>
											</FormControl>
											<FormDescription>
												{ __(
													'Printed on the right, one line per line — company, address, telephone, email, VAT number.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>

								<div className="grid gap-4 sm:grid-cols-2">
									<FormField
										control={ form.control }
										name="invoicePrefix"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Invoice number prefix',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														{ ...field }
														onChange={ (
															event
														) => {
															setSaved( false );
															field.onChange(
																event
															);
														} }
													/>
												</FormControl>
												<FormDescription>
													{ __(
														'Numbers run PREFIX-YEAR-0001 and restart each year.',
														'booking-suite'
													) }
												</FormDescription>
												<FormMessage />
											</FormItem>
										) }
									/>

									<FormField
										control={ form.control }
										name="invoiceDueDays"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Payment term (days)',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														min="0"
														max="365"
														{ ...field }
														onChange={ (
															event
														) => {
															setSaved( false );
															field.onChange(
																event
															);
														} }
													/>
												</FormControl>
												<FormDescription>
													{ __(
														'Days from the invoice date to the due date.',
														'booking-suite'
													) }
												</FormDescription>
												<FormMessage />
											</FormItem>
										) }
									/>
								</div>

								<FormField
									control={ form.control }
									name="invoiceThanks"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Closing line',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<Textarea
													rows={ 2 }
													{ ...field }
													onChange={ ( event ) => {
														setSaved( false );
														field.onChange( event );
													} }
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									) }
								/>

								<div className="grid gap-4 sm:grid-cols-2">
									<FormField
										control={ form.control }
										name="invoicePhone"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Telephone',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														{ ...field }
														onChange={ (
															event
														) => {
															setSaved( false );
															field.onChange(
																event
															);
														} }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>

									<FormField
										control={ form.control }
										name="invoiceEmail"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Email',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="email"
														{ ...field }
														onChange={ (
															event
														) => {
															setSaved( false );
															field.onChange(
																event
															);
														} }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>
								</div>

								<FormField
									control={ form.control }
									name="invoiceNotice"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Notice',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<Textarea
													rows={ 2 }
													{ ...field }
													onChange={ ( event ) => {
														setSaved( false );
														field.onChange( event );
													} }
												/>
											</FormControl>
											<FormDescription>
												{ __(
													'Printed last, after a bold "Hinweis:" label.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>
						</CardContent>
					</Card>

					<div className="flex justify-end">
						<Button type="submit" disabled={ isSaving }>
							{ isSaving
								? __( 'Saving…', 'booking-suite' )
								: __( 'Save settings', 'booking-suite' ) }
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}
