/**
 * PriceBreakdown — what the booking costs, and why.
 *
 * An operator agreeing a price on the phone needs to see the parts, not just
 * the sum: which rate applied, how the hours were billed, what the extra
 * guests added. When the price is set by hand it still shows the calculated
 * figure alongside, so the difference between the two is visible.
 */

import { __, sprintf } from '@wordpress/i18n';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '../../data/format';

/**
 * @param {Object}  props
 * @param {Object}  props.quote     The server's breakdown, or null.
 * @param {boolean} props.isLoading Whether a fresh quote is on its way.
 * @param {boolean} props.isManual  Whether the operator has set the price.
 * @param {number}  props.manual    The hand-entered total.
 */
export default function PriceBreakdown( {
	quote,
	isLoading,
	isManual,
	manual,
} ) {
	if ( ! quote ) {
		return (
			<div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
				{ isLoading ? (
					<>
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-5 w-24" />
					</>
				) : (
					<p className="text-sm text-muted-foreground">
						{ __(
							'Choose an apartment, a date and a time to see the price.',
							'booking-suite'
						) }
					</p>
				) }
			</div>
		);
	}

	const currency = quote.currency ?? 'EUR';
	const duration = quote.duration ?? {};
	const guestCharge = quote.guestCharge ?? {};

	const lines = [];

	if ( 'hourly' === quote.mode ) {
		lines.push( {
			key: 'base',
			label: sprintf(
				/* translators: %d: hours the base rate covers. */
				__( 'Base rate — first %d h', 'booking-suite' ),
				duration.baseHours ?? 0
			),
			value: duration.baseRate ?? 0,
		} );

		if ( duration.extraHours > 0 ) {
			lines.push( {
				key: 'extra-hours',
				label: sprintf(
					/* translators: 1: extra hours, 2: price per hour. */
					__( '%1$d further h at %2$s', 'booking-suite' ),
					duration.extraHours,
					formatMoney( duration.hourlySurcharge ?? 0, currency )
				),
				value: duration.extraTotal ?? 0,
			} );
		}

		// The billing breaks can make a longer booking cost less than the hours
		// suggest; saying so stops it reading as an error.
		if ( duration.discount > 0 ) {
			lines.push( {
				key: 'discount',
				label: sprintf(
					/* translators: 1: hours booked, 2: hours charged. */
					__( '%1$d h booked, %2$d h charged', 'booking-suite' ),
					duration.bookedHours ?? 0,
					duration.billableHours ?? 0
				),
				value: -duration.discount,
				muted: true,
			} );
		}
	} else {
		lines.push( {
			key: 'nights',
			label: sprintf(
				/* translators: %d: number of nights. */
				__( '%d nights', 'booking-suite' ),
				quote.nights ?? 0
			),
			value: quote.accommodation ?? 0,
		} );
	}

	if ( guestCharge.extraGuests > 0 ) {
		lines.push( {
			key: 'guests',
			label: sprintf(
				/* translators: 1: extra guests, 2: price per guest. */
				__( '%1$d extra guests at %2$s', 'booking-suite' ),
				guestCharge.extraGuests,
				formatMoney( guestCharge.perGuest ?? 0, currency )
			),
			value: guestCharge.total ?? 0,
		} );
	}

	const calculated = quote.total ?? 0;
	const charged = isManual ? manual : calculated;

	return (
		<div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{ __( 'Price breakdown', 'booking-suite' ) }
				</span>
				{ isLoading && (
					<Loader2
						className="h-3.5 w-3.5 animate-spin text-muted-foreground"
						aria-hidden="true"
					/>
				) }
			</div>

			{ false === quote.available && (
				<p className="flex items-start gap-2 text-sm text-destructive">
					<AlertTriangle
						className="mt-0.5 h-4 w-4 shrink-0"
						aria-hidden="true"
					/>
					{ __(
						'This apartment is already taken for that window.',
						'booking-suite'
					) }
				</p>
			) }

			<dl className="flex flex-col gap-1.5 text-sm">
				{ lines.map( ( line ) => (
					<div
						key={ line.key }
						className="flex items-baseline justify-between gap-4"
					>
						<dt
							className={
								line.muted ? 'text-muted-foreground' : undefined
							}
						>
							{ line.label }
						</dt>
						<dd className="font-medium tabular-nums">
							{ formatMoney( line.value, currency ) }
						</dd>
					</div>
				) ) }
			</dl>

			<div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
				<span className="text-sm font-semibold">
					{ isManual
						? __( 'Agreed total', 'booking-suite' )
						: __( 'Total', 'booking-suite' ) }
				</span>
				<span className="text-base font-semibold tabular-nums">
					{ formatMoney( charged, currency ) }
				</span>
			</div>

			{ /* With a hand-set price, what it would otherwise have been. */ }
			{ isManual && (
				<p className="text-xs text-muted-foreground">
					{ sprintf(
						/* translators: %s: the calculated price. */
						__( 'Calculated price: %s', 'booking-suite' ),
						formatMoney( calculated, currency )
					) }
				</p>
			) }

			{ false === quote.priced && (
				<p className="text-xs text-muted-foreground">
					{ __(
						'This apartment has no rates set, so the price is provisional.',
						'booking-suite'
					) }
				</p>
			) }
		</div>
	);
}
