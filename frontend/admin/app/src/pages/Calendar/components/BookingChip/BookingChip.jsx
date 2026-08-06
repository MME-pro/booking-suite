/**
 * One booking inside a calendar day cell.
 *
 * Colour identifies the apartment; the fill/border treatment carries the
 * booking status, so the two never depend on each other. The label stays in the
 * normal text colour — the coloured bar beside it is what carries identity, and
 * tinted text on a tinted background would be the thing that fails to read.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { toDate } from '../../../../lib/dates';
import { settings } from '../../../../settings';
import { formatDateTime, formatMoney } from '../../../Bookings/data/format';
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

/**
 * 24-hour clock, matching the rest of the admin.
 *
 * @param {string} value A 'Y-m-d H:i:s' UTC timestamp.
 * @return {string} The local time, or '' when unparseable.
 */
const time = ( value ) => {
	const date = toDate( value );

	if ( ! date ) {
		return '';
	}

	return new Intl.DateTimeFormat( toBcp47( settings.locale ), {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	} ).format( date );
};

const toBcp47 = ( locale ) => String( locale || 'de_DE' ).replace( '_', '-' );

/**
 * How long the stay runs.
 *
 * Overnight stays are counted in NIGHTS by calendar day, not by dividing the
 * hours: a 15:00 arrival and an 11:00 departure two days later is two nights,
 * though it is only 44 hours. Same-day stays are counted in hours, which is
 * what an hourly booking is sold in.
 *
 * @param {Object}  booking The booking.
 * @param {boolean} [short] Compact form for the cell; spelled out otherwise.
 * @return {string} The duration, or '' when the dates are unusable.
 */
const duration = ( booking, short = false ) => {
	const start = toDate( booking.startsAt );
	const end = toDate( booking.endsAt );

	if ( ! start || ! end || end <= start ) {
		return '';
	}

	const startDay = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate()
	);
	const endDay = new Date( end.getFullYear(), end.getMonth(), end.getDate() );

	const nights = Math.round( ( endDay - startDay ) / 86400000 );

	if ( nights > 0 ) {
		return short
			? sprintf(
					/* translators: %d: number of nights, compact form. */
					__( '%dN', 'booking-suite' ),
					nights
			  )
			: sprintf(
					/* translators: %d: number of nights. */
					_n( '%d night', '%d nights', nights, 'booking-suite' ),
					nights
			  );
	}

	// Trailing .0 helps nobody; 6.5 hours does.
	const hours = Math.round( ( ( end - start ) / 3600000 ) * 10 ) / 10;

	return short
		? sprintf(
				/* translators: %s: number of hours, compact form. */
				__( '%sh', 'booking-suite' ),
				hours
		  )
		: sprintf(
				/* translators: %s: number of hours. */
				__( '%s hours', 'booking-suite' ),
				hours
		  );
};

/**
 * Everything about the booking, for the hover tooltip.
 *
 * The cell can only carry two lines; the rest lives here rather than being
 * dropped, so a booking can be identified without leaving the month.
 *
 * @param {Object} booking The booking.
 * @return {string} A plain-text summary.
 */
const summary = ( booking ) =>
	[
		booking.reference || `#${ booking.id }`,
		booking.customerName,
		booking.apartmentName,
		`${ formatDateTime( booking.startsAt ) } → ${ formatDateTime(
			booking.endsAt
		) }`,
		duration( booking ),
		sprintf(
			/* translators: %d: number of guests. */
			_n( '%d guest', '%d guests', booking.guests || 1, 'booking-suite' ),
			booking.guests || 1
		),
		formatMoney( booking.total, booking.currency ),
		`${ booking.status } · ${ booking.paymentStatus }`,
	]
		.filter( Boolean )
		.join( '\n' );

export default function BookingChip( { booking, role, colour, onSelect } ) {
	const sign = marker( role );

	/*
	 * The chip lives inside the day's own button, so its click has to be
	 * stopped from reaching it — otherwise opening a booking would also
	 * re-select the day underneath. role/tabIndex rather than a nested
	 * <button>, which HTML does not allow inside another button.
	 */
	const open = ( event ) => {
		event.stopPropagation();
		onSelect?.( booking );
	};

	/*
	 * Which time matters depends on the day: an arrival is about check-in, a
	 * departure about check-out, and a guest mid-stay about neither.
	 */
	const stamps = {
		[ ARRIVAL ]: booking.startsAt,
		[ DEPARTURE ]: booking.endsAt,
	};

	const stamp = stamps[ role ] ? time( stamps[ role ] ) : '';

	/** Compact in the cell; the tooltip spells it out. */
	const stay = duration( booking, true );

	return (
		<span
			title={ summary( booking ) }
			role={ onSelect ? 'button' : undefined }
			tabIndex={ onSelect ? 0 : undefined }
			onClick={ onSelect ? open : undefined }
			onKeyDown={
				onSelect
					? ( event ) => {
							if ( 'Enter' === event.key || ' ' === event.key ) {
								event.preventDefault();
								open( event );
							}
					  }
					: undefined
			}
			className={ cn(
				'flex w-full flex-col gap-0.5 rounded-sm py-0.5 pl-1.5 pr-1 text-left text-[11px] leading-tight text-card-foreground',
				onSelect &&
					'cursor-pointer transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
			) }
			style={ chipStyle( booking.status, colour ) }
		>
			<span className="flex items-center gap-1 truncate">
				{ sign && (
					<span
						aria-hidden="true"
						className="shrink-0 font-semibold text-muted-foreground"
					>
						{ sign }
					</span>
				) }
				<span className="truncate font-medium">
					{ booking.customerName || __( 'Guest', 'booking-suite' ) }
				</span>
				{ stamp && (
					<span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
						{ stamp }
					</span>
				) }
			</span>

			{ /* Second line: which apartment, how long, and what it is worth. */ }
			<span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
				<span className="truncate">{ booking.apartmentName }</span>

				{ stay && (
					<span className="shrink-0 rounded-sm bg-card/70 px-1 font-medium tabular-nums">
						{ stay }
					</span>
				) }

				<span className="ml-auto shrink-0 tabular-nums">
					{ formatMoney( booking.total, booking.currency ) }
				</span>
			</span>
		</span>
	);
}
