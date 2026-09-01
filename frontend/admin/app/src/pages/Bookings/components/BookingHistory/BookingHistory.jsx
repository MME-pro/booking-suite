/**
 * What has happened to one booking, in order.
 *
 * Every other panel on this screen says what the booking IS. This one says what
 * it WAS, which is the question that actually gets asked: the guest was quoted
 * €240 and the booking now says €300, and somebody has to be able to say when
 * that changed and who changed it. Until the history table existed the answer
 * was nowhere — an update overwrote the columns and the old values were gone.
 *
 * Read newest first, the way a log is read. Each entry names the actor, because
 * "the price changed" and "Nicole changed the price" are different facts, and
 * only one of them settles an argument.
 */

import { __, sprintf } from '@wordpress/i18n';
import {
	ArrowRight,
	CalendarPlus,
	FileText,
	Mail,
	PencilLine,
	Receipt,
	Wallet,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatDateTime, formatMoney } from '../../data/format';
import { label } from '../../data/status';

/** Matches BookingEventsTable's event constants. */
const EVENTS = {
	created: {
		icon: CalendarPlus,
		title: __( 'Booking created', 'booking-suite' ),
	},
	updated: {
		icon: PencilLine,
		title: __( 'Booking changed', 'booking-suite' ),
	},
	payment_recorded: {
		icon: Wallet,
		title: __( 'Payment recorded', 'booking-suite' ),
	},
	payment_amended: {
		icon: Receipt,
		title: __( 'Payment amount changed', 'booking-suite' ),
	},
	payment_status: {
		icon: Wallet,
		title: __( 'Payment status changed', 'booking-suite' ),
	},
	invoice_issued: {
		icon: FileText,
		title: __( 'Invoice issued', 'booking-suite' ),
	},
	email_sent: {
		icon: Mail,
		title: __( 'Email sent to the guest', 'booking-suite' ),
	},
};

/** What each recorded field is called on screen. */
const FIELDS = {
	room_id: __( 'Apartment', 'booking-suite' ),
	customer_id: __( 'Guest', 'booking-suite' ),
	status: __( 'Status', 'booking-suite' ),
	payment_status: __( 'Payment', 'booking-suite' ),
	guests: __( 'Guests', 'booking-suite' ),
	starts_at: __( 'Arrival', 'booking-suite' ),
	ends_at: __( 'Departure', 'booking-suite' ),
	total_amount: __( 'Total', 'booking-suite' ),
	notes: __( 'Notes', 'booking-suite' ),
	amount: __( 'Amount', 'booking-suite' ),
	template: __( 'Template', 'booking-suite' ),
	delivery: __( 'Delivery', 'booking-suite' ),
};

/** Fields whose stored value is a UTC timestamp. */
const TIMES = [ 'starts_at', 'ends_at' ];

/** Fields whose stored value is money. */
const MONEY = [ 'total_amount', 'amount' ];

/**
 * One side of a change, in the form it should be read in.
 *
 * The server resolves the ids it can — an apartment or a guest arrives with a
 * name beside it — and everything else is formatted here, where the locale and
 * the currency already are.
 *
 * @param {string} field    The field that changed.
 * @param {Object} change   The recorded { from, to, fromLabel?, toLabel? }.
 * @param {string} sideKey  'from' or 'to'.
 * @param {string} currency The booking's currency.
 * @return {string} The value as text.
 */
const side = ( field, change, sideKey, currency ) => {
	const resolved = change[ `${ sideKey }Label` ];
	const raw = resolved ?? change[ sideKey ] ?? '';

	if ( '' === String( raw ) ) {
		// An empty side means the field had no value before — a payment being
		// recorded for the first time, say. A dash reads better than a gap.
		return '—';
	}

	if ( TIMES.includes( field ) ) {
		return formatDateTime( String( raw ) );
	}

	if ( MONEY.includes( field ) ) {
		return formatMoney( Number( raw ), currency );
	}

	if ( [ 'status', 'payment_status', 'delivery' ].includes( field ) ) {
		return label( String( raw ) );
	}

	return String( raw );
};

/**
 * Notes are free text and can run to paragraphs; a log entry cannot.
 *
 * @param {string} value The text.
 * @return {string} At most a line of it.
 */
const clip = ( value ) =>
	value.length > 80 ? `${ value.slice( 0, 80 ).trimEnd() }…` : value;

export default function BookingHistory( { history = [], currency = 'EUR' } ) {
	if ( 0 === history.length ) {
		return null;
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">
					{ __( 'History', 'booking-suite' ) }
				</CardTitle>
			</CardHeader>

			<CardContent>
				<ol className="flex flex-col">
					{ history.map( ( entry, index ) => {
						const meta = EVENTS[ entry.event ] ?? EVENTS.updated;
						const Icon = meta.icon;
						const changes = Object.entries( entry.changes ?? {} );
						const isLast = index === history.length - 1;

						return (
							<li key={ entry.id } className="flex gap-3">
								{ /*
								 * The rail: a marker per entry joined by a line
								 * that stops at the last one, so the column
								 * does not trail off under nothing.
								 */ }
								<div className="flex flex-col items-center">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
										<Icon className="h-3.5 w-3.5" />
									</span>
									{ ! isLast && (
										<span
											aria-hidden="true"
											className="w-px flex-1 bg-border"
										/>
									) }
								</div>

								<div
									className={ `flex flex-col gap-1 ${
										isLast ? 'pb-0' : 'pb-5'
									}` }
								>
									<span className="text-sm font-medium text-card-foreground">
										{ meta.title }
									</span>

									{ changes.length > 0 && (
										<ul className="flex flex-col gap-0.5">
											{ changes.map(
												( [ field, change ] ) => (
													<li
														key={ field }
														className="flex flex-wrap items-center gap-1.5 text-xs"
													>
														<span className="text-muted-foreground">
															{ FIELDS[ field ] ??
																field }
														</span>

														<span className="text-muted-foreground line-through">
															{ clip(
																side(
																	field,
																	change,
																	'from',
																	currency
																)
															) }
														</span>

														<ArrowRight
															aria-hidden="true"
															className="h-3 w-3 shrink-0 text-muted-foreground"
														/>

														<span className="font-medium text-card-foreground">
															{ clip(
																side(
																	field,
																	change,
																	'to',
																	currency
																)
															) }
														</span>
													</li>
												)
											) }
										</ul>
									) }

									{ entry.note && (
										<p className="text-xs text-muted-foreground">
											{ clip( entry.note ) }
										</p>
									) }

									<p className="text-xs text-muted-foreground">
										{ sprintf(
											/* translators: 1: who made the change, 2: when. */
											__(
												'%1$s · %2$s',
												'booking-suite'
											),
											entry.actorName ||
												__( 'System', 'booking-suite' ),
											formatDateTime( entry.createdAt )
										) }
									</p>
								</div>
							</li>
						);
					} ) }
				</ol>
			</CardContent>
		</Card>
	);
}
