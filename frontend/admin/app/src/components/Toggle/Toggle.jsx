/**
 * Toggle — switch with an inline label and optional help icon.
 */

import { HelpIcon } from '../icons';
import './Toggle.css';

export default function Toggle( {
	checked,
	onChange,
	label,
	help = null,
	id,
	className = '',
} ) {
	const classes = [ 'bks-toggle', className ].filter( Boolean ).join( ' ' );

	return (
		<div className={ classes }>
			<input
				id={ id }
				type="checkbox"
				className="bks-toggle__input"
				checked={ checked }
				onChange={ ( event ) => onChange( event.target.checked ) }
			/>
			<label className="bks-toggle__label" htmlFor={ id }>
				<span className="bks-toggle__track" aria-hidden="true">
					<span className="bks-toggle__thumb" />
				</span>
				<span className="bks-toggle__text">{ label }</span>
			</label>
			{ help && (
				<span className="bks-toggle__help" title={ help }>
					<HelpIcon />
					<span className="bks-sr-only">{ help }</span>
				</span>
			) }
		</div>
	);
}
