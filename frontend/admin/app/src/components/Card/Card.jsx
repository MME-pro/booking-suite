/**
 * Card — neutral surface that groups related content.
 */

import './Card.css';

export default function Card( {
	children,
	title = null,
	actions = null,
	padded = true,
	className = '',
} ) {
	const classes = [ 'bks-card', padded ? 'bks-card--padded' : '', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<section className={ classes }>
			{ ( title || actions ) && (
				<div className="bks-card__header">
					{ title && <h2 className="bks-card__title">{ title }</h2> }
					{ actions && (
						<div className="bks-card__actions">{ actions }</div>
					) }
				</div>
			) }
			<div className="bks-card__body">{ children }</div>
		</section>
	);
}
