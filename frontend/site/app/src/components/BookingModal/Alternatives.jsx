/**
 * What to offer when the chosen day has nothing.
 *
 * A guest told "nothing free that day" leaves. So the empty state is never
 * only a message: it carries the next real options, in the order a guest would
 * ask for them — this apartment on the soonest day it has room, then other
 * apartments that do take the party.
 *
 * Every tile says plainly which day and which apartment it belongs to, because
 * the one way to make this worse than a dead end is to let someone book a
 * different date than the one they think they are looking at.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { formatPrice, formatWpDate, formatWpTime } from '../../utils/format';

/**
 * One row of start times.
 *
 * @param {Object}   props
 * @param {Array}    props.slots    The free starts.
 * @param {string}   props.date     The day they fall on.
 * @param {string}   props.currency Currency code for the prices.
 * @param {Function} props.onPick   Called with { date, start }.
 * @return {JSX.Element} The tiles.
 */
function SlotRow( { slots, date, currency, onPick } ) {
	return (
		<div className="bks-slots bks-alt__slots">
			{ slots.map( ( slot ) => (
				<button
					key={ slot.startsAt }
					type="button"
					className="bks-slots__slot"
					onClick={ () => onPick( { date, start: slot.start } ) }
					title={ sprintf(
						/* translators: %s: end time. */
						__( 'until %s', 'booking-suite' ),
						formatWpTime( slot.end )
					) }
				>
					{ formatWpTime( slot.start ) }
					<span>{ formatPrice( slot.total, currency ) }</span>
				</button>
			) ) }
		</div>
	);
}

export default function Alternatives( {
	date,
	alternatives,
	currency,
	onPick,
	onSwitch,
} ) {
	const sameApartment = alternatives?.sameApartment ?? null;
	const others = alternatives?.otherApartments ?? [];

	return (
		<div className="bks-alt">
			<p className="bks-step__unavailable">
				{ sprintf(
					/* translators: %s: the date the guest asked for. */
					__(
						'Nothing free on %s for this length.',
						'booking-suite'
					),
					formatWpDate( date )
				) }
			</p>

			{ /*
			 * Nothing anywhere in the fortnight ahead. Rare, and the only case
			 * where there is genuinely nothing to offer — so it says what to
			 * change rather than pretending to have an answer.
			 */ }
			{ ! sameApartment && 0 === others.length && (
				<p className="bks-step__hint">
					{ __(
						'Try a shorter booking, a smaller party, or a date further ahead.',
						'booking-suite'
					) }
				</p>
			) }

			{ sameApartment && (
				<div className="bks-alt__group">
					<h3 className="bks-alt__title">
						{ sprintf(
							/* translators: %s: the next date with room. */
							__( 'Next free day — %s', 'booking-suite' ),
							formatWpDate( sameApartment.date )
						) }
					</h3>
					<p className="bks-alt__note">
						{ __(
							'This is a different day to the one you picked. Choosing a time moves your booking to it.',
							'booking-suite'
						) }
					</p>
					<SlotRow
						slots={ sameApartment.slots }
						date={ sameApartment.date }
						currency={ currency }
						onPick={ onPick }
					/>
				</div>
			) }

			{ others.length > 0 && (
				<div className="bks-alt__group">
					<h3 className="bks-alt__title">
						{ _n(
							'Another apartment that is free',
							'Other apartments that are free',
							others.length,
							'booking-suite'
						) }
					</h3>

					{ others.map( ( other ) => (
						<div key={ other.id } className="bks-alt__other">
							<p className="bks-alt__other-head">
								<strong>{ other.name }</strong>
								<span className="bks-alt__other-date">
									{ formatWpDate( other.date ) }
								</span>
							</p>

							{ /*
							 * Switching apartment reopens the modal on the
							 * other one, so the tiles here only carry the day
							 * and the price — the times are re-fetched against
							 * that apartment's own calendar once it opens.
							 */ }
							<SlotRow
								slots={ other.slots }
								date={ other.date }
								currency={ currency }
								onPick={ ( pick ) =>
									onSwitch?.( {
										id: other.id,
										date: pick.date,
										start: pick.start,
									} )
								}
							/>
						</div>
					) ) }
				</div>
			) }
		</div>
	);
}
