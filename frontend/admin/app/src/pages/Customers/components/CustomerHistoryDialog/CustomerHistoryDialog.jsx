/**
 * CustomerHistoryDialog — every stay one guest has had, newest first.
 *
 * The ordering is the server's (starts_at DESC), so the most recent stay is
 * always at the top whatever order the list happened to be in.
 */

import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { AlertCircle, CalendarX2, Mail, Phone } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { customerService } from '../../../../services';
import { formatDateTime, formatMoney } from '../../../Bookings/data/format';

const STATUS_CLASSES = {
	pending: 'bg-warning/10 text-warning hover:bg-warning/10',
	reserved: 'bg-primary/10 text-primary hover:bg-primary/10',
	confirmed: 'bg-success/10 text-success hover:bg-success/10',
	completed: 'bg-muted text-muted-foreground hover:bg-muted',
};

const PAYMENT_CLASSES = {
	unpaid: 'bg-warning/10 text-warning hover:bg-warning/10',
	partial: 'bg-primary/10 text-primary hover:bg-primary/10',
	paid: 'bg-success/10 text-success hover:bg-success/10',
	refunded: 'bg-muted text-muted-foreground hover:bg-muted',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function CustomerHistoryDialog( { customer, onClose } ) {
	const [ bookings, setBookings ] = useState( [] );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		const controller = new AbortController();

		customerService
			.bookings( customer.id, controller.signal )
			.then( setBookings )
			.catch( ( cause ) => {
				if ( 'AbortError' !== cause.name ) {
					setError( cause.message );
				}
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [ customer.id ] );

	return (
		<Dialog open onOpenChange={ ( next ) => ! next && onClose() }>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>
						{ customer.name || __( 'Customer', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Booking history, newest first.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
					{ customer.email && (
						<a
							href={ `mailto:${ customer.email }` }
							className="flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
						>
							<Mail className="h-3.5 w-3.5" />
							{ customer.email }
						</a>
					) }
					{ customer.phone && (
						<a
							href={ `tel:${ customer.phone }` }
							className="flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
						>
							<Phone className="h-3.5 w-3.5" />
							{ customer.phone }
						</a>
					) }
					<span className="ml-auto font-medium text-card-foreground">
						{ sprintf(
							/* translators: %s: total spent. */
							__( '%s lifetime', 'booking-suite' ),
							formatMoney( customer.totalSpent )
						) }
					</span>
				</div>

				<Separator />

				{ error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{ error }</AlertDescription>
					</Alert>
				) }

				{ isLoading && (
					<div className="flex flex-col gap-2">
						{ [ 0, 1, 2 ].map( ( key ) => (
							<Skeleton key={ key } className="h-12 w-full" />
						) ) }
					</div>
				) }

				{ ! isLoading && ! bookings.length && ! error && (
					<div className="flex flex-col items-center gap-2 py-10 text-center">
						<span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<CalendarX2 className="h-6 w-6" />
						</span>
						<p className="text-sm text-muted-foreground">
							{ __(
								'This customer has no bookings yet.',
								'booking-suite'
							) }
						</p>
					</div>
				) }

				{ ! isLoading && bookings.length > 0 && (
					<>
						<p className="text-xs text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of stays. */
								_n(
									'%d stay',
									'%d stays',
									bookings.length,
									'booking-suite'
								),
								bookings.length
							) }
						</p>

						<div className="w-full overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="w-[130px]">
											{ __(
												'Reference',
												'booking-suite'
											) }
										</TableHead>
										<TableHead>
											{ __(
												'Apartment',
												'booking-suite'
											) }
										</TableHead>
										<TableHead>
											{ __( 'Stay', 'booking-suite' ) }
										</TableHead>
										<TableHead>
											{ __( 'Status', 'booking-suite' ) }
										</TableHead>
										<TableHead className="hidden md:table-cell">
											{ __( 'Payment', 'booking-suite' ) }
										</TableHead>
										<TableHead className="text-right">
											{ __( 'Total', 'booking-suite' ) }
										</TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									{ bookings.map( ( booking ) => (
										<TableRow key={ booking.id }>
											<TableCell className="font-medium tabular-nums">
												{ booking.reference ||
													`#${ booking.id }` }
											</TableCell>

											<TableCell>
												{ booking.apartmentName || '—' }
											</TableCell>

											<TableCell>
												<div className="flex flex-col text-xs">
													<span>
														{ formatDateTime(
															booking.startsAt
														) }
													</span>
													<span className="text-muted-foreground">
														→{ ' ' }
														{ formatDateTime(
															booking.endsAt
														) }
													</span>
												</div>
											</TableCell>

											<TableCell>
												<Badge
													variant="secondary"
													className={ `capitalize ${
														STATUS_CLASSES[
															booking.status
														] ?? ''
													}` }
												>
													{ label( booking.status ) }
												</Badge>
											</TableCell>

											<TableCell className="hidden md:table-cell">
												<Badge
													variant="secondary"
													className={ `capitalize ${
														PAYMENT_CLASSES[
															booking
																.paymentStatus
														] ?? ''
													}` }
												>
													{ label(
														booking.paymentStatus
													) }
												</Badge>
											</TableCell>

											<TableCell className="text-right font-semibold tabular-nums">
												{ formatMoney(
													booking.total,
													booking.currency
												) }
											</TableCell>
										</TableRow>
									) ) }
								</TableBody>
							</Table>
						</div>
					</>
				) }

				<DialogFooter>
					<Button type="button" variant="outline" onClick={ onClose }>
						{ __( 'Close', 'booking-suite' ) }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
