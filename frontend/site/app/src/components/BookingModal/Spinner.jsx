/**
 * The one loading indicator the modal uses.
 *
 * Every wait used to print a sentence — "Loading…", "Checking availability…" —
 * which reads as something the guest is being told rather than as the screen
 * working. A turning ring says the same thing without asking to be read, and
 * says it the same way in every place it appears.
 *
 * The label is still written for screen readers, which have nothing to look at.
 */

import { __ } from '@wordpress/i18n';

/**
 * @param {Object}  props
 * @param {string}  [props.label] What is being waited for, for assistive tech.
 * @param {boolean} [props.small] A smaller ring, for sitting beside a control.
 * @return {JSX.Element} The spinner.
 */
export default function Spinner( { label, small = false } ) {
	return (
		<span
			className={ `bks-loading${ small ? ' bks-loading--inline' : '' }` }
			role="status"
			aria-live="polite"
			aria-label={ label || __( 'Loading', 'booking-suite' ) }
		>
			<span
				className={ `bks-spinner${ small ? ' bks-spinner--sm' : '' }` }
				aria-hidden="true"
			/>
		</span>
	);
}
