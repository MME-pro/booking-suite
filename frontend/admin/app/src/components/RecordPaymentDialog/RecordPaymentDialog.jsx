/**
 * Write down money that has arrived.
 *
 * The half of the ledger that was missing. Everything else in this admin could
 * only move a payment the booking flow had already created, for the amount that
 * flow decided — so a guest who transferred €120 of €200 could not be recorded
 * at all, and "partially paid" was a state the software could describe but
 * nobody could reach.
 *
 * Two ways in, because there are two ways an operator arrives at this. From a
 * booking they already have open, the booking is settled and the amount is
 * prefilled with what is still owed — the commonest case is "the rest came in",
 * and that should be one press. From the Payments ledger, where they are
 * working through a bank statement, the booking has to be found first.
 *
 * @param {Object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onOpenChange
 * @param {Object}   [props.booking]    The booking, when it is already known.
 * @param {Function} props.onRecorded   Called after a successful write.
 */

import { useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { bookingService, paymentService } from '../../services';
import { formatMoney } from '../../pages/Bookings/data/format';
import './RecordPaymentDialog.css';

/** Today, as the date input spells it. */
const today = () => {
	const now = new Date();

	return [
		now.getFullYear(),
		String( now.getMonth() + 1 ).padStart( 2, '0' ),
		String( now.getDate() ).padStart( 2, '0' ),
	].join( '-' );
};

/** What the money fields should say when the dialog opens on a booking. */
const outstandingOf = ( booking ) => {
	if ( ! booking ) {
		return '';
	}

	const settlement = booking.settlement;

	// Falls back to the total: a booking whose settlement has not been loaded
	// is almost always one nothing has been paid against.
	const owed = settlement ? settlement.outstanding : booking.total;

	return owed > 0 ? String( owed ) : '';
};

export default function RecordPaymentDialog( {
	open,
	onOpenChange,
	booking = null,
	onRecorded,
} ) {
	const [ amount, setAmount ] = useState( '' );
	const [ method, setMethod ] = useState( 'transfer' );
	const [ paidAt, setPaidAt ] = useState( today );
	const [ notes, setNotes ] = useState( '' );

	const [ isBusy, setBusy ] = useState( false );
	const [ error, setError ] = useState( null );

	/** Only used when the dialog was opened without a booking. */
	const [ search, setSearch ] = useState( '' );
	const [ matches, setMatches ] = useState( [] );
	const [ chosen, setChosen ] = useState( null );
	const [ isSearching, setSearching ] = useState( false );

	const target = booking ?? chosen;

	// Reset on every opening. A dialog that remembers the last amount typed is
	// a dialog that will one day record it against the wrong booking.
	useEffect( () => {
		if ( ! open ) {
			return;
		}

		setAmount( outstandingOf( booking ) );
		setMethod( 'transfer' );
		setPaidAt( today() );
		setNotes( '' );
		setError( null );
		setSearch( '' );
		setMatches( [] );
		setChosen( null );
	}, [ open, booking ] );

	// When a booking is picked from the search, offer what it still owes.
	useEffect( () => {
		if ( chosen ) {
			setAmount( outstandingOf( chosen ) );
		}
	}, [ chosen ] );

	/** Look for a booking by reference, guest or email. */
	useEffect( () => {
		if ( booking || ! open || search.trim().length < 2 ) {
			setMatches( [] );

			return undefined;
		}

		const controller = new AbortController();
		const timer = window.setTimeout( () => {
			setSearching( true );

			bookingService
				.list( { search: search.trim() }, controller.signal )
				.then( ( payload ) => setMatches( payload.bookings.slice( 0, 6 ) ) )
				.catch( () => {} )
				.finally( () => setSearching( false ) );
		}, 300 );

		return () => {
			window.clearTimeout( timer );
			controller.abort();
		};
	}, [ search, booking, open ] );

	const currency = target?.currency ?? 'EUR';

	/** What the booking will stand at once this is written. */
	const after = useMemo( () => {
		const value = Number.parseFloat( amount );

		if ( ! target || ! Number.isFinite( value ) ) {
			return null;
		}

		const total = Number( target.total ) || 0;
		const paid = ( target.settlement?.paid ?? 0 ) + value;
		const difference = Math.round( ( paid - total ) * 100 ) / 100;

		if ( difference > 0.005 ) {
			return sprintf(
				/* translators: %s: how much too much would have been received. */
				__( 'Overpaid by %s', 'booking-suite' ),
				formatMoney( difference, currency )
			);
		}

		if ( difference > -0.005 ) {
			return __( 'Paid in full', 'booking-suite' );
		}

		return sprintf(
			/* translators: %s: what would still be owed. */
			__( 'Still outstanding: %s', 'booking-suite' ),
			formatMoney( Math.abs( difference ), currency )
		);
	}, [ amount, target, currency ] );

	const save = async () => {
		setBusy( true );
		setError( null );

		try {
			const result = await paymentService.record( {
				bookingId: target.id,
				amount: Number.parseFloat( amount ),
				method,
				paidAt,
				notes,
			} );

			onRecorded?.( result );
			onOpenChange( false );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusy( false );
		}
	};

	const canSave =
		!! target && Number.isFinite( Number.parseFloat( amount ) ) && ! isBusy;

	return (
		<Dialog open={ open } onOpenChange={ onOpenChange }>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{ __( 'Record a payment', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Money that has reached the account. Record part of what is owed and the booking reads as partially paid; record more than is owed and it reads as overpaid.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					{ /* Finding the booking, when we arrived without one. */ }
					{ ! booking && (
						<div className="flex flex-col gap-2">
							<Label htmlFor="bks-pay-search">
								{ __( 'Which booking?', 'booking-suite' ) }
							</Label>

							{ chosen ? (
								<div className="bks-recordpay__chosen">
									<span>
										<strong>{ chosen.reference }</strong>
										{ chosen.customerName
											? ` · ${ chosen.customerName }`
											: '' }
									</span>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={ () => setChosen( null ) }
									>
										{ __( 'Change', 'booking-suite' ) }
									</Button>
								</div>
							) : (
								<>
									<div className="relative">
										<Search className="bks-recordpay__searchicon" />
										<Input
											id="bks-pay-search"
											value={ search }
											className="pl-9"
											placeholder={ __(
												'Reference, guest or email',
												'booking-suite'
											) }
											onChange={ ( event ) =>
												setSearch( event.target.value )
											}
										/>
									</div>

									{ matches.length > 0 && (
										<ul className="bks-recordpay__matches">
											{ matches.map( ( match ) => (
												<li key={ match.id }>
													<button
														type="button"
														onClick={ () =>
															setChosen( match )
														}
													>
														<strong>
															{ match.reference }
														</strong>
														<span>
															{ match.customerName }
														</span>
														<em>
															{ formatMoney(
																match.total,
																match.currency
															) }
														</em>
													</button>
												</li>
											) ) }
										</ul>
									) }

									{ isSearching && (
										<p className="bks-recordpay__hint">
											{ __( 'Searching…', 'booking-suite' ) }
										</p>
									) }
								</>
							) }
						</div>
					) }

					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="bks-pay-amount">
								{ __( 'Amount received', 'booking-suite' ) }
							</Label>
							<Input
								id="bks-pay-amount"
								type="number"
								step="0.01"
								value={ amount }
								onChange={ ( event ) =>
									setAmount( event.target.value )
								}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="bks-pay-date">
								{ __( 'Received on', 'booking-suite' ) }
							</Label>
							<Input
								id="bks-pay-date"
								type="date"
								value={ paidAt }
								onChange={ ( event ) =>
									setPaidAt( event.target.value )
								}
							/>
						</div>
					</div>

					{ /*
					 * What this will leave the booking reading. The operator is
					 * typing a figure off a bank statement; telling them what it
					 * settles to before they commit is cheaper than telling them
					 * afterwards.
					 */ }
					{ after && (
						<p className="bks-recordpay__after">{ after }</p>
					) }

					<div className="flex flex-col gap-2">
						<Label>{ __( 'How', 'booking-suite' ) }</Label>
						<Select value={ method } onValueChange={ setMethod }>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="transfer">
									{ __( 'Bank transfer', 'booking-suite' ) }
								</SelectItem>
								<SelectItem value="cash">
									{ __( 'Cash', 'booking-suite' ) }
								</SelectItem>
								<SelectItem value="card">
									{ __( 'Card', 'booking-suite' ) }
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="bks-pay-notes">
							{ __( 'Note (optional)', 'booking-suite' ) }
						</Label>
						<Textarea
							id="bks-pay-notes"
							rows={ 2 }
							value={ notes }
							placeholder={ __(
								'What the bank statement said',
								'booking-suite'
							) }
							onChange={ ( event ) =>
								setNotes( event.target.value )
							}
						/>
					</div>

					{ error && (
						<p className="bks-recordpay__error">{ error }</p>
					) }

					<Button disabled={ ! canSave } onClick={ save }>
						{ isBusy
							? __( 'Recording…', 'booking-suite' )
							: __( 'Record the payment', 'booking-suite' ) }
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
