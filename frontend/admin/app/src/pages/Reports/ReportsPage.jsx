/**
 * ReportsPage — Reports & Analytics.
 *
 * Every figure is aggregated server-side (see ReportsController), so this
 * screen only presents. Two different dates are in play and the labels say
 * which: bookings and revenue are counted by when a booking was TAKEN,
 * occupancy by when the stay HAPPENS.
 */

import { useCallback, useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AlertCircle,
	CalendarRange,
	Clock,
	Euro,
	Percent,
	Printer,
	Users,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { StatCard } from '../../components/StatCard';
import { dayKey, dayOffset } from '../../lib/dates';
import { reportService } from '../../services';
import { formatMoney } from '../Bookings/data/format';
import { ReportCharts } from './components/ReportCharts';

/** Presets, each resolved to a concrete from/to when applied. */
const RANGES = {
	this_month: __( 'This Month', 'booking-suite' ),
	last_month: __( 'Last Month', 'booking-suite' ),
	last_7: __( 'Last 7 Days', 'booking-suite' ),
	last_30: __( 'Last 30 Days', 'booking-suite' ),
	this_year: __( 'This Year', 'booking-suite' ),
	custom: __( 'Custom Range', 'booking-suite' ),
};

/**
 * Turns a preset into dates.
 *
 * @param {string} preset One of the RANGES keys.
 * @return {{from: string, to: string}} Inclusive day keys.
 */
const resolveRange = ( preset ) => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth();

	if ( 'last_month' === preset ) {
		return {
			from: dayKey( new Date( year, month - 1, 1 ) ),
			to: dayKey( new Date( year, month, 0 ) ),
		};
	}

	if ( 'last_7' === preset ) {
		return { from: dayKey( dayOffset( -6 ) ), to: dayKey( today ) };
	}

	if ( 'last_30' === preset ) {
		return { from: dayKey( dayOffset( -29 ) ), to: dayKey( today ) };
	}

	if ( 'this_year' === preset ) {
		return { from: dayKey( new Date( year, 0, 1 ) ), to: dayKey( today ) };
	}

	return { from: dayKey( new Date( year, month, 1 ) ), to: dayKey( today ) };
};

