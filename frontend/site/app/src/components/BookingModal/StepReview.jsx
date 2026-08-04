/**
 * Step 5 — everything before it is committed.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { settings } from '../../services/apartmentService';
import { formatPrice } from '../../utils/format';

export default function StepReview( {
	apartment,
	stay,
	guest,
	quote,
	currency,
	overnightWindow,
} ) {
	if ( ! quote ) {
		return (
			<p className="bks-step__hint">
				{ __( 'Working out the price…', 'booking-suite' ) }
			</p>
		);
	}

	const money = ( amount ) =>
		formatPrice( amount, currency, settings.locale );

	const when =
		'hourly' === quote.mode
			? sprintf(
					/* translators: 1: date, 2: start time, 3: number of hours. */
					__( '%1$s from %2$s · %3$s', 'booking-suite' ),
					stay.date,
					stay.startTime,
					sprintf(
						/* translators: %d: number of hours. */
						_n(
							'%d hour',
							'%d hours',
							quote.duration?.bookedHours ?? 0,
							'booking-suite'
						),
						quote.duration?.bookedHours ?? 0
					)
			  )
			: sprintf(
					/* translators: 1: check-in date, 2: check-out date, 3: the overnight window. */
					__( '%1$s → %2$s · %3$s', 'booking-suite' ),
					stay.checkIn,
					stay.checkOut,
					overnightWindow
			  );

	return (
		<div className="bks-review">
			<dl className="bks-review__facts">
				<div>
					<dt>{ __( 'Apartment', 'booking-suite' ) }</dt>
					<dd>{ apartment.name }</dd>
				</div>
				<div>
					<dt>{ __( 'When', 'booking-suite' ) }</dt>
					<dd>{ when }</dd>
				</div>
				<div>
					<dt>{ __( 'Guests', 'booking-suite' ) }</dt>
					<dd>{ stay.guests }</dd>
				</div>
				<div>
					<dt>{ __( 'Name', 'booking-suite' ) }</dt>
					<dd>
						{ `${ guest.firstName } ${ guest.lastName }`.trim() }
					</dd>
				</div>
				<div>
					<dt>{ __( 'Email', 'booking-suite' ) }</dt>
					<dd>{ guest.email }</dd>
				</div>
			</dl>

			<ul className="bks-review__lines">
				{ 'overnight' === quote.mode &&
					( quote.nightBreakdown ?? [] ).map( ( night ) => (
						<li key={ night.date }>
							<span>
								{ night.date }
								{ night.holiday && (
									<em className="bks-review__tag">
										{ __( 'holiday', 'booking-suite' ) }
									</em>
								) }
								{ ! night.holiday && night.weekend && (
									<em className="bks-review__tag">
										{ __( 'weekend', 'booking-suite' ) }
									</em>
								) }
							</span>
							<span>{ money( night.rate ) }</span>
						</li>
					) ) }

				{ 'hourly' === quote.mode && quote.duration && (
					<>
						<li>
							<span>
								{ sprintf(
									/* translators: %d: hours the base rate covers. */
									__(
										'Base — first %d hours',
										'booking-suite'
									),
									quote.duration.baseHours
								) }
							</span>
							<span>{ money( quote.duration.baseRate ) }</span>
						</li>
						{ quote.duration.extraHours > 0 && (
							<li>
								<span>
									{ sprintf(
										/* translators: 1: extra hours, 2: price per hour. */
										__(
											'%1$d extra hours × %2$s',
											'booking-suite'
										),
										quote.duration.extraHours,
										money( quote.duration.hourlySurcharge )
									) }
								</span>
								<span>
									{ money( quote.duration.extraTotal ) }
								</span>
							</li>
						) }
						{ quote.duration.discount > 0 && (
							<li className="bks-review__discount">
								<span>
									{ __( 'Discount', 'booking-suite' ) }
								</span>
								<span>
									− { money( quote.duration.discount ) }
								</span>
							</li>
						) }
					</>
				) }

				{ quote.guestCharge?.extraGuests > 0 && (
					<li>
						<span>
							{ sprintf(
								/* translators: 1: number of extra guests, 2: price per guest. */
								__(
									'%1$d extra guests × %2$s',
									'booking-suite'
								),
								quote.guestCharge.extraGuests,
								money( quote.guestCharge.perGuest )
							) }
						</span>
						<span>{ money( quote.guestCharge.total ) }</span>
					</li>
				) }

				{ ( quote.extraLines ?? [] ).map( ( line ) => (
					<li key={ line.id }>
						<span>{ `${ line.name } × ${ line.quantity }` }</span>
						<span>{ money( line.subtotal ) }</span>
					</li>
				) ) }
			</ul>

			<p className="bks-review__total">
				<span>{ __( 'Total', 'booking-suite' ) }</span>
				<strong>{ money( quote.total ) }</strong>
			</p>
		</div>
	);
}
