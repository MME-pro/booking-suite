/**
 * The four charts on the report.
 *
 * Colour notes — the status hues are a validated categorical set (checked
 * against the white card surface for lightness band, chroma, colour-blind
 * separation and normal-vision separation). Two sit below 3:1 contrast on
 * white, which obliges "relief": every chart here carries either a legend with
 * counts or a table saying the same thing further down the page, so nothing
 * rests on colour alone. Keep the slot order if you swap hues — adjacency is
 * what the separation check measures.
 */

import { __ } from '@wordpress/i18n';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from 'recharts';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';

import { formatMoney } from '../../../Bookings/data/format';

export const STATUS_COLOURS = {
	pending: '#eda100',
	reserved: '#2a78d6',
	confirmed: '#1baf7a',
	completed: '#4a3aa7',
	cancelled: '#b3261e',
};

const STATUS_LABELS = {
	pending: __( 'Pending', 'booking-suite' ),
	reserved: __( 'Reserved', 'booking-suite' ),
	confirmed: __( 'Confirmed', 'booking-suite' ),
	completed: __( 'Completed', 'booking-suite' ),
	cancelled: __( 'Cancelled', 'booking-suite' ),
};

/**
 * Roughly six ticks whatever the window, so labels never collide.
 *
 * @param {number} length How many buckets the series has.
 * @return {number} The interval to skip by.
 */
const tickInterval = ( length ) => Math.max( 0, Math.ceil( length / 6 ) - 1 );

