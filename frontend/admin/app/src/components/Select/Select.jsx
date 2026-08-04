/**
 * Select — borderless native select meant to sit inside a Field.
 *
 * options = [ { value, label } ]
 */

import { ChevronDownIcon } from '../icons';
import './Select.css';

export default function Select( {
	options,
	placeholder = null,
	className = '',
	...props
} ) {
	const classes = [ 'bks-select', className ].filter( Boolean ).join( ' ' );

	return (
		<div className={ classes }>
			<select className="bks-select__control" { ...props }>
				{ placeholder && <option value="">{ placeholder }</option> }
				{ options.map( ( option ) => (
					<option key={ option.value } value={ option.value }>
						{ option.label }
					</option>
				) ) }
			</select>
			<span className="bks-select__chevron" aria-hidden="true">
				<ChevronDownIcon />
			</span>
		</div>
	);
}
