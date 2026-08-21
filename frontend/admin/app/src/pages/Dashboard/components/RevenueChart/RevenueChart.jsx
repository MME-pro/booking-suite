/**
 * Booked value per day.
 *
 * Deliberately a second chart rather than a second axis on the bookings chart:
 * counts and money are different scales, and a dual-axis chart invites false
 * correlations. One series, so no legend — the card title names it.
 */

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { __ } from '@wordpress/i18n';

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';

import { formatCompactMoney, formatDayLabel } from '../../data/format';
import { formatMoney } from '../../../Bookings/data/format';

export default function RevenueChart( { series, currency = 'EUR' } ) {
	const config = {
		revenue: {
			label: __( 'Booked value', 'booking-suite' ),
			color: '#2a78d6',
		},
	};

	const tickInterval = Math.max( 0, Math.ceil( series.length / 6 ) - 1 );

	return (
		<ChartContainer
			config={ config }
			className="aspect-auto h-[200px] w-full"
		>
			<AreaChart
				data={ series }
				margin={ { left: 4, right: 4, top: 4, bottom: 0 } }
			>
				<defs>
					<linearGradient
						id="bks-revenue"
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop
							offset="0%"
							stopColor="var(--color-revenue)"
							stopOpacity={ 0.28 }
						/>
						<stop
							offset="100%"
							stopColor="var(--color-revenue)"
							stopOpacity={ 0.02 }
						/>
					</linearGradient>
				</defs>
				<CartesianGrid vertical={ false } />
				<XAxis
					dataKey="key"
					tickLine={ false }
					axisLine={ false }
					tickMargin={ 8 }
					interval={ tickInterval }
					tickFormatter={ formatDayLabel }
				/>
				<YAxis
					width={ 52 }
					tickLine={ false }
					axisLine={ false }
					tickFormatter={ ( value ) =>
						formatCompactMoney( value, currency )
					}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={ ( value ) =>
								formatDayLabel( value, true )
							}
							formatter={ ( value ) =>
								formatMoney( value, currency )
							}
						/>
					}
				/>
				<Area
					dataKey="revenue"
					type="monotone"
					stroke="var(--color-revenue)"
					strokeWidth={ 2 }
					fill="url(#bks-revenue)"
					dot={ false }
					activeDot={ { r: 4, strokeWidth: 2 } }
				/>
			</AreaChart>
		</ChartContainer>
	);
}
