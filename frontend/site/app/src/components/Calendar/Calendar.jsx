/**
 * Calendar — a month grid with navigation, and nothing else.
 *
 * Extracted from the filter bar's date picker so the booking modal can use the
 * same calendar rather than grow a second one. It renders the grid and reports
 * a chosen day; where it sits, what it is labelled and how it opens are the
 * caller's business.
 *
 * Keyboard handling uses a roving tabindex: exactly one day is tabbable and the
 * arrows move which. Making all 42 days tabbable would put a month between the
 * field and the rest of the form.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import {
	addDays,
	addMonths,
	formatDate,
	isSameDay,
	monthMatrix,
	startOfMonth,
	startOfToday,
	toBcp47,
	toKey,
	weekdayNames,
	weekStartsOn,
} from '../../utils/date';
import { settings } from '../../services/apartmentService';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import './Calendar.css';

/**
 * @param {Object}    props
 * @param {Date|null} props.value          The selected day, or null.
 * @param {Function}  props.onSelect       Called with the chosen Date.
 * @param {Date}      props.minDate        Earliest selectable day.
 * @param {string}    props.locale         WordPress locale.
 * @param {boolean}   [props.focusOnMount] Move focus into the grid on mount.
 */
export default function Calendar( {
	value,
	onSelect,
	minDate,
	locale,
	focusOnMount = false,
} ) {
	const floor = minDate ?? startOfToday();

	const [ viewMonth, setViewMonth ] = useState( () =>
		startOfMonth( value ?? floor )
	);

	// The day the arrows are on. Kept apart from the selection: moving through
	// the calendar should not select anything until Enter is pressed.
	const [ focusedDay, setFocusedDay ] = useState( () => value ?? floor );

	const gridRef = useRef( null );
	const shouldFocus = useRef( focusOnMount );

	// Only steal focus when the arrows moved it, never on a mouse click — which
	// would otherwise yank focus away mid-interaction.
	useEffect( () => {
		if ( ! shouldFocus.current ) {
			return;
		}

		shouldFocus.current = false;
		gridRef.current
			?.querySelector( '[data-focused="true"]' )
			?.focus( { preventScroll: true } );
	} );

	/*
	 * Settings → General wins over the locale. WordPress asks the owner which
	 * day their week starts on, and an English-language site in Germany answers
	 * Monday — which no amount of inspecting the locale would tell us.
	 */
	const firstWeekday = useMemo( () => {
		const configured = Number( settings.startOfWeek );

		return Number.isInteger( configured ) &&
			configured >= 0 &&
			configured <= 6
			? configured
			: weekStartsOn( locale );
	}, [ locale ] );

	const weekdays = useMemo(
		() => weekdayNames( locale, firstWeekday ),
		[ locale, firstWeekday ]
	);

	const weeks = useMemo(
		() => monthMatrix( viewMonth, firstWeekday ),
		[ viewMonth, firstWeekday ]
	);

	const monthLabel = useMemo(
		() =>
			new Intl.DateTimeFormat( toBcp47( locale ), {
				month: 'long',
				year: 'numeric',
			} ).format( viewMonth ),
		[ viewMonth, locale ]
	);

	const isDisabled = ( day ) => day < floor;

	const move = ( days ) => {
		const next = addDays( focusedDay, days );

		if ( next < floor ) {
			return;
		}

		shouldFocus.current = true;
		setFocusedDay( next );

		// Following the focus into a neighbouring month, so arrowing past the
		// end of one simply continues.
		if ( next.getMonth() !== viewMonth.getMonth() ) {
			setViewMonth( startOfMonth( next ) );
		}
	};

	const choose = ( day ) => {
		if ( ! isDisabled( day ) ) {
			onSelect( day );
		}
	};

	const onKeyDown = ( event ) => {
		const steps = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7,
			ArrowDown: 7,
			PageUp: -28,
			PageDown: 28,
		};

		if ( steps[ event.key ] !== undefined ) {
			event.preventDefault();
			move( steps[ event.key ] );
			return;
		}

		if ( 'Enter' === event.key || ' ' === event.key ) {
			event.preventDefault();
			choose( focusedDay );
		}
	};

	return (
		<div className="bks-cal">
			<div className="bks-cal__header">
				<button
					type="button"
					className="bks-cal__nav"
					onClick={ () => setViewMonth( addMonths( viewMonth, -1 ) ) }
					disabled={ startOfMonth( floor ) >= viewMonth }
					aria-label={ __( 'Previous month', 'booking-suite' ) }
				>
					<ChevronLeftIcon size={ 17 } />
				</button>

				{ /* aria-live so arrowing into a new month is announced. */ }
				<span className="bks-cal__month" aria-live="polite">
					{ monthLabel }
				</span>

				<button
					type="button"
					className="bks-cal__nav"
					onClick={ () => setViewMonth( addMonths( viewMonth, 1 ) ) }
					aria-label={ __( 'Next month', 'booking-suite' ) }
				>
					<ChevronRightIcon size={ 17 } />
				</button>
			</div>

			{ /*
			 * Plain elements, no ARIA grid roles. Every day is a real button
			 * carrying its own full date as an accessible name, which a screen
			 * reader conveys perfectly well; the grid pattern would add
			 * row/column semantics describing the layout rather than anything a
			 * guest needs.
			 */ }
			<div className="bks-cal__grid" ref={ gridRef }>
				<div className="bks-cal__weekdays">
					{ weekdays.map( ( day ) => (
						<abbr
							key={ day.long }
							className="bks-cal__weekday"
							title={ day.long }
						>
							{ day.short }
						</abbr>
					) ) }
				</div>

				{ weeks.map( ( week ) => (
					<div key={ toKey( week[ 0 ] ) } className="bks-cal__week">
						{ week.map( ( day ) => {
							const outside =
								day.getMonth() !== viewMonth.getMonth();
							const isChosen = isSameDay( day, value );
							const hasFocus = isSameDay( day, focusedDay );

							return (
								<button
									key={ toKey( day ) }
									type="button"
									className={ [
										'bks-cal__day',
										outside && 'is-outside',
										isChosen && 'is-selected',
										isSameDay( day, startOfToday() ) &&
											'is-today',
									]
										.filter( Boolean )
										.join( ' ' ) }
									disabled={ isDisabled( day ) }
									aria-pressed={ isChosen }
									data-focused={ hasFocus || undefined }
									/* Roving tabindex: one stop per month. */
									tabIndex={ hasFocus ? 0 : -1 }
									onClick={ () => choose( day ) }
									onFocus={ () => setFocusedDay( day ) }
									onKeyDown={ onKeyDown }
								>
									<span aria-hidden="true">
										{ day.getDate() }
									</span>
									<span className="bks-sr-only">
										{ formatDate( day, locale, {
											weekday: 'long',
											day: 'numeric',
											month: 'long',
											year: 'numeric',
										} ) }
									</span>
								</button>
							);
						} ) }
					</div>
				) ) }
			</div>
		</div>
	);
}
