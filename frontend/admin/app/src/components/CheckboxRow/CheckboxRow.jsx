/**
 * CheckboxRow — full-width banded row holding a single checkbox, used for
 * standalone booking rules rather than for lists of options.
 */

import { HelpIcon } from '../icons';
import './CheckboxRow.css';

export default function CheckboxRow( {
	checked,
	onChange,
	label,
	help = null,
	id,
	className = '',
} ) {
	const classes = [ 'bks-checkbox-row', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			<input
				id={ id }
				type="checkbox"
				className="bks-checkbox-row__input"
				checked={ checked }
				onChange={ ( event ) => onChange( event.target.checked ) }
			/>
			<label className="bks-checkbox-row__label" htmlFor={ id }>
				<span className="bks-checkbox-row__box" aria-hidden="true" />
				<span className="bks-checkbox-row__text">{ label }</span>
			</label>
			{ help && (
				<span className="bks-checkbox-row__help" title={ help }>
					<HelpIcon />
					<span className="bks-sr-only">{ help }</span>
				</span>
			) }
		</div>
	);
}
