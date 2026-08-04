/**
 * Field — the bordered box every input in the design sits inside.
 *
 * The label sits in a notch cut into the top border, with an optional slot at
 * the opposite corner for adornments such as a "Translate" link or a help icon.
 * Controls rendered inside supply no border of their own.
 */

import './Field.css';

export default function Field( {
	children,
	label = null,
	htmlFor = null,
	required = false,
	adornment = null,
	className = '',
} ) {
	const classes = [ 'bks-field', className ].filter( Boolean ).join( ' ' );

	return (
		<div className={ classes }>
			{ ( label || required ) && (
				<label className="bks-field__label" htmlFor={ htmlFor }>
					{ required && (
						<span
							className="bks-field__required"
							aria-hidden="true"
						>
							*
						</span>
					) }
					{ label }
				</label>
			) }
			{ adornment && (
				<span className="bks-field__adornment">{ adornment }</span>
			) }
			<div className="bks-field__control">{ children }</div>
		</div>
	);
}
