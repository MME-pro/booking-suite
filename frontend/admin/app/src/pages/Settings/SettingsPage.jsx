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

import { settingsService } from '../../services';

/** Display names for the codes the API accepts. */
const CURRENCY_LABELS = {
	EUR: __( 'Euro (€)', 'booking-suite' ),
	USD: __( 'US Dollar ($)', 'booking-suite' ),
	GBP: __( 'Pound Sterling (£)', 'booking-suite' ),
	CHF: __( 'Swiss Franc (CHF)', 'booking-suite' ),
};

export default function SettingsPage() {
	const [ choices, setChoices ] = useState( { currencies: [] } );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ isSaved, setSaved ] = useState( false );

	const form = useForm( { defaultValues: { currency: 'EUR' } } );

	const { reset } = form;

	useEffect( () => {
		const controller = new AbortController();

		settingsService
			.get( controller.signal )
			.then( ( payload ) => {
				setChoices( payload.choices );
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
			const payload = await settingsService.update( values );

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
					<Form { ...form }>
						<form
							onSubmit={ form.handleSubmit( save ) }
							className="flex flex-col gap-6"
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

							<div className="flex justify-end">
								<Button type="submit" disabled={ isSaving }>
									{ isSaving
										? __( 'Saving…', 'booking-suite' )
										: __(
												'Save settings',
												'booking-suite'
										  ) }
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
