/**
 * Dashboard KPI row, built on shadcn/ui.
 *
 * Six headline numbers covering the booking operation and the estate behind it.
 * All derivations live in ../../data/metrics.js — this component only presents.
 */

import { __, sprintf } from '@wordpress/i18n';
import {
	Building2,
	CalendarCheck,
	CalendarPlus,
	Clock,
	Euro,
	Wallet,
} from 'lucide-react';

import { StatCard } from '../../../../components/StatCard';

// Shared with the Bookings screen so money reads identically across the admin.
import { formatMoney } from '../../../Bookings/data/format';
import { can } from '../../../../settings';

export default function StatGrid( { metrics } ) {
	const {
		bookingsToday,
		pending,
		totalBookings,
		revenue,
		outstanding,
		upcomingCheckIns,
		currency,
		apartments,
		activeApartments,
	} = metrics;

	const cards = [
		{
			id: 'today',
			title: __( 'Bookings today', 'booking-suite' ),
			value: bookingsToday,
			unit: __( 'Taken in the last 24 hours', 'booking-suite' ),
			Icon: CalendarPlus,
			tone: 'brand',
			badge: sprintf(
				/* translators: %d: total number of bookings */
				__( '%d all time', 'booking-suite' ),
				totalBookings
			),
		},
		{
			id: 'pending',
			title: __( 'Pending bookings', 'booking-suite' ),
			value: pending,
			unit: __( 'Waiting on confirmation', 'booking-suite' ),
			Icon: Clock,
			tone: 'warning',
			badge: pending
				? __( 'Needs action', 'booking-suite' )
				: __( 'All clear', 'booking-suite' ),
		},
		{
			id: 'revenue',
			title: __( 'Total amount', 'booking-suite' ),
			value: formatMoney( revenue, currency ),
			unit: __( 'Booked value, refunds excluded', 'booking-suite' ),
			Icon: Euro,
			tone: 'success',
			badge: __( 'Gross', 'booking-suite' ),
		},
		{
			id: 'outstanding',
			title: __( 'Outstanding', 'booking-suite' ),
			value: formatMoney( outstanding, currency ),
			unit: __( 'Unpaid and part-paid bookings', 'booking-suite' ),
			Icon: Wallet,
			tone: outstanding > 0 ? 'warning' : 'success',
			badge:
				outstanding > 0
					? __( 'To collect', 'booking-suite' )
					: __( 'Settled', 'booking-suite' ),
		},
		{
			id: 'checkins',
			title: __( 'Check-ins this week', 'booking-suite' ),
			value: upcomingCheckIns,
			unit: __( 'Arriving in the next 7 days', 'booking-suite' ),
			Icon: CalendarCheck,
			tone: 'accent',
			badge: __( 'Upcoming', 'booking-suite' ),
		},
		{
			id: 'apartments',
			title: __( 'Apartments', 'booking-suite' ),
			value: apartments,
			unit: sprintf(
				/* translators: %d: number of active apartments */
				__( '%d active', 'booking-suite' ),
				activeApartments
			),
			Icon: Building2,
			tone: 'brand',
			badge:
				apartments === activeApartments
					? __( 'All bookable', 'booking-suite' )
					: __( 'Partly offline', 'booking-suite' ),
		},
	];

	/*
	 * The two money cards are totals across every booking, which is a
	 * different question from what any one guest owes. The desk needs the
	 * second to do its job and has no business with the first.
	 *
	 * The rows these are summed from are legitimately on the desk's screen, so
	 * this is a decision about what to put in front of someone rather than a
	 * secret being kept — the figures the server genuinely withholds are
	 * withheld in the response, not here.
	 */
	const shown = can( 'viewFinancials' )
		? cards
		: cards.filter(
				( card ) => 'revenue' !== card.id && 'outstanding' !== card.id
		  );

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{ shown.map( ( { id, Icon, ...card } ) => (
				<StatCard key={ id } icon={ Icon } { ...card } />
			) ) }
		</div>
	);
}
