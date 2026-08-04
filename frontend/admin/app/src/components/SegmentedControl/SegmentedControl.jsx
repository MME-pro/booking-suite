/**
 * SegmentedControl — small tab strip for switching between equivalent editors
 * or views, such as the description's Text and HTML modes.
 *
 * options = [ { value, label } ]
 */

import './SegmentedControl.css';

export default function SegmentedControl( {
	options,
	value,
	onChange,
	label,
	className = '',
} ) {
	const classes = [ 'bks-segmented', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes } role="tablist" aria-label={ label }>
			{ options.map( ( option ) => {
				const selected = option.value === value;

				return (
					<button
						key={ option.value }
						type="button"
						role="tab"
						aria-selected={ selected }
						className={ `bks-segmented__option${
							selected ? ' is-selected' : ''
						}` }
						onClick={ () => onChange( option.value ) }
					>
						{ option.label }
					</button>
				);
			} ) }
		</div>
	);
}
