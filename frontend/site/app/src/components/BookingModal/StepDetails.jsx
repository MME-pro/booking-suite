/**
 * Step 3 — who is staying.
 */

import { __ } from '@wordpress/i18n';

const FIELDS = [
	{
		key: 'firstName',
		id: 'bks-modal-first-name',
		label: __( 'First name', 'booking-suite' ),
		autoComplete: 'given-name',
		required: true,
	},
	{
		key: 'lastName',
		id: 'bks-modal-last-name',
		label: __( 'Last name', 'booking-suite' ),
		autoComplete: 'family-name',
		required: true,
	},
	{
		key: 'email',
		id: 'bks-modal-email',
		label: __( 'Email', 'booking-suite' ),
		type: 'email',
		autoComplete: 'email',
		required: true,
	},
	{
		key: 'phone',
		id: 'bks-modal-phone',
		label: __( 'Phone', 'booking-suite' ),
		type: 'tel',
		autoComplete: 'tel',
	},
];

const ADDRESS = [
	{
		key: 'postcode',
		id: 'bks-modal-postcode',
		label: __( 'Postcode', 'booking-suite' ),
		autoComplete: 'postal-code',
		narrow: true,
	},
	{
		key: 'city',
		id: 'bks-modal-city',
		label: __( 'City', 'booking-suite' ),
		autoComplete: 'address-level2',
	},
	{
		key: 'country',
		id: 'bks-modal-country',
		label: __( 'Country', 'booking-suite' ),
		autoComplete: 'country',
		narrow: true,
		maxLength: 2,
		placeholder: 'DE',
	},
];

export default function StepDetails( { guest, onChange } ) {
	const set = ( key ) => ( event ) =>
		onChange( { ...guest, [ key ]: event.target.value } );

	const field = ( config ) => (
		<div
			key={ config.key }
			className={ `bks-field${
				config.narrow ? ' bks-field--narrow' : ''
			}` }
		>
			<label htmlFor={ config.id }>
				{ config.label }
				{ config.required && <em>*</em> }
			</label>
			<input
				id={ config.id }
				type={ config.type ?? 'text' }
				autoComplete={ config.autoComplete }
				maxLength={ config.maxLength }
				placeholder={ config.placeholder }
				value={ guest[ config.key ] }
				onChange={ set( config.key ) }
			/>
		</div>
	);

	return (
		<div className="bks-step">
			<div className="bks-step__row">
				{ FIELDS.slice( 0, 2 ).map( field ) }
			</div>

			<div className="bks-step__row">
				{ FIELDS.slice( 2 ).map( field ) }
			</div>

			<div className="bks-field">
				<label htmlFor="bks-modal-address">
					{ __( 'Address', 'booking-suite' ) }
				</label>
				<input
					id="bks-modal-address"
					type="text"
					autoComplete="street-address"
					value={ guest.address }
					onChange={ set( 'address' ) }
				/>
			</div>

			<div className="bks-step__row">{ ADDRESS.map( field ) }</div>

			<div className="bks-field">
				<label htmlFor="bks-modal-notes">
					{ __( 'Anything we should know?', 'booking-suite' ) }
				</label>
				<textarea
					id="bks-modal-notes"
					rows={ 3 }
					value={ guest.notes }
					onChange={ set( 'notes' ) }
				/>
			</div>

			<p className="bks-step__hint">
				{ __(
					'We will email you a confirmation with the bank transfer details. Nothing is charged online.',
					'booking-suite'
				) }
			</p>
		</div>
	);
}
