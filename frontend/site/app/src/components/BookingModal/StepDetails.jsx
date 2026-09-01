/**
 * Step 3 — who is staying.
 *
 * Name, email, phone, and anything the guest wants to tell us. No address:
 * payment is by bank transfer and the invoice does not print one, so asking
 * for a street, postcode, city and country was four fields that went into the
 * database and were never read. Every field on a booking form is somewhere the
 * guest can give up, and these were the ones earning the least.
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

export default function StepDetails( { guest, onChange } ) {
	const set = ( key ) => ( event ) =>
		onChange( { ...guest, [ key ]: event.target.value } );

	const field = ( config ) => (
		<div key={ config.key } className="bks-field">
			<label htmlFor={ config.id }>
				{ config.label }
				{ config.required && <em>*</em> }
			</label>
			<input
				id={ config.id }
				type={ config.type ?? 'text' }
				autoComplete={ config.autoComplete }
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
