/**
 * DateField — a labelled date control for the booking modal.
 *
 * Replaces `<input type="date">`, which renders in the operating system's
 * locale and ignores Settings → General entirely. A guest on a d.m.Y site was
 * being shown mm/dd/yyyy or dd/mm/yyyy depending on their machine, on the one
 * screen where the date has to be unambiguous.
 *
 * The value it reports is still 'yyyy-mm-dd'; only what the guest reads is
 * formatted.
 */

import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import { useDismissable } from '../../hooks/useDismissable';
import { settings } from '../../services/apartmentService';
import { fromKey, startOfToday, toKey } from '../../utils/date';
import { formatWpDate } from '../../utils/format';
import Calendar from '../Calendar/Calendar';
import { CalendarIcon } from '../icons';
import './DateField.css';

/**
 * @param {Object}   props
 * @param {string}   props.id            Element id, for the label association.
 * @param {string}   props.label         The field label.
 * @param {string}   props.value         'yyyy-mm-dd', or ''.
 * @param {Function} props.onChange      Called with the new 'yyyy-mm-dd'.
 * @param {string}   [props.min]         Earliest selectable date, 'yyyy-mm-dd'.
 * @param {string}   [props.placeholder] Shown when no date is chosen.
 */
export default function DateField( {
	id,
	label,
	value,
	onChange,
	min,
	placeholder = __( 'Choose a date', 'booking-suite' ),
} ) {
	const [ isOpen, setOpen ] = useState( false );
	const popoverRef = useRef( null );

	const { containerRef, triggerRef } = useDismissable( {
		isOpen,
		onClose: () => setOpen( false ),
	} );

	/*
	 * Bring the whole panel into view when it opens.
	 *
	 * The popover hangs below its trigger inside the modal's scrolling body. On
	 * a phone that body is only a few hundred pixels tall, so a month grid
	 * opened from a field near the middle of the form has its last week cut off
	 * by the footer — and nothing on screen says there is more to scroll to.
	 *
	 * 'nearest' scrolls the least that will do it, so a panel already fully
	 * visible does not move at all.
	 */
	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		popoverRef.current?.scrollIntoView( {
			block: 'nearest',
			behavior: 'smooth',
		} );
	}, [ isOpen ] );

	const selected = fromKey( value );
	const floor = fromKey( min ) ?? startOfToday();

	const choose = ( day ) => {
		onChange( toKey( day ) );
		setOpen( false );
		triggerRef.current?.focus();
	};

	return (
		<div className="bks-field bks-datefield" ref={ containerRef }>
			<span className="bks-datefield__label" id={ `${ id }-label` }>
				{ label }
			</span>

			<button
				type="button"
				id={ id }
				ref={ triggerRef }
				className="bks-datefield__trigger"
				onClick={ () => setOpen( ! isOpen ) }
				aria-expanded={ isOpen }
				aria-haspopup="dialog"
				aria-labelledby={ `${ id }-label ${ id }-value` }
			>
				<CalendarIcon size={ 16 } className="bks-datefield__icon" />

				<span
					id={ `${ id }-value` }
					className={ `bks-datefield__value${
						selected ? '' : ' is-placeholder'
					}` }
				>
					{ selected ? formatWpDate( value ) : placeholder }
				</span>
			</button>

			{ isOpen && (
				<div
					ref={ popoverRef }
					className="bks-datefield__popover"
					role="dialog"
					aria-label={ label }
				>
					<Calendar
						value={ selected }
						onSelect={ choose }
						minDate={ floor }
						locale={ settings.locale }
						focusOnMount
					/>
				</div>
			) }
		</div>
	);
}
