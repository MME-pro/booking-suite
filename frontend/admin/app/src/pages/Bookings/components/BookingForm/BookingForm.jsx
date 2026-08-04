/**
 * BookingForm — take or amend a booking from the admin.
 *
 * The same shape as the guest flow, in one screen rather than five steps, and
 * with the things only an operator may set: the status, and an agreed total
 * that overrides the calculated one.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';

import {
	ApartmentIcon,
	Button,
	Field,
	FormSection,
	Modal,
	Notice,
	Select,
	TextInput,
	UsersIcon,
	LinkIcon,
	TextIcon,
} from '../../../../components';
import { apartmentService, bookingService } from '../../../../services';
import './BookingForm.css';

const STATUSES = [ 'pending', 'reserved', 'confirmed', 'completed' ];
const PAYMENT_STATUSES = [ 'unpaid', 'partial', 'paid', 'refunded' ];

const options = ( values ) =>
	values.map( ( value ) => ( {
		value,
		label: value.replace( /_/g, ' ' ),
	} ) );

const today = () => new Date().toISOString().slice( 0, 10 );

const addDays = ( date, days ) => {
	const result = new Date( `${ date }T00:00:00` );

	result.setDate( result.getDate() + days );

	return result.toISOString().slice( 0, 10 );
};

// A stored booking back into form fields.
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
		guests: String( booking.guests ?? 1 ),
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
	guests: '1',
	status: 'confirmed',
	paymentStatus: 'unpaid',
	total: '',
	notes: '',
	firstName: '',
	lastName: '',
	email: '',
	phone: '',
} );

export default function BookingForm( { booking = null, onClose, onSaved } ) {
	const isEdit = null !== booking;

	const [ values, setValues ] = useState( () =>
		isEdit ? fromBooking( booking ) : blank()
	);
	const [ apartments, setApartments ] = useState( [] );
	const [ isSaving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		const controller = new AbortController();

		apartmentService
			.list( {}, controller.signal )
			.then( setApartments )
			.catch( () => setApartments( [] ) );

		return () => controller.abort();
	}, [] );

	const set = ( key ) => ( value ) =>
		setValues( ( current ) => ( { ...current, [ key ]: value } ) );

	const setInput = ( key ) => ( event ) => set( key )( event.target.value );

	const isOvernight = 'overnight' === values.mode;

	const save = async () => {
		setSaving( true );
		setError( null );

		const payload = {
			apartmentId: Number.parseInt( values.apartmentId, 10 ),
			mode: values.mode,
			guests: Number.parseInt( values.guests, 10 ) || 1,
			status: values.status,
			payment_status: values.paymentStatus,
			total: values.total,
			notes: values.notes,
			firstName: values.firstName,
			lastName: values.lastName,
			email: values.email,
			phone: values.phone,
			...( isOvernight
				? { checkIn: values.checkIn, checkOut: values.checkOut }
				: {
						date: values.date,
						startTime: values.startTime,
						hours: Number.parseInt( values.hours, 10 ) || 1,
				  } ),
		};

		try {
			const saved = isEdit
				? await bookingService.update( booking.id, payload )
				: await bookingService.create( payload );

			onSaved( saved );
		} catch ( cause ) {
			setError( cause.message );
			setSaving( false );
		}
	};

	return (
		<Modal
			icon={ <ApartmentIcon /> }
			title={
				isEdit
					? __( 'Edit booking', 'booking-suite' )
					: __( 'Add booking', 'booking-suite' )
			}
			description={ __(
				'Taken by phone, email or at the door.',
				'booking-suite'
			) }
			onClose={ onClose }
			footer={
				<>
					<Button onClick={ onClose } disabled={ isSaving }>
						{ __( 'Cancel', 'booking-suite' ) }
					</Button>
					<Button
						variant="primary"
						disabled={ isSaving || ! values.apartmentId }
						onClick={ save }
					>
						{ isSaving
							? __( 'Saving…', 'booking-suite' )
							: __( 'Save booking', 'booking-suite' ) }
					</Button>
				</>
			}
		>
			<form
				className="bks-booking-form"
				onSubmit={ ( event ) => event.preventDefault() }
			>
				{ error && <Notice tone="error">{ error }</Notice> }

				<FormSection
					icon={ <ApartmentIcon /> }
					title={ __( 'Stay', 'booking-suite' ) }
				>
					<div className="bks-booking-form__row">
						<Field
							label={ __( 'Apartment', 'booking-suite' ) }
							htmlFor="bks-booking-apartment"
							required
						>
							<Select
								id="bks-booking-apartment"
								placeholder={ __( 'Choose…', 'booking-suite' ) }
								options={ apartments.map( ( apartment ) => ( {
									value: String( apartment.id ),
									label: apartment.name,
								} ) ) }
								value={ values.apartmentId }
								onChange={ setInput( 'apartmentId' ) }
							/>
						</Field>

						<Field
							label={ __( 'Type', 'booking-suite' ) }
							htmlFor="bks-booking-mode"
						>
							<Select
								id="bks-booking-mode"
								options={ [
									{
										value: 'overnight',
										label: __(
											'Overnight',
											'booking-suite'
										),
									},
									{
										value: 'hourly',
										label: __(
											'By the hour',
											'booking-suite'
										),
									},
								] }
								value={ values.mode }
								onChange={ setInput( 'mode' ) }
							/>
						</Field>

						<Field
							label={ __( 'Guests', 'booking-suite' ) }
							htmlFor="bks-booking-guests"
						>
							<TextInput
								id="bks-booking-guests"
								type="number"
								min="1"
								value={ values.guests }
								onChange={ setInput( 'guests' ) }
							/>
						</Field>
					</div>

					{ isOvernight ? (
						<div className="bks-booking-form__row">
							<Field
								label={ __( 'Check-in', 'booking-suite' ) }
								htmlFor="bks-booking-checkin"
							>
								<TextInput
									id="bks-booking-checkin"
									type="date"
									value={ values.checkIn }
									onChange={ setInput( 'checkIn' ) }
								/>
							</Field>

							<Field
								label={ __( 'Check-out', 'booking-suite' ) }
								htmlFor="bks-booking-checkout"
							>
								<TextInput
									id="bks-booking-checkout"
									type="date"
									value={ values.checkOut }
									onChange={ setInput( 'checkOut' ) }
								/>
							</Field>
						</div>
					) : (
						<div className="bks-booking-form__row">
							<Field
								label={ __( 'Date', 'booking-suite' ) }
								htmlFor="bks-booking-date"
							>
								<TextInput
									id="bks-booking-date"
									type="date"
									value={ values.date }
									onChange={ setInput( 'date' ) }
								/>
							</Field>

							<Field
								label={ __( 'Start time', 'booking-suite' ) }
								htmlFor="bks-booking-start"
							>
								<TextInput
									id="bks-booking-start"
									type="time"
									value={ values.startTime }
									onChange={ setInput( 'startTime' ) }
								/>
							</Field>

							<Field
								label={ __( 'Hours', 'booking-suite' ) }
								htmlFor="bks-booking-hours"
							>
								<TextInput
									id="bks-booking-hours"
									type="number"
									min="1"
									value={ values.hours }
									onChange={ setInput( 'hours' ) }
								/>
							</Field>
						</div>
					) }
				</FormSection>

				<FormSection
					icon={ <UsersIcon /> }
					title={ __( 'Guest', 'booking-suite' ) }
				>
					<div className="bks-booking-form__row">
						<Field
							label={ __( 'First name', 'booking-suite' ) }
							htmlFor="bks-booking-first"
						>
							<TextInput
								id="bks-booking-first"
								value={ values.firstName }
								onChange={ setInput( 'firstName' ) }
							/>
						</Field>

						<Field
							label={ __( 'Last name', 'booking-suite' ) }
							htmlFor="bks-booking-last"
						>
							<TextInput
								id="bks-booking-last"
								value={ values.lastName }
								onChange={ setInput( 'lastName' ) }
							/>
						</Field>
					</div>

					<div className="bks-booking-form__row">
						<Field
							label={ __( 'Email', 'booking-suite' ) }
							htmlFor="bks-booking-email"
						>
							<TextInput
								id="bks-booking-email"
								type="email"
								value={ values.email }
								onChange={ setInput( 'email' ) }
							/>
						</Field>

						<Field
							label={ __( 'Phone', 'booking-suite' ) }
							htmlFor="bks-booking-phone"
						>
							<TextInput
								id="bks-booking-phone"
								type="tel"
								value={ values.phone }
								onChange={ setInput( 'phone' ) }
							/>
						</Field>
					</div>
				</FormSection>

				<FormSection
					icon={ <LinkIcon /> }
					title={ __( 'Status & price', 'booking-suite' ) }
				>
					<div className="bks-booking-form__row">
						<Field
							label={ __( 'Booking status', 'booking-suite' ) }
							htmlFor="bks-booking-status"
						>
							<Select
								id="bks-booking-status"
								options={ options( STATUSES ) }
								value={ values.status }
								onChange={ setInput( 'status' ) }
							/>
						</Field>

						<Field
							label={ __( 'Payment status', 'booking-suite' ) }
							htmlFor="bks-booking-payment"
						>
							<Select
								id="bks-booking-payment"
								options={ options( PAYMENT_STATUSES ) }
								value={ values.paymentStatus }
								onChange={ setInput( 'paymentStatus' ) }
							/>
						</Field>

						<Field
							label={ __( 'Total override', 'booking-suite' ) }
							htmlFor="bks-booking-total"
						>
							<TextInput
								id="bks-booking-total"
								type="number"
								min="0"
								step="0.01"
								placeholder={ __(
									'Calculated',
									'booking-suite'
								) }
								value={ values.total }
								onChange={ setInput( 'total' ) }
							/>
						</Field>
					</div>
				</FormSection>

				<FormSection
					icon={ <TextIcon /> }
					title={ __( 'Notes', 'booking-suite' ) }
				>
					<Field htmlFor="bks-booking-notes">
						<TextInput
							id="bks-booking-notes"
							multiline
							rows={ 4 }
							value={ values.notes }
							onChange={ setInput( 'notes' ) }
						/>
					</Field>
				</FormSection>
			</form>
		</Modal>
	);
}
