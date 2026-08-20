/**
 * Presentation helpers for the payments ledger.
 *
 * The same rows are drawn as a table on a wide screen and as cards on a narrow
 * one, so the colours and the wording live here rather than being written twice
 * and drifting apart the first time a status is added.
 *
 * These are payment statuses, not booking statuses — the two sets overlap in
 * name only. A booking is pending/reserved/confirmed/completed; a payment is
 * pending/paid/failed/refunded, and `failed` is the one that has to shout.
 */

export const PAYMENT_STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	failed: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

/**
 * A stored value as a human label: 'bank_transfer' reads as two words.
 *
 * @param {string} value The stored value.
 * @return {string} The label.
 */
export const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );
