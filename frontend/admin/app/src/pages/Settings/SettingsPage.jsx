/**
 * SettingsPage — everything the plugin is configured with, in tabs.
 *
 * One form across every tab, saved by one button. The tabs group the fields for
 * reading; they are not separate forms, so an owner setting up the plugin can
 * work through the lot and save once rather than six times.
 *
 * There is deliberately no language setting. The plugin follows the WordPress
 * site language through its own translation catalogue, so a second control
 * could only ever disagree with Settings → General.
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
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** Sent as numbers; a text input hands back strings the endpoint refuses. */
const NUMERIC = [
	'companyLogo',
	'invoiceDueDays',
	'invoiceCounter',
	'cooldownMinutes',
	'taxRate',
];

const blank = {
	currency: 'EUR',
	accentColour: '#2563eb',
	cooldownMinutes: 0,
	bankHolder: '',
	bankName: '',
	bankIban: '',
	bankBic: '',
	bankDetails: '',
	emailNotifications: true,
	companyName: '',
	companyAddress: '',
	companyPhone: '',
	companyEmail: '',
	companyLogo: 0,
	adminEmail: '',
	termsUrl: '',
	privacyUrl: '',
	invoiceCounter: 0,
	taxRate: 0,
	invoicePrefix: 'INV',
	invoiceDueDays: 30,
	invoiceThanks: '',
	invoiceNotice: '',
};

