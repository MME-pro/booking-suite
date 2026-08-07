/**
 * DurationField — how long the visit runs, in hours.
 *
 * A stepper inline in the bar rather than behind a popover: unlike the date and
 * the party, this is a single number over a short range, and hiding a one-tap
 * adjustment behind a menu costs more than it saves.
 *
 * The bounds are the owner's "shortest" and "longest booking" settings. They
 * are passed in rather than assumed, so the control can never offer a length
 * the server would reject.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { ClockIcon, MinusIcon, PlusIcon } from '../icons';

/**
 * @param {Object}   props
 * @param {number}   props.value    Hours.
 * @param {Function} props.onChange Called with the new hour count.
 * @param {Object}   props.bounds   `{ min, max }` whole hours.
 */
export default function DurationField( { value, onChange, bounds } ) {
	const label = sprintf(
		/* translators: %d: number of hours. */
		_n( '%d hour', '%d hours', value, 'booking-suite' ),
		value
	);

	return (
		<div className="bks-filter__field bks-filter__field--duration">
			<span className="bks-filter__label" id="bks-duration-label">
				{ __( 'Duration', 'booking-suite' ) }
			</span>

			<div
				className="bks-filter__control bks-filter__control--stepper"
				role="group"
				aria-labelledby="bks-duration-label bks-duration-value"
			>
				<ClockIcon size={ 16 } className="bks-filter__icon" />

				<span id="bks-duration-value" className="bks-filter__value">
					{ label }
				</span>

				<span className="bks-filter__inline-controls">
					<button
						type="button"
						className="bks-stepper__button bks-stepper__button--sm"
						onClick={ () => onChange( value - 1 ) }
						disabled={ value <= bounds.min }
						aria-label={ __( 'One hour less', 'booking-suite' ) }
					>
						<MinusIcon size={ 14 } />
					</button>

					<button
						type="button"
						className="bks-stepper__button bks-stepper__button--sm"
						onClick={ () => onChange( value + 1 ) }
						disabled={ value >= bounds.max }
						aria-label={ __( 'One hour more', 'booking-suite' ) }
					>
						<PlusIcon size={ 14 } />
					</button>
				</span>
			</div>

			{ /*
			 * Said once, at the floor, so a disabled minus button has a
			 * reason rather than just being dead.
			 */ }
			{ value <= bounds.min && (
				<span className="bks-filter__note">
					{ sprintf(
						/* translators: %d: shortest bookable length in hours. */
						_n(
							'Minimum %d hour',
							'Minimum %d hours',
							bounds.min,
							'booking-suite'
						),
						bounds.min
					) }
				</span>
			) }
		</div>
	);
}