export default function ReportsPage() {
	const [ report, setReport ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );

	const [ preset, setPreset ] = useState( 'this_month' );
	const [ granularity, setGranularity ] = useState( 'day' );
	const [ draft, setDraft ] = useState( () => resolveRange( 'this_month' ) );
	const [ applied, setApplied ] = useState( () =>
		resolveRange( 'this_month' )
	);

	const load = useCallback( async ( range, grain, signal ) => {
		setLoading( true );

		try {
			setReport(
				await reportService.get(
					{ ...range, granularity: grain },
					signal
				)
			);
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

		load( applied, granularity, controller.signal );

		return () => controller.abort();
	}, [ load, applied, granularity ] );

	const choosePreset = ( value ) => {
		setPreset( value );

		// Custom keeps whatever is in the two date fields.
		if ( 'custom' !== value ) {
			setDraft( resolveRange( value ) );
		}
	};

	const totals = report?.totals ?? {};
	const customers = report?.customers ?? {};
	const currency = report?.currency ?? 'EUR';

	const statCards = [
		{
			id: 'bookings',
			title: __( 'Total Bookings', 'booking-suite' ),
			value: totals.bookings ?? 0,
			unit: __( 'Taken in this window', 'booking-suite' ),
			Icon: CalendarRange,
			tone: 'brand',
			badge: __( 'Booked', 'booking-suite' ),
		},
		{
			id: 'revenue',
			title: __( 'Total Revenue', 'booking-suite' ),
			value: formatMoney( totals.revenue ?? 0, currency ),
			unit: __( 'Refunds excluded', 'booking-suite' ),
			Icon: Euro,
			tone: 'success',
			badge: __( 'Gross', 'booking-suite' ),
		},
		{
			id: 'occupancy',
			title: __( 'Occupancy Rate', 'booking-suite' ),
			value: `${ totals.occupancy ?? 0 }%`,
			unit: __( 'Of the hours available', 'booking-suite' ),
			Icon: Percent,
			tone: 'accent',
			badge: __( 'Stays', 'booking-suite' ),
		},
		{
			id: 'customers',
			title: __( 'Unique Customers', 'booking-suite' ),
			value: totals.customers ?? 0,
			unit: __( 'Distinct guests booking', 'booking-suite' ),
			Icon: Users,
			tone: 'warning',
			badge: __( 'People', 'booking-suite' ),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="text-xl font-semibold tracking-tight text-card-foreground">
						{ __( 'Reports & Analytics', 'booking-suite' ) }
					</h2>
					<p className="text-sm text-muted-foreground">
						{ __(
							'Comprehensive analytics and reports for your room booking business.',
							'booking-suite'
						) }
					</p>
				</div>

				{ /* bks-no-print: the controls have no place on paper. */ }
				<div className="bks-no-print">
					<Button
						variant="outline"
						size="sm"
						onClick={ () => window.print() }
					>
						<Printer className="h-4 w-4" />
						{ __( 'Print Report', 'booking-suite' ) }
					</Button>
				</div>
			</div>

			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not build the report', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			<form
				className="bks-no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
				onSubmit={ ( event ) => {
					event.preventDefault();
					setApplied( draft );
				} }
			>
				<div className="flex flex-col gap-1.5">
					<Label
						htmlFor="bks-report-range"
						className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
					>
						{ __( 'Date Range', 'booking-suite' ) }
					</Label>
					<Select value={ preset } onValueChange={ choosePreset }>
						<SelectTrigger
							id="bks-report-range"
							className="w-[180px]"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ Object.entries( RANGES ).map(
								( [ value, label ] ) => (
									<SelectItem key={ value } value={ value }>
										{ label }
									</SelectItem>
								)
							) }
						</SelectContent>
					</Select>
				</div>

				<DateField
					id="bks-report-from"
					label={ __( 'From', 'booking-suite' ) }
					value={ draft.from }
					onChange={ ( from ) => {
						setPreset( 'custom' );
						setDraft( ( current ) => ( { ...current, from } ) );
					} }
				/>

				<DateField
					id="bks-report-to"
					label={ __( 'To', 'booking-suite' ) }
					value={ draft.to }
					onChange={ ( to ) => {
						setPreset( 'custom' );
						setDraft( ( current ) => ( { ...current, to } ) );
					} }
				/>

				<div className="flex flex-col gap-1.5">
					<Label
						htmlFor="bks-report-grain"
						className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
					>
						{ __( 'Group by', 'booking-suite' ) }
					</Label>
					<Select
						value={ granularity }
						onValueChange={ setGranularity }
					>
						<SelectTrigger
							id="bks-report-grain"
							className="w-[140px]"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="day">
								{ __( 'Daily', 'booking-suite' ) }
							</SelectItem>
							<SelectItem value="week">
								{ __( 'Weekly', 'booking-suite' ) }
							</SelectItem>
							<SelectItem value="month">
								{ __( 'Monthly', 'booking-suite' ) }
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Button type="submit" variant="outline">
					{ __( 'Apply Filter', 'booking-suite' ) }
				</Button>
			</form>

			{ report && (
				<p className="text-xs text-muted-foreground">
					{ sprintf(
						/* translators: 1: start date, 2: end date. */
						__( 'Covering %1$s to %2$s.', 'booking-suite' ),
						report.range.from,
						report.range.to
					) }
				</p>
			) }

			{ isLoading && (
				<>
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-72 w-full" />
				</>
			) }

			{ ! isLoading && report && (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{ statCards.map( ( { id, Icon, ...card } ) => (
							<StatCard key={ id } icon={ Icon } { ...card } />
						) ) }
					</div>

					<ReportCharts report={ report } />

					<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
						<Card className="break-inside-avoid overflow-hidden">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">
									{ __(
										'Top Performing Rooms',
										'booking-suite'
									) }
								</CardTitle>
								<CardDescription>
									{ __(
										'Ordered by revenue in this window.',
										'booking-suite'
									) }
								</CardDescription>
							</CardHeader>
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead>
												{ __(
													'Room',
													'booking-suite'
												) }
											</TableHead>
											<TableHead className="text-center">
												{ __(
													'Bookings',
													'booking-suite'
												) }
											</TableHead>
											<TableHead className="text-right">
												{ __(
													'Revenue',
													'booking-suite'
												) }
											</TableHead>
											<TableHead className="text-right">
												{ __(
													'Occupancy',
													'booking-suite'
												) }
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{ report.rooms.map( ( room ) => (
											<TableRow key={ room.id }>
												<TableCell>
													<span className="flex items-center gap-2">
														<span
															aria-hidden="true"
															className="h-2.5 w-2.5 shrink-0 rounded-full"
															style={ {
																background:
																	room.colour,
															} }
														/>
														<span className="font-medium text-card-foreground">
															{ room.name }
														</span>
													</span>
												</TableCell>
												<TableCell className="text-center tabular-nums">
													{ room.bookings }
												</TableCell>
												<TableCell className="text-right font-semibold tabular-nums">
													{ formatMoney(
														room.revenue,
														currency
													) }
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{ room.occupancy }%
												</TableCell>
											</TableRow>
										) ) }
									</TableBody>
								</Table>
							</CardContent>
						</Card>

						<Card className="break-inside-avoid overflow-hidden">
							<CardHeader className="pb-3">
								<CardTitle className="text-base">
									{ __(
										'Peak Booking Hours',
										'booking-suite'
									) }
								</CardTitle>
								<CardDescription>
									{ __(
										'When stays start, busiest first.',
										'booking-suite'
									) }
								</CardDescription>
							</CardHeader>
							<CardContent className="p-0">
								{ ! report.peakHours.length && (
									<p className="px-6 py-10 text-center text-sm text-muted-foreground">
										{ __(
											'No bookings in this window.',
											'booking-suite'
										) }
									</p>
								) }

								{ report.peakHours.length > 0 && (
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead>
													{ __(
														'Time Slot',
														'booking-suite'
													) }
												</TableHead>
												<TableHead className="text-center">
													{ __(
														'Bookings',
														'booking-suite'
													) }
												</TableHead>
												<TableHead className="text-right">
													{ __(
														'Percentage',
														'booking-suite'
													) }
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{ report.peakHours.map(
												( slot ) => (
													<TableRow key={ slot.hour }>
														<TableCell className="font-medium tabular-nums text-card-foreground">
															{ slot.slot }
														</TableCell>
														<TableCell className="text-center tabular-nums">
															{ slot.bookings }
														</TableCell>
														<TableCell className="text-right tabular-nums">
															{ slot.percentage }%
														</TableCell>
													</TableRow>
												)
											) }
										</TableBody>
									</Table>
								) }
							</CardContent>
						</Card>
					</div>

					<Card className="break-inside-avoid">
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								{ __( 'Customer Analytics', 'booking-suite' ) }
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-4 xl:grid-cols-4">
							<Figure
								value={ formatMoney(
									customers.averageValue ?? 0,
									currency
								) }
								label={ __(
									'Average Booking Value',
									'booking-suite'
								) }
							/>
							<Figure
								value={ `${ customers.repeatRate ?? 0 }%` }
								label={ __(
									'Repeat Customer Rate',
									'booking-suite'
								) }
							/>
							<Figure
								value={ `${ customers.averageHours ?? 0 }h` }
								label={ __(
									'Average Booking Duration',
									'booking-suite'
								) }
								icon={ Clock }
							/>
							<Figure
								value={ `${
									customers.cancellationRate ?? 0
								}%` }
								label={ __(
									'Cancellation Rate',
									'booking-suite'
								) }
								hint={ __(
									'Measured on refunded bookings — this system has no cancelled status.',
									'booking-suite'
								) }
							/>
						</CardContent>
					</Card>
				</>
			) }
		</div>
	);
}

function DateField( { id, label, value, onChange } ) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label
				htmlFor={ id }
				className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{ label }
			</Label>
			<Input
				id={ id }
				type="date"
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
				className="w-[170px]"
			/>
		</div>
	);
}

function Figure( { value, label, hint = null } ) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-2xl font-semibold tracking-tight text-card-foreground">
				{ value }
			</span>
			<span className="text-sm text-muted-foreground">{ label }</span>
			{ hint && (
				<span className="text-[11px] text-muted-foreground/80">
					{ hint }
				</span>
			) }
		</div>
	);
}
