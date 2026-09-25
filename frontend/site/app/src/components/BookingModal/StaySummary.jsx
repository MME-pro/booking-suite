/**
 * The stay the guest chose, carried through the steps that follow.
 *
 * Once the first step is behind them, the dates and times leave the screen
 * entirely: extras, details and verification say nothing about what is being
 * booked. A guest halfway through filling in an address had no way to check
 * the night they picked without going back and losing their place.
 *
 * Written as labelled values rather than as a sentence of dot-separated
 * fragments, which is the shape the search bar already uses for the same four
 * facts — and the shape that tells a guest scanning for one of them where to
 * look. A tinted strip of running text reads as a notice the screen is giving
 * them; this reads as the booking they are making.
 *
 * Read from the stay itself rather than from the quote, so it is on screen
 * while the price is still being fetched. The length is the one part that
 * needs the quote, and it is left out until that arrives rather than holding
 * the whole row back.
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

	const cells = [];

	if ( isOvernight ) {
		cells.push( {
			label: __( 'Check-in', 'booking-suite' ),
			value: formatWpDate( startDate ),
		} );

		if ( stay.checkOut ) {
			cells.push( {
				label: __( 'Check-out', 'booking-suite' ),
				value: formatWpDate( stay.checkOut ),
			} );
		}

		const nights = ( quote?.nightBreakdown ?? [] ).length;

		cells.push( {
			label: __( 'Nights', 'booking-suite' ),
			value:
				nights > 0
					? sprintf(
							/* translators: %d: number of nights. */
							_n(
								'%d night',
								'%d nights',
								nights,
								'booking-suite'
							),
							nights
					  )
					: overnightWindow,
		} );
	} else {
		cells.push( {
			label: __( 'Date', 'booking-suite' ),
			value: formatWpDate( startDate ),
		} );

		if ( stay.startTime ) {
			cells.push( {
				label: __( 'Time', 'booking-suite' ),
				value: formatWpTime( stay.startTime ),
			} );
		}

		const hours = quote?.duration?.bookedHours ?? 0;

		if ( hours > 0 ) {
			cells.push( {
				label: __( 'Duration', 'booking-suite' ),
				value: sprintf(
					/* translators: %d: number of hours. */
					_n( '%d hour', '%d hours', hours, 'booking-suite' ),
					hours
				),
			} );
		}
	}

	const guests = Number.parseInt( stay.guests, 10 ) || 0;

	if ( guests > 0 ) {
		cells.push( {
			label: __( 'Guests', 'booking-suite' ),
			value: String( guests ),
		} );
	}

	return (
		<div className="bks-staybar">
			<dl className="bks-staybar__facts">
				{ cells
					.filter( ( cell ) => cell.value )
					.map( ( cell ) => (
						<div key={ cell.label } className="bks-staybar__fact">
							<dt className="bks-staybar__label">
								{ cell.label }
							</dt>
							<dd className="bks-staybar__value">
								{ cell.value }
							</dd>
						</div>
					) ) }
			</dl>

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