export default function ReportCharts( { report } ) {
	const { trend, rooms, statuses, currency } = report;

	const statusData = statuses.filter( ( row ) => row.count > 0 );
	const statusTotal = statusData.reduce( ( sum, row ) => sum + row.count, 0 );

	return (
		<div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
			<ChartCard
				title={ __( 'Bookings Trend', 'booking-suite' ) }
				description={ __(
					'Bookings taken in each period.',
					'booking-suite'
				) }
			>
				<ChartContainer
					config={ {
						bookings: {
							label: __( 'Bookings', 'booking-suite' ),
							color: '#2a78d6',
						},
					} }
					className="aspect-auto h-[190px] w-full"
				>
					<BarChart data={ trend }>
						<CartesianGrid vertical={ false } />
						<XAxis
							dataKey="key"
							tickLine={ false }
							axisLine={ false }
							tickMargin={ 8 }
							interval={ tickInterval( trend.length ) }
						/>
						<YAxis
							width={ 28 }
							tickLine={ false }
							axisLine={ false }
							allowDecimals={ false }
						/>
						<ChartTooltip content={ <ChartTooltipContent /> } />
						<Bar
							dataKey="bookings"
							fill="var(--color-bookings)"
							radius={ [ 4, 4, 0, 0 ] }
						/>
					</BarChart>
				</ChartContainer>
			</ChartCard>

			<ChartCard
				title={ __( 'Revenue Analysis', 'booking-suite' ) }
				description={ __(
					'Value of the bookings taken, refunds excluded.',
					'booking-suite'
				) }
			>
				<ChartContainer
					config={ {
						revenue: {
							label: __( 'Revenue', 'booking-suite' ),
							color: '#1baf7a',
						},
					} }
					className="aspect-auto h-[190px] w-full"
				>
					<AreaChart data={ trend }>
						<defs>
							<linearGradient
								id="bks-report-revenue"
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
							interval={ tickInterval( trend.length ) }
						/>
						<YAxis
							width={ 52 }
							tickLine={ false }
							axisLine={ false }
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
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
							fill="url(#bks-report-revenue)"
							dot={ false }
							activeDot={ { r: 4, strokeWidth: 2 } }
						/>
					</AreaChart>
				</ChartContainer>
			</ChartCard>

			<ChartCard
				title={ __( 'Room Performance', 'booking-suite' ) }
				description={ __(
					'Revenue per apartment across the window.',
					'booking-suite'
				) }
			>
				<ChartContainer
					config={ {
						revenue: {
							label: __( 'Revenue', 'booking-suite' ),
							color: '#2a78d6',
						},
					} }
					className="aspect-auto h-[190px] w-full"
				>
					{ /* Horizontal: apartment names need room to be readable. */ }
					<BarChart
						data={ rooms }
						layout="vertical"
						margin={ { left: 8, right: 16 } }
					>
						<CartesianGrid horizontal={ false } />
						<XAxis
							type="number"
							tickLine={ false }
							axisLine={ false }
						/>
						<YAxis
							type="category"
							dataKey="name"
							width={ 120 }
							tickLine={ false }
							axisLine={ false }
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={ ( value ) =>
										formatMoney( value, currency )
									}
								/>
							}
						/>
						<Bar dataKey="revenue" radius={ [ 0, 4, 4, 0 ] }>
							{ /* Each apartment keeps its own colour. */ }
							{ rooms.map( ( room ) => (
								<Cell
									key={ room.id }
									fill={ room.colour || '#2a78d6' }
								/>
							) ) }
						</Bar>
					</BarChart>
				</ChartContainer>
			</ChartCard>

			<ChartCard
				title={ __( 'Booking Status Distribution', 'booking-suite' ) }
				description={ __(
					'How the window splits across the booking lifecycle.',
					'booking-suite'
				) }
			>
				{ ! statusData.length && (
					<p className="py-16 text-center text-sm text-muted-foreground">
						{ __( 'No bookings in this window.', 'booking-suite' ) }
					</p>
				) }

				{ statusData.length > 0 && (
					<div className="flex flex-col gap-3">
						<ChartContainer
							config={ {} }
							className="aspect-auto h-[170px] w-full"
						>
							<PieChart>
								<ChartTooltip
									content={
										<ChartTooltipContent hideLabel />
									}
								/>
								{ /*
								 * The radii are scaled with the box. At the
								 * old 80 the ring was 160px across inside a
								 * 170px container — five pixels of air top
								 * and bottom, which reads as clipped rather
								 * than deliberate.
								 */ }
								<Pie
									data={ statusData }
									dataKey="count"
									nameKey="status"
									innerRadius={ 42 }
									outerRadius={ 66 }
									strokeWidth={ 2 }
									stroke="hsl(var(--card))"
								>
									{ statusData.map( ( row ) => (
										<Cell
											key={ row.status }
											fill={
												STATUS_COLOURS[ row.status ]
											}
										/>
									) ) }
								</Pie>
							</PieChart>
						</ChartContainer>

						{ /*
						 * Legend with counts, which is also the relief for the
						 * two hues that sit below 3:1 on white.
						 */ }
						<ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
							{ statusData.map( ( row ) => (
								<li
									key={ row.status }
									className="flex items-center gap-2 text-xs"
								>
									<span
										aria-hidden="true"
										className="h-2.5 w-2.5 shrink-0 rounded-sm"
										style={ {
											backgroundColor:
												STATUS_COLOURS[ row.status ],
										} }
									/>
									<span className="text-muted-foreground">
										{ STATUS_LABELS[ row.status ] }
									</span>
									<span className="font-medium tabular-nums text-card-foreground">
										{ row.count }
									</span>
									<span className="text-muted-foreground">
										(
										{ Math.round(
											( row.count / statusTotal ) * 100
										) }
										%)
									</span>
								</li>
							) ) }
						</ul>
					</div>
				) }
			</ChartCard>
		</div>
	);
}

function ChartCard( { title, description, children } ) {
	return (
		<Card className="break-inside-avoid">
			<CardHeader className="pb-2">
				<CardTitle className="text-base">{ title }</CardTitle>
				<CardDescription>{ description }</CardDescription>
			</CardHeader>
			<CardContent>{ children }</CardContent>
		</Card>
	);
}
