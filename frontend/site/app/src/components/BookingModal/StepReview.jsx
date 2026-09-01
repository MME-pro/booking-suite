/**
 * Step 5 — everything before it is committed.
 *
 * The last thing a guest reads before parting with money, so it is arranged
 * the way they check it: what am I booking, when exactly, is that me, what
 * does it cost. Four blocks in that order, and nothing else.
 *
 * The price used to be shown night by night — six lines of dates and rates for
 * a week, each tagged weekend or holiday. That is the owner's arithmetic, not
 * the guest's question. The guest wants one price for the apartment, anything
 * added on top named separately, and a total they cannot mistake. The nightly
 * detail is still on the booking in the admin, where it is the right answer.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import {
	CalendarIcon,
	ClockIcon,
	HomeIcon,
	MailIcon,
	PhoneIcon,
	UserIcon,
	UsersIcon,
} from '../icons';
import { settings } from '../../services/apartmentService';
import { formatPrice, formatWpDate, formatWpTime } from '../../utils/format';

/**
 * 'HH:MM:SS' or 'HH:MM' → 'HH:MM'.
 *
 * @param {string} time The stored time.
 * @return {string} Hours and minutes.
 */
const clock = ( time ) => String( time ?? '' ).slice( 0, 5 );

/**
 * Where an hourly booking ends.
 *
 * Built as a real date rather than by adding to the clock, because a visit
 * from 22:00 for four hours ends at 02:00 the NEXT day — and a review screen
 * that showed it ending at 02:00 on the arrival date would be telling the
 * guest something that never happens.
 *
 * @param {string} dateKey   The arrival day, 'YYYY-MM-DD'.
 * @param {string} startTime The arrival time.
 * @param {number} hours     How long the booking runs.
 * @return {Date} The moment it ends.
 */
const hourlyEnd = ( dateKey, startTime, hours ) => {
	const [ year, month, day ] = String( dateKey ).split( '-' ).map( Number );
	const [ hh, mm ] = clock( startTime ).split( ':' ).map( Number );

	const end = new Date(
		year,
		( month || 1 ) - 1,
		day || 1,
		hh || 0,
		mm || 0
	);

	end.setMinutes( end.getMinutes() + Math.round( ( hours || 0 ) * 60 ) );

	return end;
};

/**
 * A Date as the 'YYYY-MM-DD' key formatWpDate expects.
 *
 * @param {Date} date The date.
 * @return {string} The day key.
 */
const keyOf = ( date ) =>
	`${ date.getFullYear() }-${ String( date.getMonth() + 1 ).padStart(
		2,
		'0'
	) }-${ String( date.getDate() ).padStart( 2, '0' ) }`;

/**
 * A Date as 'HH:MM'.
 *
 * @param {Date} date The moment.
 * @return {string} Hours and minutes.
 */
const timeOf = ( date ) =>
	`${ String( date.getHours() ).padStart( 2, '0' ) }:${ String(
		date.getMinutes()
	).padStart( 2, '0' ) }`;

export default function StepReview( {
	apartment,
	stay,
	guest,
	quote,
	currency,
	checkInTime,
	checkOutTime,
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

	const isHourly = 'hourly' === quote.mode;
	const nights = ( quote.nightBreakdown ?? [] ).length;
	const hours = quote.duration?.bookedHours ?? 0;

	/** How long the stay runs, in the unit it is sold in. */
	const length = isHourly
		? sprintf(
				/* translators: %d: number of hours. */
				_n( '%d hour', '%d hours', hours, 'booking-suite' ),
				hours
		  )
		: sprintf(
				/* translators: %d: number of nights. */
				_n( '%d night', '%d nights', nights, 'booking-suite' ),
				nights
		  );

	/*
	 * Both ends of the booking, as a date and a time each. An overnight stay
	 * runs the property's own window — the guest never picks those times, so
	 * this is the only place they are spelled out before it is booked.
	 */
	const end = isHourly ? hourlyEnd( stay.date, stay.startTime, hours ) : null;

	const from = {
		date: formatWpDate( isHourly ? stay.date : stay.checkIn ),
		time: formatWpTime(
			isHourly ? stay.startTime : checkInTime || '16:00:00'
		),
	};

	const to = {
		date: formatWpDate( isHourly ? keyOf( end ) : stay.checkOut ),
		time: isHourly
			? formatWpTime( timeOf( end ) )
			: formatWpTime( checkOutTime || '11:00:00' ),
	};

	const fullName = `${ guest.firstName } ${ guest.lastName }`.trim();
	const discount = quote.duration?.discount ?? 0;

	return (
		<div className="bks-review">
			{ /*
			 * Three facts, in the order they are asked: what, when, how many.
			 * The icons are what let this be read at a glance rather than
			 * parsed — the dates are the one item that needs a second look,
			 * and the block underneath is where that look goes.
			 */ }
			<ul className="bks-review__top">
				<li>
					<HomeIcon />
					<div>
						<span className="bks-review__label">
							{ __( 'Apartment', 'booking-suite' ) }
						</span>
						<strong>{ apartment.name }</strong>
					</div>
				</li>
				<li>
					<CalendarIcon />
					<div>
						<span className="bks-review__label">
							{ __( 'Dates', 'booking-suite' ) }
						</span>
						<strong>
							{ isHourly
								? from.date
								: `${ from.date } – ${ to.date }` }
						</strong>
					</div>
				</li>
				<li>
					<UsersIcon />
					<div>
						<span className="bks-review__label">
							{ __( 'Guests', 'booking-suite' ) }
						</span>
						<strong>{ stay.guests }</strong>
					</div>
				</li>
			</ul>

			{ /* The window itself: both ends, with their times, and how long. */ }
			<div className="bks-review__range">
				<div className="bks-review__range-end">
					<span className="bks-review__label">
						{ __( 'From', 'booking-suite' ) }
					</span>
					<strong>{ from.date }</strong>
					<em>{ from.time }</em>
				</div>

				<span className="bks-review__range-arrow" aria-hidden="true">
					→
				</span>

				<div className="bks-review__range-end">
					<span className="bks-review__label">
						{ __( 'To', 'booking-suite' ) }
					</span>
					<strong>{ to.date }</strong>
					<em>{ to.time }</em>
				</div>

				<p className="bks-review__range-length">
					<ClockIcon />
					{ length }
				</p>
			</div>

			{ /* Who it is for, together rather than scattered through a list. */ }
			<ul className="bks-review__guest">
				<li>
					<UserIcon />
					{ fullName }
				</li>
				<li>
					<MailIcon />
					{ guest.email }
				</li>
				{ guest.phone && (
					<li>
						<PhoneIcon />
						{ guest.phone }
					</li>
				) }
			</ul>

			<ul className="bks-review__lines">
				{ /*
				 * One price for the apartment, however many nights or hours
				 * that is. `accommodation` is the server's own figure for
				 * exactly this, so the line cannot drift from what is charged.
				 */ }
				<li>
					<span>
						{ __( 'Base price', 'booking-suite' ) }
						<small>{ length }</small>
						{ discount > 0 && (
							<em className="bks-review__saving">
								{ sprintf(
									/* translators: %s: the amount saved. */
									__( 'includes %s off', 'booking-suite' ),
									money( discount )
								) }
							</em>
						) }
					</span>
					<span>{ money( quote.accommodation ) }</span>
				</li>

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
