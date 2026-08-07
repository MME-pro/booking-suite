/**
 * SearchFilterBar — date, duration and party size, on one rail.
 *
 * A single floating container in the style of a travel portal: the fields carry
 * no borders of their own, the rail is the border, and hairlines do the
 * dividing. Four separately-bordered controls in a row is what makes a search
 * bar read as clutter.
 *
 * Only one popover may be open at a time — the bar owns which, rather than each
 * field holding its own flag, because two open popovers would overlap and the
 * field underneath would be unreachable.
 *
 * Values live in the parent (see useSearchFilters) and are only applied on
 * submit, so adjusting a control does not refetch on every tap.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import { SearchIcon } from '../icons';
import DatePickerPopover from './DatePickerPopover';
import DurationField from './DurationField';
import GuestDropdown from './GuestDropdown';
import './SearchFilterBar.css';

/**
 * @param {Object}   props
 * @param {Object}   props.filters   `{ date, hours, guests }`.
 * @param {Object}   props.bounds    `{ min, max }` bookable hours.
 * @param {number}   props.occupancy Adults plus children.
 * @param {string}   props.minDate   Earliest selectable date.
 * @param {string}   props.locale    WordPress locale.
 * @param {Function} props.onDate    Called with a 'yyyy-mm-dd' date, or ''.
 * @param {Function} props.onHours   Called with the new hour count.
 * @param {Function} props.onGuest   Called with (kind, nextValue).
 * @param {Function} props.onReset   Called to reset the party counters.
 * @param {Function} props.onSubmit  Called to apply the filters.
 * @param {boolean}  [props.isBusy]  Whether a search is in flight.
 */
export default function SearchFilterBar( {
	filters,
	bounds,
	occupancy,
	minDate,
	locale,
	onDate,
	onHours,
	onGuest,
	onReset,
	onSubmit,
	isBusy = false,
} ) {
	// null, 'date' or 'guests' — never two at once.
	const [ openField, setOpenField ] = useState( null );

	const toggle = ( field ) => ( next ) => setOpenField( next ? field : null );

	return (
		<form
			className="bks-filter"
			role="search"
			onSubmit={ ( event ) => {
				event.preventDefault();
				setOpenField( null );
				onSubmit();
			} }
		>
			<DatePickerPopover
				value={ filters.date }
				onChange={ onDate }
				minDate={ minDate }
				locale={ locale }
				isOpen={ 'date' === openField }
				onToggle={ toggle( 'date' ) }
			/>

			<DurationField
				value={ filters.hours }
				onChange={ onHours }
				bounds={ bounds }
			/>

			<GuestDropdown
				value={ filters.guests }
				occupancy={ occupancy }
				onChange={ onGuest }
				onReset={ onReset }
				isOpen={ 'guests' === openField }
				onToggle={ toggle( 'guests' ) }
			/>

			<button
				type="submit"
				className="bks-filter__submit"
				disabled={ isBusy }
			>
				<SearchIcon size={ 17 } />
				<span className="bks-filter__submit-text">
					{ __( 'Search', 'booking-suite' ) }
				</span>
			</button>
		</form>
	);
}
