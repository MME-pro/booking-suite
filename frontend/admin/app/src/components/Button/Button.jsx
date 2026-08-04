/**
 * Button — the single control used for every action in the admin app.
 */

import './Button.css';

const VARIANTS = [ 'primary', 'secondary', 'tertiary', 'danger', 'accent' ];
const SIZES = [ 'sm', 'md' ];

export default function Button( {
	children,
	variant = 'secondary',
	size = 'md',
	icon = null,
	iconPosition = 'start',
	type = 'button',
	disabled = false,
	className = '',
	...props
} ) {
	const safeVariant = VARIANTS.includes( variant ) ? variant : 'secondary';
	const safeSize = SIZES.includes( size ) ? size : 'md';

	const classes = [
		'bks-button',
		`bks-button--${ safeVariant }`,
		`bks-button--${ safeSize }`,
		icon && ! children ? 'bks-button--icon-only' : '',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	const glyph = icon && (
		<span className="bks-button__icon" aria-hidden="true">
			{ icon }
		</span>
	);

	return (
		<button
			type={ type }
			className={ classes }
			disabled={ disabled }
			{ ...props }
		>
			{ 'start' === iconPosition && glyph }
			{ children && (
				<span className="bks-button__label">{ children }</span>
			) }
			{ 'end' === iconPosition && glyph }
		</button>
	);
}
