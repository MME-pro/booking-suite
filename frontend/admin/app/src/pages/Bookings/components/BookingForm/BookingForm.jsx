/**
 * BookingForm — take or amend a booking from the admin.
 *
 * The same shape as the guest flow, in one screen rather than five steps, and
 * with the things only an operator may set: the status, and an agreed total
 * that overrides the calculated one.
 *
 * Built on the shadcn/ui Form (react-hook-form + zod). The schema below is the
 * single source of truth for what a valid booking looks like on this screen —
 * the checks the old hand-rolled version left to the server (check-out after
 * check-in, at least one guest, a well-formed email) now fail fast in the UI.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

import { apartmentService, bookingService } from '../../../../services';
import './BookingForm.css';

const STATUSES = [ 'pending', 'reserved', 'confirmed', 'completed' ];
const PAYMENT_STATUSES = [ 'unpaid', 'partial', 'paid', 'refunded' ];

const today = () => new Date().toISOString().slice( 0, 10 );

const addDays = ( date, days ) => {
	const result = new Date( `${ date }T00:00:00` );

	result.setDate( result.getDate() + days );

	return result.toISOString().slice( 0, 10 );
};

const schema = z
	.object( {
		apartmentId: z
			.string()
			.min( 1, __( 'Choose an apartment.', 'booking-suite' ) ),
		mode: z.enum( [ 'overnight', 'hourly' ] ),
		guests: z.coerce
			.number()
			.int()
			.min( 1, __( 'At least one guest.', 'booking-suite' ) ),
		checkIn: z.string(),
		checkOut: z.string(),
		date: z.string(),
		startTime: z.string(),
		hours: z.coerce
			.number()
			.int()
			.min( 1, __( 'At least one hour.', 'booking-suite' ) ),
		status: z.enum( STATUSES ),
		paymentStatus: z.enum( PAYMENT_STATUSES ),
		total: z.string().optional(),
		notes: z.string().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		email: z
			.string()
			.email( __( 'Enter a valid email address.', 'booking-suite' ) )
			.or( z.literal( '' ) )
			.optional(),
		phone: z.string().optional(),
	} )
	.superRefine( ( values, ctx ) => {
		// Only the fields belonging to the chosen mode are worth checking.
		if ( 'overnight' === values.mode ) {
			if ( ! values.checkIn ) {
				ctx.addIssue( {
					code: z.ZodIssueCode.custom,
					path: [ 'checkIn' ],
					message: __( 'Pick a check-in date.', 'booking-suite' ),
				} );
			}

			if ( values.checkOut <= values.checkIn ) {
				ctx.addIssue( {
					code: z.ZodIssueCode.custom,
					path: [ 'checkOut' ],
					message: __(
						'Check-out must be after check-in.',
						'booking-suite'
					),
				} );
			}

			return;
		}

		if ( ! values.date ) {
			ctx.addIssue( {
				code: z.ZodIssueCode.custom,
				path: [ 'date' ],
				message: __( 'Pick a date.', 'booking-suite' ),
			} );
		}

		if ( ! values.startTime ) {
			ctx.addIssue( {
				code: z.ZodIssueCode.custom,
				path: [ 'startTime' ],
				message: __( 'Pick a start time.', 'booking-suite' ),
			} );
		}
	} );

/**
 * A stored booking back into form fields.
 *
 * @param {Object} booking The booking as returned by bookingService.
 * @return {Object} Form values.
 */
