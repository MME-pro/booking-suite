/**
 * One availability lock inside a calendar day cell.
 *
 * A lock has to be tellable from a booking at a glance, because they mean
 * opposite things to the operator: a booking is money and a guest arriving, a
 * lock is simply dates that are not for sale. Bookings are solid chips; a lock
 * is drawn with a diagonal hatch and no money on it, so the two never read as
 * the same object even when they sit in the same cell.
 *
 * The apartment's colour still carries identity, exactly as it does on a
 * booking chip — so a lock on the Studio is recognisably the Studio's.
 *
 * The label says where the lock came from. "Booking.com · Not available" tells
 * the operator this is the portal's doing and has to be changed at the portal;
 * a lock made here says so instead, and can be released on the Availability
 * screen. Getting that wrong means editing the wrong calendar.
 */

import { __ } from '@wordpress/i18n';
import { Ban, Globe } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Matches BlocksRepository::SOURCE_MANUAL. */
const MANUAL = 'manual';

/**
 * Whether a lock came from a portal calendar rather than from this admin.
 *
 * The Calendar screen shows only the imported ones — a lock made here is
 * already visible on Availability, where it can also be released, and repeating
 * it on the month view added noise without adding anything to act on.
 *
 * @param {Object} block A lock from the REST layer.
 * @return {boolean} True when a calendar import wrote it.
 */
export const isImported = ( block ) => MANUAL !== ( block?.source || MANUAL );

/**
 * Portal names, keyed as IcalParser::SOURCES writes them.
 *
 * Kept here rather than read from the API because a lock row carries only its
 * source key, and the month grid should not have to fetch a lookup table to
 * label a chip.
 */
const SOURCES = {
	airbnb: 'Airbnb',
	booking: 'Booking.com',
	vrbo: 'Vrbo',
	expedia: 'Expedia',
	tripadvisor: 'Tripadvisor',
	google: __( 'Google Calendar', 'booking-suite' ),
	other: __( 'Calendar', 'booking-suite' ),
};

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
 * The hatch that marks a chip as a lock rather than a booking.
 *
 * A repeating-linear-gradient rather than an image, so it scales with the cell
 * and needs nothing loaded. The stripes are the apartment's own colour at low
 * opacity, which keeps identity and "this is a lock" on the same swatch.
 *
 * @param {string} colour The apartment's colour.
 * @return {Object} Inline styles for the chip.
 */
export const lockStyle = ( colour ) => ( {
	borderLeftWidth: '3px',
	borderLeftStyle: 'dotted',
	borderLeftColor: colour,
	backgroundColor: tint( colour, 0.05 ),
	backgroundImage: `repeating-linear-gradient(135deg, ${ tint(
		colour,
		0.16
	) } 0 4px, transparent 4px 8px)`,
} );

/**
 * What to call the lock's origin.
 *
 * @param {Object} block The lock.
 * @return {string} A short label.
 */
export const originLabel = ( block ) => {
	const source = String( block.source || MANUAL );

	if ( MANUAL === source ) {
		return __( 'Blocked here', 'booking-suite' );
	}

	return SOURCES[ source ] ?? SOURCES.other;
};

/**
 * Everything about the lock, for the hover tooltip.
 *
 * @param {Object} block The lock.
 * @return {string} A plain-text summary.
 */
const summary = ( block ) =>
	[
		block.isMaster
			? __( 'All apartments', 'booking-suite' )
			: block.apartmentName,
		`${ block.startsAt } → ${ block.endsAt }`,
		block.reason,
		originLabel( block ),
		MANUAL === ( block.source || MANUAL )
			? __( 'Release it on the Availability screen.', 'booking-suite' )
			: __(
					'Imported from a portal calendar. Change it at the portal — the next sync follows.',
					'booking-suite'
			  ),
	]
		.filter( Boolean )
		.join( '\n' );

export default function LockChip( { block, colour } ) {
	const Icon = isImported( block ) ? Globe : Ban;

	return (
		<span
			title={ summary( block ) }
			className={ cn(
				'flex w-full flex-col gap-0.5 rounded-sm py-0.5 pl-1.5 pr-1 text-left text-[11px] leading-tight text-card-foreground'
			) }
			style={ lockStyle( colour ) }
		>
			<span className="flex items-center gap-1 truncate">
				<Icon
					aria-hidden="true"
					className="h-3 w-3 shrink-0 text-muted-foreground"
				/>
				<span className="truncate font-medium">
					{ originLabel( block ) }
				</span>
			</span>

			{ /*
			 * Second line: which apartment, and the portal's own wording for
			 * why. "Reserved" and "CLOSED - Not available" are different facts —
			 * one is a guest, the other is the host closing the dates — and only
			 * the portal knows which, so its words are kept rather than
			 * flattened into "blocked".
			 */ }
			<span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
				<span className="truncate">
					{ block.isMaster
						? __( 'All apartments', 'booking-suite' )
						: block.apartmentName }
				</span>

				{ block.reason && (
					<span className="ml-auto shrink-0 truncate rounded-sm bg-card/70 px-1 font-medium">
						{ block.reason }
					</span>
				) }
			</span>
		</span>
	);
}
