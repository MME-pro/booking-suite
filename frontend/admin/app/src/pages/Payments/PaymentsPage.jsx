/**
 * PaymentsPage — the settling side of the bookings ledger.
 *
 * Payments are created by the booking flow; this screen is where they are
 * chased and marked off. Changing one here moves the booking's own payment
 * status with it, server-side, so the two screens cannot disagree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { AlertCircle, BadgeEuro, Clock, Receipt, Wallet } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { StatCard } from '../../components/StatCard';
import { paymentService } from '../../services';
import { formatMoney } from '../Bookings/data/format';
import { PaymentViewDialog } from './components/PaymentViewDialog';
import { PaymentsTable } from './components/PaymentsTable';
import {
	ANY,
	EMPTY_FILTERS,
	PaymentsFilters,
} from './components/PaymentsFilters';

/**
 * 'Y-m-d H:i:s' UTC → the local 'YYYY-MM-DD' the date inputs speak.
 *
 * @param {string} value The stored timestamp.
 * @return {string} The local day key, or '' when unparseable.
 */
const toDayKey = ( value ) => {
	if ( ! value ) {
		return '';
	}

	const date = new Date( String( value ).replace( ' ', 'T' ) + 'Z' );

	if ( Number.isNaN( date.getTime() ) ) {
		return '';
	}

	const month = String( date.getMonth() + 1 ).padStart( 2, '0' );
	const day = String( date.getDate() ).padStart( 2, '0' );

	return `${ date.getFullYear() }-${ month }-${ day }`;
};

