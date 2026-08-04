/**
 * SearchField — controlled search input with a clear affordance.
 */

import { __ } from '@wordpress/i18n';

import { SearchIcon, CloseIcon } from '../icons';
import './SearchField.css';

export default function SearchField( {
	value,
	onChange,
	label = __( 'Search', 'booking-suite' ),
	placeholder = '',
	id = 'bks-search-field',
	className = '',
} ) {
	const classes = [ 'bks-search-field', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			<label className="bks-sr-only" htmlFor={ id }>
				{ label }
			</label>
			<span className="bks-search-field__icon" aria-hidden="true">
				<SearchIcon />
			</span>
			<input
				id={ id }
				type="search"
				className="bks-search-field__input"
				value={ value }
				placeholder={ placeholder }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
			{ value && (
				<button
					type="button"
					className="bks-search-field__clear"
					onClick={ () => onChange( '' ) }
					aria-label={ __( 'Clear search', 'booking-suite' ) }
				>
					<CloseIcon />
				</button>
			) }
		</div>
	);
}