const fromBooking = ( booking ) => {
	const startsAt = booking.startsAt ?? '';
	const endsAt = booking.endsAt ?? '';

	const startDate = startsAt.slice( 0, 10 );
	const startTime = startsAt.slice( 11, 16 );
	const endDate = endsAt.slice( 0, 10 );

	// A stay that spans days is an overnight one.
	const isOvernight = startDate !== endDate;

	const hours = Math.max(
		1,
		Math.round(
			( new Date( endsAt.replace( ' ', 'T' ) ) -
				new Date( startsAt.replace( ' ', 'T' ) ) ) /
				3600000
		)
	);

	return {
		apartmentId: String( booking.apartmentId ?? '' ),
		mode: isOvernight ? 'overnight' : 'hourly',
		date: startDate || today(),
		startTime: startTime || '10:00',
		hours: isOvernight ? 3 : hours,
		checkIn: startDate || today(),
		checkOut: endDate || addDays( today(), 1 ),
		guests: booking.guests ?? 1,
		status: booking.status ?? 'confirmed',
		paymentStatus: booking.paymentStatus ?? 'unpaid',
		total: booking.total ? String( booking.total ) : '',
		notes: booking.notes ?? '',
		firstName: ( booking.customerName ?? '' ).split( ' ' )[ 0 ] ?? '',
		lastName: ( booking.customerName ?? '' )
			.split( ' ' )
			.slice( 1 )
			.join( ' ' ),
		email: booking.customerEmail ?? '',
		phone: booking.customerPhone ?? '',
	};
};

const blank = () => ( {
	apartmentId: '',
	mode: 'overnight',
	date: today(),
	startTime: '10:00',
	hours: 3,
	checkIn: today(),
	checkOut: addDays( today(), 1 ),
	guests: 1,
	status: 'confirmed',
	paymentStatus: 'unpaid',
	total: '',
	notes: '',
	firstName: '',
	lastName: '',
	email: '',
	phone: '',
} );

const label = ( value ) => String( value ).replace( /_/g, ' ' );

