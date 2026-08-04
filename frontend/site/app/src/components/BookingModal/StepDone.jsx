/**
 * Step 4 — the request is in.
 */

import { __ } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

export default function StepDone( { booking, currency } ) {
	if ( ! booking ) {
		return null;
	}

	return (
		<div className="bks-done">
			<span className="bks-done__mark" aria-hidden="true">
				✓
			</span>

			<h3 className="bks-done__title">
				{ __( 'Request received', 'booking-suite' ) }
			</h3>

			<p className="bks-done__message">{ booking.message }</p>

			<dl className="bks-done__summary">
				<div>
					<dt>{ __( 'Reference', 'booking-suite' ) }</dt>
					<dd>{ booking.reference }</dd>
				</div>
				<div>
					<dt>{ __( 'Total', 'booking-suite' ) }</dt>
					<dd>
						{ formatPrice(
							booking.total,
							currency,
							settings.locale
						) }
					</dd>
				</div>
			</dl>
		</div>
	);
}
