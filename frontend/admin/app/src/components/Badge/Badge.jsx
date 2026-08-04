/**
 * Badge — compact status label.
 */

import './Badge.css';

const TONES = [ 'neutral', 'success', 'warning', 'danger', 'brand' ];

export default function Badge( {
	children,
	tone = 'neutral',
	className = '',
} ) {
	const safeTone = TONES.includes( tone ) ? tone : 'neutral';

	const classes = [ 'bks-badge', `bks-badge--${ safeTone }`, className ]
		.filter( Boolean )
		.join( ' ' );

	return <span className={ classes }>{ children }</span>;
}
