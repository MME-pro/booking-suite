/**
 * ApartmentForm — every writable column of `mmebk_rooms`, in a modal.
 *
 * Front-end only: state is local and Save just hands the values back. No
 * validation beyond the input constraints the columns imply.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import {
	ApartmentIcon,
	Button,
	CheckboxRow,
	ColorField,
	Field,
	FormSection,
	HelpIcon,
	ImageUpload,
	LinkIcon,
	Modal,
	Notice,
	SegmentedControl,
	Select,
	TextIcon,
	TextInput,
	Toggle,
	UsersIcon,
} from '../../../../components';
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

export default function ApartmentForm( {
	apartment = null,
	onClose,
	onSaved,
} ) {
	const isEdit = null !== apartment;

	const [ values, setValues ] = useState( () =>
		isEdit ? { ...emptyApartment(), ...apartment } : emptyApartment()
	);
	const [ descriptionMode, setDescriptionMode ] = useState( 'text' );
	const [ isSaving, setSaving ] = useState( false );
	const [ error, setError ] = useState( null );

	const setValue = ( key ) => ( value ) =>
		setValues( ( current ) => ( { ...current, [ key ]: value } ) );

	const setInput = ( key ) => ( event ) =>
		setValue( key )( event.target.value );

	const handleSave = async () => {
		setSaving( true );
		setError( null );

		try {
			const saved = isEdit
				? await apartmentService.update( apartment.id, values )
				: await apartmentService.create( values );

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
					? __( 'Edit Apartment', 'booking-suite' )
					: __( 'Add Apartment', 'booking-suite' )
			}
			description={ __(
				'Set up the apartment guests will see and book.',
				'booking-suite'
			) }
			onClose={ onClose }
			footer={
				<>
					<span className="bks-apartment-form__footnote">
						{ __(
							'Fields marked * are required.',
							'booking-suite'
						) }
					</span>
					<Button onClick={ onClose } disabled={ isSaving }>
						{ __( 'Close', 'booking-suite' ) }
					</Button>
					<Button
						variant="primary"
						disabled={ isSaving }
						onClick={ handleSave }
					>
						{ isSaving
							? __( 'Saving…', 'booking-suite' )
							: __( 'Save Apartment', 'booking-suite' ) }
					</Button>
				</>
			}
		>
			<form
				className="bks-apartment-form"
				onSubmit={ ( event ) => event.preventDefault() }
			>
				{ error && <Notice tone="error">{ error }</Notice> }

				{ /* name, images, colour, active */ }
				<FormSection
					icon={ <ApartmentIcon /> }
					title={ __( 'Details', 'booking-suite' ) }
					description={ __(
						'How this apartment is identified across the calendar and the website.',
						'booking-suite'
					) }
				>
					<div className="bks-apartment-form__identity">
						<ImageUpload
							images={ values.images }
							onChange={ setValue( 'images' ) }
						/>

						<div className="bks-apartment-form__identity-fields">
							<div className="bks-apartment-form__row bks-apartment-form__row--name">
								<Field
									label={ __( 'Name', 'booking-suite' ) }
									htmlFor="bks-apartment-name"
									required
								>
									<TextInput
										id="bks-apartment-name"
										value={ values.name }
										maxLength={ MAX_LENGTH_191 }
										placeholder={ __(
											'e.g. Studio Rheinblick',
											'booking-suite'
										) }
										onChange={ setInput( 'name' ) }
									/>
								</Field>

								<Field
									label={ __( 'Color', 'booking-suite' ) }
									htmlFor="bks-apartment-colour"
									required
									className="bks-apartment-form__colour"
								>
									<ColorField
										id="bks-apartment-colour"
										value={ values.colour }
										onChange={ setValue( 'colour' ) }
									/>
								</Field>
							</div>

							<div className="bks-apartment-form__toggle-row">
								<Toggle
									id="bks-apartment-active"
									checked={ values.active }
									onChange={ setValue( 'active' ) }
									label={ __( 'Active', 'booking-suite' ) }
									help={ __(
										'Inactive apartments stay in the list but cannot be booked.',
										'booking-suite'
									) }
								/>
							</div>
						</div>
					</div>
				</FormSection>

				{ /* capacity, cleaning_min, holiday_hesse */ }
				<FormSection
					icon={ <UsersIcon /> }
					title={ __( 'Capacity & turnaround', 'booking-suite' ) }
					description={ __(
						'How many guests fit, and how long the apartment is blocked between stays.',
						'booking-suite'
					) }
				>
					<div className="bks-apartment-form__row">
						<Field
							label={ __( 'Guests', 'booking-suite' ) }
							htmlFor="bks-apartment-capacity"
							required
						>
							<TextInput
								id="bks-apartment-capacity"
								type="number"
								inputMode="numeric"
								min={ MIN_CAPACITY }
								max={ MAX_CAPACITY }
								value={ values.capacity }
								onChange={ setInput( 'capacity' ) }
							/>
						</Field>

						<Field
							label={ __( 'Cleaning time', 'booking-suite' ) }
							htmlFor="bks-apartment-cleaning"
							required
							adornment={
								<span
									className="bks-apartment-form__help"
									title={ __(
										'Turnaround blocked after each stay.',
										'booking-suite'
									) }
								>
									<HelpIcon />
								</span>
							}
						>
							<Select
								id="bks-apartment-cleaning"
								options={ cleaningOptions() }
								value={ values.cleaningMin }
								onChange={ setInput( 'cleaningMin' ) }
							/>
						</Field>
					</div>

					<CheckboxRow
						id="bks-apartment-holiday-hesse"
						checked={ values.holidayHesse }
						onChange={ setValue( 'holidayHesse' ) }
						label={ __(
							'Follow Hesse public holidays',
							'booking-suite'
						) }
						help={ __(
							'Hesse public holidays are treated as blocked days for this apartment.',
							'booking-suite'
						) }
					/>
				</FormSection>

				{ /* weekday_rate, weekend_rate */ }
				<FormSection
					icon={ <TextIcon /> }
					title={ __( 'Rates', 'booking-suite' ) }
				>
					<div className="bks-apartment-form__row">
						<Field
							label={ __(
								'Weekday rate (Sun–Thu)',
								'booking-suite'
							) }
							htmlFor="bks-apartment-weekday-rate"
						>
							<TextInput
								id="bks-apartment-weekday-rate"
								type="number"
								min="0"
								step="0.01"
								inputMode="decimal"
								value={ values.weekdayRate }
								onChange={ setInput( 'weekdayRate' ) }
							/>
						</Field>

						<Field
							label={ __(
								'Weekend rate (Fri/Sat)',
								'booking-suite'
							) }
							htmlFor="bks-apartment-weekend-rate"
						>
							<TextInput
								id="bks-apartment-weekend-rate"
								type="number"
								min="0"
								step="0.01"
								inputMode="decimal"
								value={ values.weekendRate }
								onChange={ setInput( 'weekendRate' ) }
							/>
						</Field>
					</div>
				</FormSection>

				{ /* internal_short_link, booking_short_link */ }
				<FormSection
					icon={ <LinkIcon /> }
					title={ __( 'Short links', 'booking-suite' ) }
					description={ __(
						'Optional shortcuts to this apartment. Each must be unique across all apartments.',
						'booking-suite'
					) }
				>
					<div className="bks-apartment-form__row">
						<Field
							label={ __(
								'Internal short link',
								'booking-suite'
							) }
							htmlFor="bks-apartment-internal-link"
						>
							<TextInput
								id="bks-apartment-internal-link"
								value={ values.internalShortLink }
								maxLength={ MAX_LENGTH_191 }
								placeholder={ __(
									'studio-rheinblick',
									'booking-suite'
								) }
								onChange={ setInput( 'internalShortLink' ) }
							/>
						</Field>

						<Field
							label={ __(
								'Booking short link',
								'booking-suite'
							) }
							htmlFor="bks-apartment-booking-link"
						>
							<TextInput
								id="bks-apartment-booking-link"
								value={ values.bookingShortLink }
								maxLength={ MAX_LENGTH_191 }
								placeholder={ __(
									'book-rheinblick',
									'booking-suite'
								) }
								onChange={ setInput( 'bookingShortLink' ) }
							/>
						</Field>
					</div>
				</FormSection>

				{ /* description */ }
				<FormSection
					icon={ <TextIcon /> }
					title={ __( 'Description', 'booking-suite' ) }
					description={ __(
						'Shown to guests on the website.',
						'booking-suite'
					) }
				>
					<SegmentedControl
						options={ DESCRIPTION_MODES }
						value={ descriptionMode }
						onChange={ setDescriptionMode }
						label={ __( 'Description format', 'booking-suite' ) }
					/>

					<Field className="bks-apartment-form__description">
						<TextInput
							multiline
							rows={ 8 }
							value={ values.description }
							placeholder={
								'html' === descriptionMode
									? __(
											'<p>Describe the apartment…</p>',
											'booking-suite'
									  )
									: __(
											'Describe the apartment…',
											'booking-suite'
									  )
							}
							onChange={ setInput( 'description' ) }
						/>
					</Field>
				</FormSection>
			</form>
		</Modal>
	);
}
