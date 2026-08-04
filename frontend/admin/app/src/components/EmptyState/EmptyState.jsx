/**
 * EmptyState — shown when a list has nothing to display.
 */

import './EmptyState.css';

export default function EmptyState( {
	title,
	description = null,
	icon = null,
	action = null,
	className = '',
} ) {
	const classes = [ 'bks-empty-state', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			{ icon && (
				<span className="bks-empty-state__icon" aria-hidden="true">
					{ icon }
				</span>
			) }
			<h2 className="bks-empty-state__title">{ title }</h2>
			{ description && (
				<p className="bks-empty-state__description">{ description }</p>
			) }
			{ action && (
				<div className="bks-empty-state__action">{ action }</div>
			) }
		</div>
	);
}
