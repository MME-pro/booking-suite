import { BrandMark } from '../icons';
import './AppBar.css';

export default function AppBar( {
	title,
	subtitle = 'Management Console',
	actions = null,
	className = '',
} ) {
	const classes = [ 'bks-app-bar', className ].filter( Boolean ).join( ' ' );

	return (
		<header className={ classes }>
			<div className="bks-app-bar__brand-wrap">
				<span className="bks-app-bar__brand" aria-hidden="true">
					<BrandMark />
				</span>
				<div className="bks-app-bar__title-group">
					<h1 className="bks-app-bar__title">{ title }</h1>
					{ subtitle && (
						<span className="bks-app-bar__subtitle">
							{ subtitle }
						</span>
					) }
				</div>
			</div>

			{ actions && (
				<div className="bks-app-bar__actions">{ actions }</div>
			) }
		</header>
	);
}
