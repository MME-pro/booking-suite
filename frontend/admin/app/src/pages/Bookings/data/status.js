/**
 * Presentation helpers shared by the two shapes the bookings list takes.
 *
 * The same rows are drawn as a table on a wide screen and as cards on a narrow
 * one. Both need the same colours, the same wording and the same idea of which
 * actions apply, so those live here rather than being written twice and drifting
 * apart the first time a status is added.
 */

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
 * A stored status as a human label: 'payment_pending' reads as two words.
 *
 * @param {string} value The stored value.
 * @return {string} The label.
 */
export const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

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
