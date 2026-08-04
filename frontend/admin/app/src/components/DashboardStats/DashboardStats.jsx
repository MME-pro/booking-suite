import { useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	ApartmentIcon,
	CheckCircleIcon,
	UsersIcon,
	ClockIcon,
	TrendingUpIcon,
} from '../icons';
import './DashboardStats.css';

export default function DashboardStats( { apartments = [] } ) {
	const stats = useMemo( () => {
		const total = apartments.length;
		const activeCount = apartments.filter( ( a ) => a.active ).length;
		const totalCapacity = apartments.reduce(
			( acc, a ) => acc + ( parseInt( a.capacity, 10 ) || 0 ),
			0
		);
		const avgCleaning =
			total > 0
				? Math.round(
						apartments.reduce(
							( acc, a ) =>
								acc + ( parseInt( a.cleaningMin, 10 ) || 0 ),
							0
						) / total
				  )
				: 0;

		const activePercentage =
			total > 0 ? Math.round( ( activeCount / total ) * 100 ) : 100;

		return {
			total,
			activeCount,
			activePercentage,
			totalCapacity,
			avgCleaning,
		};
	}, [ apartments ] );

	const cards = [
		{
			id: 'total',
			title: __( 'Total Properties', 'booking-suite' ),
			value: stats.total,
			unit: __( 'Units Registered', 'booking-suite' ),
			icon: <ApartmentIcon />,
			tone: 'brand',
			badge: sprintf( '%d total', stats.total ),
		},
		{
			id: 'active',
			title: __( 'Active Units', 'booking-suite' ),
			value: stats.activeCount,
			unit: sprintf(
				/* translators: %d: active percentage */
				__( '%d%% operational', 'booking-suite' ),
				stats.activePercentage
			),
			icon: <CheckCircleIcon />,
			tone: 'success',
			badge:
				stats.activeCount === stats.total
					? __( '100% Ready', 'booking-suite' )
					: sprintf( '%d active', stats.activeCount ),
		},
		{
			id: 'capacity',
			title: __( 'Total Capacity', 'booking-suite' ),
			value: stats.totalCapacity,
			unit: __( 'Max Guest Capacity', 'booking-suite' ),
			icon: <UsersIcon />,
			tone: 'accent',
			badge: __( 'Combined', 'booking-suite' ),
		},
		{
			id: 'cleaning',
			title: __( 'Avg Turnaround', 'booking-suite' ),
			value: stats.avgCleaning > 0 ? `${ stats.avgCleaning }m` : '0m',
			unit: __( 'Cleaning Duration', 'booking-suite' ),
			icon: <ClockIcon />,
			tone: 'warning',
			badge: __( 'Optimized', 'booking-suite' ),
		},
	];

	return (
		<div className="bks-dashboard-stats">
			{ cards.map( ( card ) => (
				<div
					key={ card.id }
					className={ `bks-stat-card bks-stat-card--${ card.tone }` }
				>
					<div className="bks-stat-card__top">
						<span className="bks-stat-card__icon">
							{ card.icon }
						</span>
						<span className="bks-stat-card__badge">
							<TrendingUpIcon className="bks-stat-card__trend-icon" />
							{ card.badge }
						</span>
					</div>
					<div className="bks-stat-card__content">
						<span className="bks-stat-card__value">
							{ card.value }
						</span>
						<span className="bks-stat-card__title">
							{ card.title }
						</span>
						<span className="bks-stat-card__unit">
							{ card.unit }
						</span>
					</div>
				</div>
			) ) }
		</div>
	);
}
