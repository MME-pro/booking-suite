/**
 * ColorField — hex value with a swatch that opens the native colour picker.
 *
 * The stored value keeps its leading '#', matching the `colour` column.
 */

import './ColorField.css';

const HEX = /^#[0-9a-f]{6}$/i;

export default function ColorField( { value, onChange, id, className = '' } ) {
	const classes = [ 'bks-color-field', className ]
		.filter( Boolean )
		.join( ' ' );

	// The swatch input rejects anything that is not a full hex triplet.
	const swatchValue = HEX.test( value ) ? value : '#000000';

	return (
		<div className={ classes }>
			<input
				id={ id }
				type="text"
				className="bks-color-field__text"
				value={ value }
				maxLength={ 7 }
				spellCheck={ false }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
			<span className="bks-color-field__swatch">
				<input
					type="color"
					className="bks-color-field__picker"
					value={ swatchValue }
					onChange={ ( event ) => onChange( event.target.value ) }
				/>
				<span
					className="bks-color-field__dot"
					style={ { background: swatchValue } }
					aria-hidden="true"
				/>
			</span>
		</div>
	);
}
