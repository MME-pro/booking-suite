/**
 * The stay the guest chose, carried through the steps that follow.
 *
 * Once the first step is behind them, the dates and times leave the screen
 * entirely: extras, details and verification say nothing about what is being
 * booked. A guest halfway through filling in an address had no way to check
 * the night they picked without going back and losing their place.
 *
 * Read from the stay itself rather than from the quote, so it is on screen
 * while the price is still being fetched. The length is the one part that
 * needs the quote, and it is left out until that arrives instead of holding
 * the whole line back.
 */

import { __, _n, sprintf } from '@wordpress/i18n';

import { formatWpDate, formatWpTime } from '../../utils/format';

/**
 * @param {Object}   props
 * @param {Object}   props.stay            What the guest picked.
 * @param {Object}   props.quote           The priced stay, or null while it loads.
 * @param {string}   props.overnightWindow The property's own check-in/out times.
 * @param {Function} props.onEdit          Sends the guest back to the first step.
 * @return {JSX.Element|null} The summary, or nothing if no stay is chosen yet.
 */
export default function StaySummary( {
	stay,
	quote,
	overnightWindow,
	onEdit,
} ) {
	const isOvernight = 'overnight' === stay?.mode;
	const startDate = isOvernight ? stay?.checkIn : stay?.date;

	// Nothing chosen yet — the first step is still the one answering for it.
	if ( ! startDate ) {
		return null;
	}

	const parts = [ formatWpDate( startDate ) ];

	if ( isOvernight ) {
		if ( stay.checkOut ) {
			parts.push(
				sprintf(
					/* translators: %s: the check-out date. */
					__( 'until %s', 'booking-suite' ),
					formatWpDate( stay.checkOut )
				)
			);
		}

		parts.push( overnightWindow );

		const nights = ( quote?.nightBreakdown ?? [] ).length;

		if ( nights > 0 ) {
			parts.push(
				sprintf(
					/* translators: %d: number of nights. */
					_n( '%d night', '%d nights', nights, 'booking-suite' ),
					nights
				)
			);
		}
	} else {
		if ( stay.startTime ) {
			parts.push( formatWpTime( stay.startTime ) );
		}

		const hours = quote?.duration?.bookedHours ?? 0;

		if ( hours > 0 ) {
			parts.push(
				sprintf(
					/* translators: %d: number of hours. */
					_n( '%d hour', '%d hours', hours, 'booking-suite' ),
					hours
				)
			);
		}
	}

	const guests = Number.parseInt( stay.guests, 10 ) || 0;

	if ( guests > 0 ) {
		parts.push(
			sprintf(
				/* translators: %d: number of guests. */
				_n( '%d guest', '%d guests', guests, 'booking-suite' ),
				guests
			)
		);
	}

	return (
		<div className="bks-staybar">
			<p className="bks-staybar__text">
				{ parts.filter( Boolean ).map( ( part, position ) => (
					<span
						key={ `${ position }-${ part }` }
						className="bks-staybar__part"
					>
						{ position > 0 && (
							<span
								className="bks-staybar__sep"
								aria-hidden="true"
							>
								·
							</span>
						) }
						{ part }
					</span>
				) ) }
			</p>

			{ onEdit && (
				<button
					type="button"
					className="bks-staybar__edit"
					onClick={ onEdit }
				>
					{ __( 'Change', 'booking-suite' ) }
				</button>
			) }
		</div>
	);
}
