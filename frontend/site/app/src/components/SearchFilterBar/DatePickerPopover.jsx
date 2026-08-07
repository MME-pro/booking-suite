/**
 * DatePickerPopover — the filter bar's date control.
 *
 * The grid itself lives in components/Calendar, shared with the booking modal's
 * DateField. This file is only the part that belongs to the filter bar: the
 * trigger showing the chosen date, the panel it opens, and the clear shortcut.
 */

import { __ } from '@wordpress/i18n';

import { useDismissable } from '../../hooks/useDismissable';
import { settings } from '../../services/apartmentService';
import { fromKey, startOfToday, toKey, wpFormat } from '../../utils/date';
import Calendar from '../Calendar/Calendar';
import { CalendarIcon } from '../icons';

/**
 * @param {Object}   props
 * @param {string}   props.value    Selected date as 'yyyy-mm-dd', or ''.
 * @param {Function} props.onChange Called with the new date key, or ''.
 * @param {string}   props.minDate  Earliest selectable date.
 * @param {string}   props.locale   WordPress locale.
 * @param {boolean}  props.isOpen   Whether the popover is showing.
 * @param {Function} props.onToggle Called to open or close it.
 */
export default function DatePickerPopover( {
	value,
	onChange,
	minDate,
	locale,
	isOpen,
	onToggle,
} ) {
	const { containerRef, triggerRef } = useDismissable( {
		isOpen,
		onClose: () => onToggle( false ),
	} );

	const selected = fromKey( value );
	const floor = fromKey( minDate ) ?? startOfToday();

	const close = () => {
		onToggle( false );
		triggerRef.current?.focus();
	};

	/*
	 * The chosen date is written the way Settings → General says, so the filter
	 * agrees with every other date the site shows. The calendar's own day
	 * numbers stay plain numerals — nobody reads a calendar cell as a date.
	 */
	const label = selected
		? wpFormat( selected, settings.dateFormat || 'j F Y', locale )
		: __( 'Any date', 'booking-suite' );

	return (
		<div className="bks-filter__field" ref={ containerRef }>
			<span className="bks-filter__label" id="bks-date-label">
				{ __( 'Date', 'booking-suite' ) }
			</span>

			<button
				type="button"
				ref={ triggerRef }
				className="bks-filter__trigger"
				onClick={ () => onToggle( ! isOpen ) }
				aria-expanded={ isOpen }
				aria-haspopup="dialog"
				aria-labelledby="bks-date-label bks-date-value"
			>
				<CalendarIcon
					size={ 16 }
					className="bks-filter__trigger-icon"
				/>
				<span
					id="bks-date-value"
					className={ `bks-filter__value${
						selected ? '' : ' is-placeholder'
					}` }
				>
					{ label }
				</span>
			</button>

			{ isOpen && (
				<div
					className="bks-filter__popover bks-filter__popover--calendar"
					role="dialog"
					aria-label={ __( 'Choose a date', 'booking-suite' ) }
				>
					<Calendar
						value={ selected }
						onSelect={ ( day ) => {
							onChange( toKey( day ) );
							close();
						} }
						minDate={ floor }
						locale={ locale }
						focusOnMount
					/>

					{ selected && (
						<div className="bks-calendar__footer">
							<button
								type="button"
								className="bks-filter__clear"
								onClick={ () => {
									onChange( '' );
									close();
								} }
							>
								{ __( 'Clear date', 'booking-suite' ) }
							</button>
						</div>
					) }
				</div>
			) }
		</div>
	);
}
