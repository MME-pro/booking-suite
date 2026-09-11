/**
 * The thank-you page.
 *
 * The last screen of the guest flow: order → payment page → "Transfer
 * initiated" → here. It lives on the payment page's URL rather than in the
 * booking modal, so it survives a reload and can be reached again from the
 * link in the booking email.
 *
 * Nothing has been received yet and this page is careful not to imply
 * otherwise. It repeats the account details rather than replacing them with a
 * tick, because the likeliest reason someone is reading it is that they got as
 * far as their banking app and want to check the IBAN one more time.
 *
 * The one thing it adds is what happens next, and who does it — the owner, when
 * the money actually arrives.
 */

import { __ } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

export default function StepDone( { payment } ) {
	if ( ! payment ) {
		return null;
	}

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
					<dd>{ payment.reference }</dd>
				</div>
				<div>
					<dt>{ __( 'Amount', 'booking-suite' ) }</dt>
					<dd>
						{ formatPrice(
							payment.total,
							payment.currency,
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
							<strong>{ payment.reference }</strong>
						</dd>
					</div>
				</dl>
			) }
		</div>
	);
}