export default function BookingForm( { booking = null, onClose, onSaved } ) {
	const isEdit = null !== booking;

	const [ apartments, setApartments ] = useState( [] );
	const [ error, setError ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: isEdit ? fromBooking( booking ) : blank(),
	} );

	useEffect( () => {
		const controller = new AbortController();

		apartmentService
			.list( {}, controller.signal )
			.then( setApartments )
			.catch( () => setApartments( [] ) );

		return () => controller.abort();
	}, [] );

	const isOvernight = 'overnight' === form.watch( 'mode' );
	const isSaving = form.formState.isSubmitting;

	const save = async ( values ) => {
		setError( null );

		const payload = {
			apartmentId: Number.parseInt( values.apartmentId, 10 ),
			mode: values.mode,
			guests: values.guests,
			status: values.status,
			payment_status: values.paymentStatus,
			total: values.total,
			notes: values.notes,
			firstName: values.firstName,
			lastName: values.lastName,
			email: values.email,
			phone: values.phone,
			...( 'overnight' === values.mode
				? { checkIn: values.checkIn, checkOut: values.checkOut }
				: {
						date: values.date,
						startTime: values.startTime,
						hours: values.hours,
				  } ),
		};

		try {
			const saved = isEdit
				? await bookingService.update( booking.id, payload )
				: await bookingService.create( payload );

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
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{ isEdit
							? __( 'Edit booking', 'booking-suite' )
							: __( 'Add booking', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Taken by phone, email or at the door.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<Form { ...form }>
					<form
						id="bks-booking-form"
						onSubmit={ form.handleSubmit( save ) }
						className="flex flex-col gap-6"
					>
						{ error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{ error }</AlertDescription>
							</Alert>
						) }

						<Section title={ __( 'Stay', 'booking-suite' ) }>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<FormField
									control={ form.control }
									name="apartmentId"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Apartment',
													'booking-suite'
												) }
											</FormLabel>
											<Select
												value={ field.value }
												onValueChange={ field.onChange }
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue
															placeholder={ __(
																'Choose…',
																'booking-suite'
															) }
														/>
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ apartments.map(
														( apartment ) => (
															<SelectItem
																key={
																	apartment.id
																}
																value={ String(
																	apartment.id
																) }
															>
																{
																	apartment.name
																}
															</SelectItem>
														)
													) }
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="mode"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Type',
													'booking-suite'
												) }
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
													<SelectItem value="overnight">
														{ __(
															'Overnight',
															'booking-suite'
														) }
													</SelectItem>
													<SelectItem value="hourly">
														{ __(
															'By the hour',
															'booking-suite'
														) }
													</SelectItem>
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="guests"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Guests',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<Input
													type="number"
													min="1"
													{ ...field }
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>

							{ isOvernight ? (
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<FormField
										control={ form.control }
										name="checkIn"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Check-in',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="date"
														{ ...field }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>

									<FormField
										control={ form.control }
										name="checkOut"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Check-out',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="date"
														{ ...field }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>
								</div>
							) : (
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
									<FormField
										control={ form.control }
										name="date"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Date',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="date"
														{ ...field }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>

									<FormField
										control={ form.control }
										name="startTime"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Start time',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="time"
														{ ...field }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>

									<FormField
										control={ form.control }
										name="hours"
										render={ ( { field } ) => (
											<FormItem>
												<FormLabel>
													{ __(
														'Hours',
														'booking-suite'
													) }
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														min="1"
														{ ...field }
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										) }
									/>
								</div>
							) }
						</Section>

						<Separator />

						<Section title={ __( 'Guest', 'booking-suite' ) }>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<TextField
									form={ form }
									name="firstName"
									label={ __(
										'First name',
										'booking-suite'
									) }
								/>
								<TextField
									form={ form }
									name="lastName"
									label={ __( 'Last name', 'booking-suite' ) }
								/>
								<TextField
									form={ form }
									name="email"
									type="email"
									label={ __( 'Email', 'booking-suite' ) }
								/>
								<TextField
									form={ form }
									name="phone"
									type="tel"
									label={ __( 'Phone', 'booking-suite' ) }
								/>
							</div>
						</Section>

						<Separator />

						<Section
							title={ __( 'Status & price', 'booking-suite' ) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<StatusField
									form={ form }
									name="status"
									label={ __(
										'Booking status',
										'booking-suite'
									) }
									values={ STATUSES }
								/>
								<StatusField
									form={ form }
									name="paymentStatus"
									label={ __(
										'Payment status',
										'booking-suite'
									) }
									values={ PAYMENT_STATUSES }
								/>

								<FormField
									control={ form.control }
									name="total"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Total override',
													'booking-suite'
												) }
											</FormLabel>
											<FormControl>
												<Input
													type="number"
													min="0"
													step="0.01"
													placeholder={ __(
														'Calculated',
														'booking-suite'
													) }
													{ ...field }
												/>
											</FormControl>
											<FormDescription>
												{ __(
													'Leave empty to use the calculated rate.',
													'booking-suite'
												) }
											</FormDescription>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>
						</Section>

						<Separator />

						<Section title={ __( 'Notes', 'booking-suite' ) }>
							<FormField
								control={ form.control }
								name="notes"
								render={ ( { field } ) => (
									<FormItem>
										<FormControl>
											<Textarea rows={ 4 } { ...field } />
										</FormControl>
										<FormMessage />
									</FormItem>
								) }
							/>
						</Section>
					</form>
				</Form>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={ onClose }
						disabled={ isSaving }
					>
						{ __( 'Cancel', 'booking-suite' ) }
					</Button>
					<Button
						type="submit"
						form="bks-booking-form"
						disabled={ isSaving }
					>
						{ isSaving
							? __( 'Saving…', 'booking-suite' )
							: __( 'Save booking', 'booking-suite' ) }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Section( { title, children } ) {
	return (
		<section className="flex flex-col gap-4">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{ title }
			</h3>
			{ children }
		</section>
	);
}

function TextField( { form, name, label: fieldLabel, type = 'text' } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ fieldLabel }</FormLabel>
					<FormControl>
						<Input type={ type } { ...field } />
					</FormControl>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}

function StatusField( { form, name, label: fieldLabel, values } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ fieldLabel }</FormLabel>
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
							{ values.map( ( value ) => (
								<SelectItem
									key={ value }
									value={ value }
									className="capitalize"
								>
									{ label( value ) }
								</SelectItem>
							) ) }
						</SelectContent>
					</Select>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}