export default function SettingsPage() {
	const [ choices, setChoices ] = useState( { currencies: [], accents: [] } );
	// The logo's preview URL: the form holds only the attachment ID.
	const [ logoUrl, setLogoUrl ] = useState( '' );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ isSaved, setSaved ] = useState( false );

	const form = useForm( { defaultValues: blank } );

	const { reset } = form;

	useEffect( () => {
		const controller = new AbortController();

		settingsService
			.get( controller.signal )
			.then( ( payload ) => {
				setChoices( payload.choices );
				setLogoUrl( payload.logo?.url ?? '' );
				reset( { ...blank, ...payload.settings } );
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

		const payload = { ...values };

		NUMERIC.forEach( ( key ) => {
			payload[ key ] = Number( values[ key ] ) || 0;
		} );

		try {
			const saved = await settingsService.update( payload );

			setLogoUrl( saved.logo?.url ?? '' );
			reset( { ...blank, ...saved.settings } );
			setSaved( true );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	/**
	 * Clears the "saved" note as soon as anything moves.
	 *
	 * @param {Function} onChange The field's own change handler.
	 * @return {Function} A handler that clears the note and then calls it.
	 */
	const touched = ( onChange ) => ( value ) => {
		setSaved( false );
		onChange( value );
	};

	const isSaving = form.formState.isSubmitting;

	if ( isLoading ) {
		return (
			<Card className="max-w-3xl">
				<CardContent className="flex flex-col gap-4 p-5">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="flex max-w-3xl flex-col gap-4">
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

			<Form { ...form }>
				<form
					onSubmit={ form.handleSubmit( save ) }
					className="flex flex-col gap-4"
				>
					<Tabs
						defaultValue="general"
						className="flex flex-col gap-4"
					>
						{ /* Wraps rather than squeezing six tabs onto a phone. */ }
						<TabsList className="flex h-auto flex-wrap justify-start gap-1">
							<TabsTrigger value="general">
								{ __( 'General', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="booking">
								{ __( 'Booking', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="payment">
								{ __( 'Payment', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="notifications">
								{ __( 'Notifications', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="company">
								{ __( 'Company', 'booking-suite' ) }
							</TabsTrigger>
							<TabsTrigger value="invoice">
								{ __( 'Legal & invoice', 'booking-suite' ) }
							</TabsTrigger>
						</TabsList>

						{ /* ── General ─────────────────────────────────── */ }
						<TabsContent value="general" className="mt-0">
							<Panel
								title={ __( 'General', 'booking-suite' ) }
								description={ __(
									'How prices and the guest-facing booking flow are presented.',
									'booking-suite'
								) }
							>
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
												onValueChange={ touched(
													field.onChange
												) }
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
													onChange={ touched(
														field.onChange
													) }
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
							</Panel>
						</TabsContent>

						{ /* ── Booking ─────────────────────────────────── */ }
						<TabsContent value="booking" className="mt-0">
							<Panel
								title={ __( 'Booking', 'booking-suite' ) }
								description={ __(
									'Rules applied when a booking is taken.',
									'booking-suite'
								) }
							>
								<Field
									form={ form }
									name="cooldownMinutes"
									type="number"
									min="0"
									max="1440"
									touched={ touched }
									label={ __(
										'Cooldown (minutes)',
										'booking-suite'
									) }
									description={ __(
										'Turnaround time kept free after each booking. A slot that would start within this gap is treated as taken.',
										'booking-suite'
									) }
								/>
							</Panel>
						</TabsContent>

						{ /* ── Payment ─────────────────────────────────── */ }
						<TabsContent value="payment" className="mt-0">
							<Panel
								title={ __( 'Payment', 'booking-suite' ) }
								description={ __(
									'How guests pay you.',
									'booking-suite'
								) }
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										form={ form }
										name="bankHolder"
										touched={ touched }
										label={ __(
											'Account holder',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="bankName"
										touched={ touched }
										label={ __( 'Bank', 'booking-suite' ) }
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-3">
									<Field
										form={ form }
										name="bankIban"
										touched={ touched }
										className="col-span-2 font-mono uppercase"
										label={ __( 'IBAN', 'booking-suite' ) }
										description={ __(
											'Printed on the invoice in groups of four, so a guest can read it across without losing their place.',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="bankBic"
										touched={ touched }
										className="font-mono uppercase"
										label={ __( 'BIC', 'booking-suite' ) }
									/>
								</div>

								<Field
									form={ form }
									name="bankDetails"
									as="textarea"
									rows={ 2 }
									touched={ touched }
									label={ __(
										'Additional details',
										'booking-suite'
									) }
									description={ __(
										'Anything else to print under the account.',
										'booking-suite'
									) }
								/>
							</Panel>
						</TabsContent>

						{ /* ── Notifications ───────────────────────────── */ }
						<TabsContent value="notifications" className="mt-0">
							<Panel
								title={ __( 'Notifications', 'booking-suite' ) }
								description={ __(
									'Email sent by the plugin.',
									'booking-suite'
								) }
							>
								<FormField
									control={ form.control }
									name="emailNotifications"
									render={ ( { field } ) => (
										<FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border p-4">
											<FormControl>
												<Switch
													checked={ Boolean(
														field.value
													) }
													onCheckedChange={ touched(
														field.onChange
													) }
												/>
											</FormControl>
											<div className="flex flex-col gap-1">
												<FormLabel>
													{ __(
														'Email notifications',
														'booking-suite'
													) }
												</FormLabel>
												<FormDescription>
													{ __(
														'The master switch. Off stops every guest email, whatever the individual templates say.',
														'booking-suite'
													) }
												</FormDescription>
											</div>
											<FormMessage />
										</FormItem>
									) }
								/>
							</Panel>
						</TabsContent>

						{ /* ── Company ─────────────────────────────────── */ }
						<TabsContent value="company" className="mt-0">
							<Panel
								title={ __(
									'Company information',
									'booking-suite'
								) }
								description={ __(
									'Entered once here, and used on the invoice and in the header of every guest email.',
									'booking-suite'
								) }
							>
								<FormField
									control={ form.control }
									name="companyLogo"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Company logo',
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
													'Printed at the top of the invoice and shown in the header of every guest email.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>

								<Field
									form={ form }
									name="companyName"
									touched={ touched }
									label={ __(
										'Company name',
										'booking-suite'
									) }
								/>

								<Field
									form={ form }
									name="companyAddress"
									as="textarea"
									rows={ 3 }
									touched={ touched }
									label={ __( 'Address', 'booking-suite' ) }
									description={ __(
										'One line per line, as it should appear on the invoice.',
										'booking-suite'
									) }
								/>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										form={ form }
										name="companyPhone"
										touched={ touched }
										label={ __(
											'Telephone',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="companyEmail"
										type="email"
										touched={ touched }
										label={ __( 'Email', 'booking-suite' ) }
									/>
								</div>

								<Field
									form={ form }
									name="adminEmail"
									type="email"
									touched={ touched }
									label={ __(
										'Admin email',
										'booking-suite'
									) }
									description={ __(
										'Where notifications for you are sent. Leave empty to use the WordPress admin address.',
										'booking-suite'
									) }
								/>
							</Panel>
						</TabsContent>

						{ /* ── Legal & invoice ─────────────────────────── */ }
						<TabsContent value="invoice" className="mt-0">
							<Panel
								title={ __(
									'Legal & invoice',
									'booking-suite'
								) }
								description={ __(
									'The invoice the guest receives, and the pages it and the booking flow link to.',
									'booking-suite'
								) }
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										form={ form }
										name="termsUrl"
										type="url"
										touched={ touched }
										label={ __(
											'Terms & conditions page',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="privacyUrl"
										type="url"
										touched={ touched }
										label={ __(
											'Privacy policy page',
											'booking-suite'
										) }
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										form={ form }
										name="invoicePrefix"
										touched={ touched }
										label={ __(
											'Invoice number prefix',
											'booking-suite'
										) }
										description={ __(
											'Numbers run PREFIX-YEAR-0001 and restart each year.',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="invoiceCounter"
										type="number"
										min="0"
										touched={ touched }
										label={ __(
											'Invoice counter',
											'booking-suite'
										) }
										description={ __(
											'The next number to issue. Only ever raises the sequence — it cannot reuse a number already sent.',
											'booking-suite'
										) }
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<Field
										form={ form }
										name="taxRate"
										type="number"
										min="0"
										max="100"
										step="0.1"
										touched={ touched }
										label={ __(
											'Tax rate (%)',
											'booking-suite'
										) }
										description={ __(
											'Worked back out of the price, which is what the guest pays. 0 shows no tax line.',
											'booking-suite'
										) }
									/>
									<Field
										form={ form }
										name="invoiceDueDays"
										type="number"
										min="0"
										max="365"
										touched={ touched }
										label={ __(
											'Payment term (days)',
											'booking-suite'
										) }
										description={ __(
											'Days from the invoice date to the due date.',
											'booking-suite'
										) }
									/>
								</div>

								<Field
									form={ form }
									name="invoiceThanks"
									as="textarea"
									rows={ 2 }
									touched={ touched }
									label={ __(
										'Closing line',
										'booking-suite'
									) }
								/>

								<Field
									form={ form }
									name="invoiceNotice"
									as="textarea"
									rows={ 2 }
									touched={ touched }
									label={ __( 'Notice', 'booking-suite' ) }
									description={ __(
										'Printed last, after a bold "Hinweis:" label.',
										'booking-suite'
									) }
								/>
							</Panel>
						</TabsContent>
					</Tabs>

					{ /* Outside the tabs: one save for the lot. */ }
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

function Panel( { title, description, children } ) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{ title }</CardTitle>
				<CardDescription>{ description }</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{ children }
			</CardContent>
		</Card>
	);
}

/**
 * One labelled control, as an input or a textarea.
 *
 * @param {Object}   props
 * @param {Object}   props.form          The react-hook-form instance.
 * @param {string}   props.name          Field name.
 * @param {string}   props.label         Its label.
 * @param {string}   [props.as]          'textarea' for a multi-line field.
 * @param {Function} props.touched       Wraps onChange to clear the saved note.
 * @param {string}   [props.description]
 */
function Field( {
	form,
	name,
	label: fieldLabel,
	description,
	as,
	touched,
	...rest
} ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ fieldLabel }</FormLabel>
					<FormControl>
						{ 'textarea' === as ? (
							<Textarea
								{ ...rest }
								{ ...field }
								onChange={ ( event ) =>
									touched( field.onChange )( event )
								}
							/>
						) : (
							<Input
								{ ...rest }
								{ ...field }
								onChange={ ( event ) =>
									touched( field.onChange )( event )
								}
							/>
						) }
					</FormControl>
					{ description && (
						<FormDescription>{ description }</FormDescription>
					) }
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}
