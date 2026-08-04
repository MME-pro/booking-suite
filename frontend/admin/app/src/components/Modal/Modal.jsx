/**
 * Modal — sheet with a titled header, a scrolling body and a pinned footer.
 *
 * Closes on Escape and on a click outside the sheet. Page scrolling is frozen
 * while it is open, otherwise wp-admin scrolls behind it.
 */

import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';

import { CloseIcon } from '../icons';
import './Modal.css';

export default function Modal( {
	children,
	title,
	description = null,
	icon = null,
	onClose,
	footer = null,
	className = '',
} ) {
	useEffect( () => {
		const onKeyDown = ( event ) => {
			if ( 'Escape' === event.key ) {
				onClose();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener( 'keydown', onKeyDown );
			document.body.style.overflow = previousOverflow;
		};
	}, [ onClose ] );

	const classes = [ 'bks-modal', className ].filter( Boolean ).join( ' ' );

	return (
		<div
			className="bks-modal__overlay"
			role="presentation"
			onClick={ ( event ) => {
				if ( event.target === event.currentTarget ) {
					onClose();
				}
			} }
		>
			<div
				className={ classes }
				role="dialog"
				aria-modal="true"
				aria-label={ title }
			>
				<header className="bks-modal__header">
					{ icon && (
						<span className="bks-modal__icon" aria-hidden="true">
							{ icon }
						</span>
					) }
					<div className="bks-modal__heading">
						<h2 className="bks-modal__title">{ title }</h2>
						{ description && (
							<p className="bks-modal__description">
								{ description }
							</p>
						) }
					</div>
					<button
						type="button"
						className="bks-modal__close"
						onClick={ onClose }
						aria-label={ __( 'Close', 'booking-suite' ) }
					>
						<CloseIcon />
					</button>
				</header>

				<div className="bks-modal__body">{ children }</div>

				{ footer && (
					<footer className="bks-modal__footer">{ footer }</footer>
				) }
			</div>
		</div>
	);
}