export default function PaymentsPage() {
	const [ payments, setPayments ] = useState( [] );
	const [ stats, setStats ] = useState( {} );
	const [ statuses, setStatuses ] = useState( [] );
	const [ methods, setMethods ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ busyId, setBusyId ] = useState( null );
	const [ viewing, setViewing ] = useState( null );

	/** What the filter bar is editing, and what the table is actually using. */
	const [ draft, setDraft ] = useState( EMPTY_FILTERS );
	const [ applied, setApplied ] = useState( EMPTY_FILTERS );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await paymentService.list( {}, signal );

			setPayments( payload.payments );
			setStats( payload.stats );
			setStatuses( payload.statuses );
			setMethods( payload.methods );
			setError( null );
		} catch ( cause ) {
			if ( 'AbortError' !== cause.name ) {
				setError( cause.message );
			}
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		const controller = new AbortController();

		load( controller.signal );

		return () => controller.abort();
	}, [ load ] );

	const visible = useMemo( () => {
		const term = applied.search.trim().toLowerCase();

		return payments.filter( ( payment ) => {
			if ( ANY !== applied.status && payment.status !== applied.status ) {
				return false;
			}

			if ( ANY !== applied.method && payment.method !== applied.method ) {
				return false;
			}

			/*
			 * The range is matched against when the money landed, falling back
			 * to when the payment was recorded — an unpaid row has no paidAt,
			 * and dropping it from every range would hide exactly the rows the
			 * operator is chasing.
			 */
			const day = toDayKey( payment.paidAt || payment.createdAt );

			if ( applied.from && day && day < applied.from ) {
				return false;
			}

			if ( applied.to && day && day > applied.to ) {
				return false;
			}

			if ( ! term ) {
				return true;
			}

			return [
				payment.bookingReference,
				payment.customerName,
				payment.customerEmail,
				payment.reference,
				payment.invoiceNo,
			]
				.filter( Boolean )
				.some( ( field ) => field.toLowerCase().includes( term ) );
		} );
	}, [ payments, applied ] );

	const setStatus = async ( payment, status ) => {
		setBusyId( payment.id );

		try {
			const updated = await paymentService.setStatus(
				payment.id,
				status
			);

			setPayments( ( current ) =>
				current.map( ( item ) =>
					item.id === updated.id ? { ...item, ...updated } : item
				)
			);
			setViewing( ( current ) =>
				current && current.id === updated.id
					? { ...current, ...updated }
					: current
			);
			setError( null );

			// The stat row is derived server-side, so it needs a fresh read.
			load();
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyId( null );
		}
	};

	const currency = payments[ 0 ]?.currency ?? 'EUR';
	const counts = stats.counts ?? {};

	const statCards = [
		{
			id: 'settled',
			title: __( 'Settled', 'booking-suite' ),
			value: formatMoney( stats.settled ?? 0, currency ),
			unit: __( 'Paid, net of refunds', 'booking-suite' ),
			Icon: BadgeEuro,
			tone: 'success',
			badge: sprintf(
				/* translators: %d: number of settled payments. */
				__( '%d paid', 'booking-suite' ),
				counts.paid ?? 0
			),
		},
		{
			id: 'awaiting',
			title: __( 'Awaiting Payment', 'booking-suite' ),
			value: formatMoney( stats.awaiting ?? 0, currency ),
			unit: __( 'Still to collect', 'booking-suite' ),
			Icon: Clock,
			tone: ( counts.pending ?? 0 ) > 0 ? 'warning' : 'success',
			badge: sprintf(
				/* translators: %d: number of pending payments. */
				__( '%d pending', 'booking-suite' ),
				counts.pending ?? 0
			),
		},
		{
			id: 'transactions',
			title: __( 'Transactions', 'booking-suite' ),
			value: stats.total ?? 0,
			unit: __( 'Recorded all time', 'booking-suite' ),
			Icon: Receipt,
			tone: 'brand',
			badge: __( 'All time', 'booking-suite' ),
		},
		{
			id: 'refunded',
			title: __( 'Refunded', 'booking-suite' ),
			value: counts.refunded ?? 0,
			unit: __( 'Sent back to guests', 'booking-suite' ),
			Icon: Wallet,
			tone: ( counts.refunded ?? 0 ) > 0 ? 'warning' : 'muted',
			badge: sprintf(
				/* translators: %d: number of failed payments. */
				__( '%d failed', 'booking-suite' ),
				counts.failed ?? 0
			),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Something went wrong', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription className="flex flex-wrap items-center gap-3">
						<span>{ error }</span>
						<Button
							size="sm"
							variant="outline"
							onClick={ () => load() }
						>
							{ __( 'Retry', 'booking-suite' ) }
						</Button>
					</AlertDescription>
				</Alert>
			) }

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{ statCards.map( ( { id, Icon, ...card } ) => (
					<StatCard key={ id } icon={ Icon } { ...card } />
				) ) }
			</div>

			<PaymentsFilters
				draft={ draft }
				onDraftChange={ setDraft }
				onApply={ () => setApplied( draft ) }
				onClear={ () => {
					setDraft( EMPTY_FILTERS );
					setApplied( EMPTY_FILTERS );
				} }
				statuses={ statuses }
				methods={ methods }
			/>

			{ isLoading ? (
				<Card>
					<CardContent className="flex flex-col gap-3 p-5">
						{ [ 0, 1, 2, 3, 4 ].map( ( key ) => (
							<Skeleton key={ key } className="h-12 w-full" />
						) ) }
					</CardContent>
				</Card>
			) : (
				<>
					<span className="px-1 text-xs text-muted-foreground">
						{ sprintf(
							/* translators: %d: number of payments shown. */
							_n(
								'%d payment',
								'%d payments',
								visible.length,
								'booking-suite'
							),
							visible.length
						) }
					</span>

					<Card className="overflow-hidden">
						<PaymentsTable
							payments={ visible }
							busyId={ busyId }
							onView={ setViewing }
							onMarkPaid={ ( payment ) =>
								setStatus( payment, 'paid' )
							}
							emptyContent={
								<EmptyPayments hasAny={ payments.length > 0 } />
							}
						/>
					</Card>
				</>
			) }

			{ viewing && (
				<PaymentViewDialog
					payment={ viewing }
					isBusy={ busyId === viewing.id }
					onClose={ () => setViewing( null ) }
					onSetStatus={ setStatus }
				/>
			) }
		</div>
	);
}

function EmptyPayments( { hasAny } ) {
	return (
		<div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
			<span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Receipt className="h-6 w-6" />
			</span>
			<h2 className="text-base font-semibold text-card-foreground">
				{ hasAny
					? __( 'No payments match your filters', 'booking-suite' )
					: __( 'No payments yet', 'booking-suite' ) }
			</h2>
			<p className="max-w-sm text-sm text-muted-foreground">
				{ hasAny
					? __(
							'Try a wider date range, or clear the filters to see everything.',
							'booking-suite'
					  )
					: __(
							'Payments appear here as bookings are taken through the site.',
							'booking-suite'
					  ) }
			</p>
		</div>
	);
}
