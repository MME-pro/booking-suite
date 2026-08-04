/**
 * SearchBar — check-in, check-out and guests, in the style of a hotel portal.
 *
 * Dates are collected but not yet applied: availability needs the bookings
 * endpoint, which does not exist yet. Guests filter for real.
 */

import { __ } from '@wordpress/i18n';

import './SearchBar.css';

export default function SearchBar( { values, onChange, onSubmit, nights } ) {
	const set = ( key ) => ( event ) =>
		onChange( { ...values, [ key ]: event.target.value } );

	return (
		<form
			className="bks-search-bar"
			onSubmit={ ( event ) => {
				event.preventDefault();
				onSubmit();
			} }
		>
			<div className="bks-search-bar__field">
				<label htmlFor="bks-checkin">
					{ __( 'Check-in', 'booking-suite' ) }
				</label>
				<input
					id="bks-checkin"
					type="date"
					value={ values.checkIn }
					onChange={ set( 'checkIn' ) }
				/>
			</div>

			<div className="bks-search-bar__field">
				<label htmlFor="bks-checkout">
					{ __( 'Check-out', 'booking-suite' ) }
				</label>
				<input
					id="bks-checkout"
					type="date"
					min={ values.checkIn || undefined }
					value={ values.checkOut }
					onChange={ set( 'checkOut' ) }
				/>
			</div>

			<div className="bks-search-bar__field bks-search-bar__field--guests">
				<label htmlFor="bks-guests">
					{ __( 'Guests', 'booking-suite' ) }
				</label>
				<input
					id="bks-guests"
					type="number"
					min="1"
					max="99"
					inputMode="numeric"
					value={ values.guests }
					onChange={ set( 'guests' ) }
				/>
			</div>

			<button type="submit" className="bks-search-bar__submit">
				{ __( 'Search', 'booking-suite' ) }
			</button>

			{ nights > 0 && (
				<p className="bks-search-bar__nights" aria-live="polite">
					{ 1 === nights
						? __( '1 night', 'booking-suite' )
						: `${ nights } ${ __( 'nights', 'booking-suite' ) }` }
				</p>
			) }
		</form>
	);
}
