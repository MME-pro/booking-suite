/**
 * One booking inside a calendar day cell.
 *
 * Colour identifies the apartment; the fill/border treatment carries the
 * booking status, so the two never depend on each other. The label stays in the
 * normal text colour — the coloured bar beside it is what carries identity, and
 * tinted text on a tinted background would be the thing that fails to read.
 */

import { __ } from '@wordpress/i18n';

import { ARRIVAL, DEPARTURE } from '../../data/occupancy';

/**
 * Hex + alpha, guarding against the 3-digit form the colour column allows.
 *
 * @param {string} colour A '#rrggbb' colour.
 * @param {number} alpha  Opacity, 0–1.
 * @return {string} The colour with an alpha channel appended.
 */
const tint = ( colour, alpha ) => {
	if ( 7 !== colour?.length ) {
		return 'transparent';
	}

	const hex = Math.round( alpha * 255 )
		.toString( 16 )
		.padStart( 2, '0' );

	return `${ colour }${ hex }`;
};

/**
 * @param {string} status The booking status.
 * @param {string} colour The apartment's colour.
 * @return {Object} Inline styles for the chip.
 */
export const chipStyle = ( status, colour ) => {
	const base = {
		borderLeftWidth: '3px',
		borderLeftStyle: 'solid',
		borderLeftColor: colour,
	};

	if ( 'pending' === status ) {
		// Nothing is held yet, so the chip is barely filled and dashed.
		return {
			...base,
			borderLeftStyle: 'dashed',
			backgroundColor: tint( colour, 0.06 ),
		};
	}

	if ( 'completed' === status ) {
		return {
			...base,
			backgroundColor: tint( colour, 0.08 ),
			opacity: 0.65,
		};
	}

	if ( 'reserved' === status ) {
		return { ...base, backgroundColor: tint( colour, 0.1 ) };
	}

	return { ...base, backgroundColor: tint( colour, 0.16 ) };
};

/**
 * Arrivals and departures are the two the operator has to act on.
 *
 * @param {string} role The booking's relationship to the day.
 * @return {string|null} A direction marker, or null when simply in residence.
 */
const marker = ( role ) => {
	if ( ARRIVAL === role ) {
		return '→';
	}

	if ( DEPARTURE === role ) {
		return '←';
	}

	return null;
};

export default function BookingChip( { booking, role, colour } ) {
	const sign = marker( role );

	return (
		<span
			className="flex w-full items-center gap-1 truncate rounded-sm py-0.5 pl-1.5 pr-1 text-left text-[11px] leading-tight text-card-foreground"
			style={ chipStyle( booking.status, colour ) }
		>
			{ sign && (
				<span
					aria-hidden="true"
					className="shrink-0 font-semibold text-muted-foreground"
				>
					{ sign }
				</span>
			) }
			<span className="truncate">
				{ booking.customerName || __( 'Guest', 'booking-suite' ) }
			</span>
		</span>
	);
}
