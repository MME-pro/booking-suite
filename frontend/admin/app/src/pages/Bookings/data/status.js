/**
 * Presentation helpers shared by the two shapes the bookings list takes.
 *
 * The same rows are drawn as a table on a wide screen and as cards on a narrow
 * one. Both need the same colours, the same wording and the same idea of which
 * actions apply, so those live here rather than being written twice and drifting
 * apart the first time a status is added.
 */

import { __ } from '@wordpress/i18n';

/**
 * Status colours.
 *
 * shadcn's Badge ships four variants; the booking lifecycle needs its own, so
 * these map onto the Booking Suite tokens instead of editing the upstream
 * component, which would be overwritten by the next `shadcn add`.
 */
export const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	reserved: 'bg-primary/10 text-primary hover:bg-primary/10',
	confirmed: 'bg-success/10 text-success hover:bg-success/10',
	completed: 'bg-muted text-muted-foreground hover:bg-muted',
	cancelled: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
};

export const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

/**
 * What each stored status is called on screen.
 *
 * Written out rather than derived from the stored value. Turning
 * `awaiting_transfer` into "awaiting transfer" produced something readable in
 * English and nothing at all in any other language — the status filters came
 * out in English on a German site, because a machine value with its
 * underscores removed is still a machine value.
 *
 * The keys are every status the server may send, including the two retired
 * ones that older rows still carry.
 */
const STATUS_LABELS = {
	awaiting_transfer: __( 'Awaiting transfer', 'booking-suite' ),
	transfer_declared: __( 'Transfer declared', 'booking-suite' ),
	payment_overdue: __( 'Payment overdue', 'booking-suite' ),
	confirmed: __( 'Confirmed', 'booking-suite' ),
	completed: __( 'Completed', 'booking-suite' ),
	cancelled: __( 'Cancelled', 'booking-suite' ),
	lapsed: __( 'Lapsed', 'booking-suite' ),
	// Retired names, still on older rows.
	pending: __( 'Pending', 'booking-suite' ),
	reserved: __( 'Reserved', 'booking-suite' ),
};

const PAYMENT_LABELS = {
	unpaid: __( 'Unpaid', 'booking-suite' ),
	partial: __( 'Part paid', 'booking-suite' ),
	paid: __( 'Paid', 'booking-suite' ),
	overpaid: __( 'Overpaid', 'booking-suite' ),
	refunded: __( 'Refunded', 'booking-suite' ),
	void: __( 'Written off', 'booking-suite' ),
};

/**
 * A stored status as a human label.
 *
 * Falls back to the old underscore-stripping for anything not listed above, so
 * a status added on the server reads tolerably here before this file catches
 * up rather than rendering as an empty tab.
 *
 * @param {string} value The stored value.
 * @return {string} The label.
 */
export const label = ( value ) => {
	const key = String( value || '' );

	return (
		STATUS_LABELS[ key ] ??
		PAYMENT_LABELS[ key ] ??
		key.replace( /_/g, ' ' )
	);
};

/**
 * Up to two initials for the avatar, falling back to "G" for Guest.
 *
 * @param {string} name The guest's name.
 * @return {string} The initials.
 */
export const initialsOf = ( name ) =>
	( name || 'G' )
		.split( ' ' )
		.filter( Boolean )
		.map( ( part ) => part[ 0 ] )
		.join( '' )
		.toUpperCase()
		.slice( 0, 2 );

/**
 * A booking is approvable while it is still waiting on the owner.
 *
 * @param {Object} booking The booking row.
 * @return {boolean} Whether Approve applies.
 */
export const canApprove = ( booking ) =>
	[ 'pending', 'reserved' ].includes( booking.status );
