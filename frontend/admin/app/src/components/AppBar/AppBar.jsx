import { BrandMark } from '../icons';
import { InstallApp } from '../InstallApp';
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

			{ /*
			 * The install offer lives here rather than on one screen, because
			 * the operator is as likely to decide they want this on their phone
			 * while looking at the calendar as anywhere else. It renders nothing
			 * unless installing is actually possible and the app is not already
			 * installed, so the bar stays empty on a desktop.
			 */ }
			<div className="bks-app-bar__actions">
				<InstallApp />
				{ actions }
			</div>
		</header>
	);
}
