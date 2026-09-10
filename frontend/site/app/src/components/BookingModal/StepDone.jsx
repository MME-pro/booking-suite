/**
 * The thank-you page.
 *
 * Reached after the guest has said the transfer is on its way. Nothing has been
 * received yet and this page is careful not to imply otherwise: it repeats the
 * payment details rather than replacing them with a tick, because the most
 * likely reason someone is reading it is that they got as far as their banking
 * app and want to check the IBAN one more time.
 *
 * The one thing it adds is what happens next, and who does it — the owner, when
 * the money actually arrives.
 */

import { __ } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

export default function StepDone( { booking, currency } ) {
	if ( ! booking ) {
		return null;
	}

	const payment = booking.payment ?? {};
	const bank = payment.bank ?? {};

	return (
		<div className="bks-done">
			<span className="bks-done__mark" aria-hidden="true">
				✓
			</span>

			<h3 className="bks-done__title">
				{ __( 'Thank you — your booking is placed', 'booking-suite' ) }
			</h3>

			<p className="bks-done__message">
				{ __(
					'Once we have received your payment, you will receive a separate confirmation by email.',
					'booking-suite'
				) }
			</p>

			<dl className="bks-done__summary">
				<div>
					<dt>{ __( 'Booking number', 'booking-suite' ) }</dt>
					<dd>{ booking.reference }</dd>
				</div>
				<div>
					<dt>{ __( 'Amount', 'booking-suite' ) }</dt>
					<dd>
						{ formatPrice(
							booking.total,
							currency,
							settings.locale
						) }
					</dd>
				</div>
			</dl>

			{ /*
			 * Shown again rather than linked to. A guest on a phone who has
			 * closed their banking app and come back here should not have to
			 * navigate anywhere to read the IBAN a second time.
			 */ }
			{ bank.iban && (
				<dl className="bks-done__bank">
					<div>
						<dt>{ __( 'Account holder', 'booking-suite' ) }</dt>
						<dd>{ bank.holder }</dd>
					</div>
					<div>
						<dt>{ __( 'IBAN', 'booking-suite' ) }</dt>
						<dd>{ bank.iban }</dd>
					</div>
					{ bank.bic && (
						<div>
							<dt>{ __( 'BIC', 'booking-suite' ) }</dt>
							<dd>{ bank.bic }</dd>
						</div>
					) }
					<div>
						<dt>{ __( 'Payment reference', 'booking-suite' ) }</dt>
						<dd>
							<strong>{ booking.reference }</strong>
						</dd>
					</div>
				</dl>
			) }
		</div>
	);
}
