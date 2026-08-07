/**
 * GuestDropdown — adults, children and infants, as steppers in a popover.
 *
 * Steppers rather than number inputs: on a phone an input raises a keyboard to
 * change a value that is almost always under six, and its spinners are a 10px
 * target. Two 36px buttons are the whole interaction.
 *
 * Only adults and children count as occupancy; infants are listed because a
 * guest wants to declare them, not because they take a bed. The summary says so
 * explicitly rather than folding them into one number, which would make the
 * total disagree with the count the apartment is filtered by.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { useDismissable } from '../../hooks/useDismissable';
import { GUEST_LIMITS } from '../../hooks/useSearchFilters';
import { ChevronDownIcon, MinusIcon, PlusIcon, UsersIcon } from '../icons';

/**
 * "2 guests", "3 guests, 1 infant".
 *
 * Infants are named separately for the reason above: a party of two adults and
 * an infant is two guests as far as the apartment is concerned, and showing "3"
 * would contradict the list underneath.
 *
 * @param {Object} guests    `{ adults, children, infants }`.
 * @param {number} occupancy Adults plus children.
 * @return {string} The summary.
 */
const summarise = ( guests, occupancy ) => {
	const people = sprintf(
		/* translators: %d: number of guests. */
		_n( '%d guest', '%d guests', occupancy, 'booking-suite' ),
		occupancy
	);

	if ( ! guests.infants ) {
		return people;
	}

	const infants = sprintf(
		/* translators: %d: number of infants. */
		_n( '%d infant', '%d infants', guests.infants, 'booking-suite' ),
		guests.infants
	);

	return sprintf(
		/* translators: 1: guest count, 2: infant count. */
		__( '%1$s, %2$s', 'booking-suite' ),
		people,
		infants
	);
};

/**
 * @param {Object}   props
 * @param {Object}   props.value     `{ adults, children, infants }`.
 * @param {number}   props.occupancy Adults plus children.
 * @param {Function} props.onChange  Called with (kind, nextValue).
 * @param {Function} props.onReset   Called to put the counters back to one adult.
 * @param {boolean}  props.isOpen    Whether the popover is showing.
 * @param {Function} props.onToggle  Called to open or close it.
 */
export default function GuestDropdown( {
	value,
	occupancy,
	onChange,
	onReset,
	isOpen,
	onToggle,
} ) {
	const { containerRef, triggerRef } = useDismissable( {
		isOpen,
		onClose: () => onToggle( false ),
	} );

	const rows = [
		{
			kind: 'adults',
			title: __( 'Adults', 'booking-suite' ),
			hint: __( '13 or older', 'booking-suite' ),
		},
		{
			kind: 'children',
			title: __( 'Children', 'booking-suite' ),
			hint: __( 'Ages 2 to 12', 'booking-suite' ),
		},
		{
			kind: 'infants',
			title: __( 'Infants', 'booking-suite' ),
			hint: __(
				'Under 2, not counted towards occupancy',
				'booking-suite'
			),
		},
	];

	const isDefault = 1 === value.adults && ! value.children && ! value.infants;

	return (
		<div
			className="bks-filter__field bks-filter__field--guests"
			ref={ containerRef }
		>
			<span className="bks-filter__label" id="bks-guests-label">
				{ __( 'Guests', 'booking-suite' ) }
			</span>

			<button
				type="button"
				ref={ triggerRef }
				className="bks-filter__trigger"
				onClick={ () => onToggle( ! isOpen ) }
				aria-expanded={ isOpen }
				aria-haspopup="dialog"
				aria-labelledby="bks-guests-label bks-guests-value"
			>
				<UsersIcon size={ 16 } className="bks-filter__trigger-icon" />
				<span id="bks-guests-value" className="bks-filter__value">
					{ summarise( value, occupancy ) }
				</span>
				<ChevronDownIcon
					size={ 16 }
					className={ `bks-filter__chevron${
						isOpen ? ' is-open' : ''
					}` }
				/>
			</button>

			{ isOpen && (
				<div
					className="bks-filter__popover"
					role="dialog"
					aria-label={ __( 'Who is coming', 'booking-suite' ) }
				>
					{ rows.map( ( { kind, title, hint } ) => {
						const limits = GUEST_LIMITS[ kind ];
						const count = value[ kind ];

						return (
							<div key={ kind } className="bks-stepper">
								<div className="bks-stepper__text">
									<span className="bks-stepper__title">
										{ title }
									</span>
									<span className="bks-stepper__hint">
										{ hint }
									</span>
								</div>

								<div className="bks-stepper__controls">
									<button
										type="button"
										className="bks-stepper__button"
										onClick={ () =>
											onChange( kind, count - 1 )
										}
										disabled={ count <= limits.min }
										aria-label={ sprintf(
											/* translators: %s: Adults, Children or Infants. */
											__(
												'One fewer: %s',
												'booking-suite'
											),
											title
										) }
									>
										<MinusIcon size={ 16 } />
									</button>

									{ /*
									 * Announced through the buttons' own
									 * labels and the trigger summary; marking
									 * it up as live text too would read the
									 * number twice on every step.
									 */ }
									<span
										className="bks-stepper__value"
										aria-hidden="true"
									>
										{ count }
									</span>

									<button
										type="button"
										className="bks-stepper__button"
										onClick={ () =>
											onChange( kind, count + 1 )
										}
										disabled={ count >= limits.max }
										aria-label={ sprintf(
											/* translators: %s: Adults, Children or Infants. */
											__(
												'One more: %s',
												'booking-suite'
											),
											title
										) }
									>
										<PlusIcon size={ 16 } />
									</button>
								</div>
							</div>
						);
					} ) }

					{ ! isDefault && (
						<button
							type="button"
							className="bks-filter__clear"
							onClick={ onReset }
						>
							{ __( 'Reset', 'booking-suite' ) }
						</button>
					) }
				</div>
			) }
		</div>
	);
}
