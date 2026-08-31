/**
 * Bookings per day, stacked by status.
 *
 * Colour notes — the four status hues are a validated categorical set (checked
 * against the white card surface for lightness band, chroma, colour-blind
 * separation and normal-vision separation). Two of them sit below 3:1 contrast
 * on white, which obliges "relief": the legend below carries a visible count per
 * status, so identity never rests on colour alone. Keep the slot order if you
 * swap hues — adjacency is what the separation check measures.
 */

import { __ } from '@wordpress/i18n';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';

import { STATUS_ORDER, statusTotals } from '../../data/metrics';
import { formatDayLabel } from '../../data/format';

const CHART_CONFIG = {
	pending: { label: __( 'Pending', 'booking-suite' ), color: '#eda100' },
	reserved: { label: __( 'Reserved', 'booking-suite' ), color: '#2a78d6' },
	confirmed: { label: __( 'Confirmed', 'booking-suite' ), color: '#1baf7a' },
	completed: { label: __( 'Completed', 'booking-suite' ), color: '#4a3aa7' },
	cancelled: { label: __( 'Cancelled', 'booking-suite' ), color: '#b3261e' },
};

export default function BookingsChart( { series } ) {
	const totals = statusTotals( series );
	const grandTotal = STATUS_ORDER.reduce(
		( acc, status ) => acc + totals[ status ],
		0
	);

	// Roughly six ticks, whatever the window length, so labels never collide.
	const tickInterval = Math.max( 0, Math.ceil( series.length / 6 ) - 1 );

	return (
		<div className="flex flex-col gap-4">
			<ChartContainer
				config={ CHART_CONFIG }
				className="aspect-auto h-[200px] w-full"
			>
				<BarChart
					data={ series }
					margin={ { left: 4, right: 4, top: 4, bottom: 0 } }
				>
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
						width={ 28 }
						tickLine={ false }
						axisLine={ false }
						allowDecimals={ false }
					/>
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={ ( value ) =>
									formatDayLabel( value, true )
								}
							/>
						}
					/>
					{ STATUS_ORDER.map( ( status, index ) => (
						<Bar
							key={ status }
							dataKey={ status }
							stackId="bookings"
							fill={ `var(--color-${ status })` }
							/*
							 * A 2px stroke in the surface colour reads as the
							 * gap between stacked segments — recharts has no
							 * native spacer.
							 */
							stroke="hsl(var(--card))"
							strokeWidth={ 2 }
							radius={
								index === STATUS_ORDER.length - 1
									? [ 4, 4, 0, 0 ]
									: 0
							}
						/>
					) ) }
				</BarChart>
			</ChartContainer>

			{ /*
			 * Legend doubles as the relief for the two low-contrast hues: the
			 * count is spelled out, so the chart is readable without them.
			 */ }
			<ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
				{ STATUS_ORDER.map( ( status ) => (
					<li
						key={ status }
						className="flex items-center gap-2 text-xs"
					>
						<span
							aria-hidden="true"
							className="h-2.5 w-2.5 shrink-0 rounded-sm"
							style={ {
								backgroundColor: CHART_CONFIG[ status ].color,
							} }
						/>
						<span className="text-muted-foreground">
							{ CHART_CONFIG[ status ].label }
						</span>
						<span className="font-medium tabular-nums text-card-foreground">
							{ totals[ status ] }
						</span>
					</li>
				) ) }
				<li className="ml-auto text-xs text-muted-foreground">
					{ __( 'Total', 'booking-suite' ) }{ ' ' }
					<span className="font-medium tabular-nums text-card-foreground">
						{ grandTotal }
					</span>
				</li>
			</ul>
		</div>
	);
}
