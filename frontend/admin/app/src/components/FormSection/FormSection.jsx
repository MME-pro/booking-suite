/**
 * FormSection — titled panel grouping related fields.
 *
 * The icon tile and the step-style heading are what stop a long form reading
 * as one undifferentiated stack of inputs.
 */

import './FormSection.css';

export default function FormSection( {
	children,
	title,
	description = null,
	icon = null,
	className = '',
} ) {
	const classes = [ 'bks-form-section', className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<section className={ classes }>
			<header className="bks-form-section__header">
				{ icon && (
					<span className="bks-form-section__icon" aria-hidden="true">
						{ icon }
					</span>
				) }
				<div className="bks-form-section__heading">
					<h3 className="bks-form-section__title">{ title }</h3>
					{ description && (
						<p className="bks-form-section__description">
							{ description }
						</p>
					) }
				</div>
			</header>

			<div className="bks-form-section__body">{ children }</div>
		</section>
	);
}
