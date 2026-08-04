/**
 * Notice — inline message for request outcomes.
 */

import './Notice.css';

const TONES = [ 'info', 'success', 'warning', 'error' ];

export default function Notice( {
	children,
	tone = 'info',
	actions = null,
	className = '',
} ) {
	const safeTone = TONES.includes( tone ) ? tone : 'info';

	const classes = [ 'bks-notice', `bks-notice--${ safeTone }`, className ]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div
			className={ classes }
			role={ 'error' === safeTone ? 'alert' : 'status' }
		>
			<p className="bks-notice__text">{ children }</p>
			{ actions && (
				<div className="bks-notice__actions">{ actions }</div>
			) }
		</div>
	);
}
