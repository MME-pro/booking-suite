/**
 * SlotPicker — the start times available on a date.
 *
 * The same picker the guest gets, with two differences an operator needs:
 * times that have already passed are offered, because a walk-in is often
 * recorded after the event, and a taken slot is shown greyed rather than
 * hidden, so it is clear the apartment is busy rather than the picker broken.
 */

import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { formatMoney } from '../../data/format';

/**
 * @param {Object}   props
 * @param {Array}    props.slots    From the slots endpoint.
 * @param {string}   props.value    The chosen start time, as HH:MM.
 * @param {Function} props.onChange Called with the new start time.
 */
export default function SlotPicker( { slots, value, onChange } ) {
	if ( ! slots.length ) {
		return (
			<p className="text-sm text-muted-foreground">
				{ __(
					'No start times for this date. Check the opening hours in Settings.',
					'booking-suite'
				) }
			</p>
		);
	}

	return (
		/*
		 * A grid rather than wrapped flex: every time is the same width, so the
		 * times line up in columns and the eye can run down them. Wrapped flex
		 * left a ragged edge that made a long list hard to scan.
		 */
		<div
			role="radiogroup"
			aria-label={ __( 'Start time', 'booking-suite' ) }
			className="grid w-full grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5"
		>
			{ slots.map( ( slot ) => {
				const isSelected = slot.start === value;

				return (
					<button
						key={ slot.startsAt }
						type="button"
						role="radio"
						aria-checked={ isSelected }
						onClick={ () => onChange( slot.start ) }
						title={ `${ slot.start }–${ slot.end } · ${ formatMoney(
							slot.total ?? 0
						) }` }
						className={ cn(
							'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
							isSelected
								? 'border-primary bg-primary text-primary-foreground'
								: 'bg-background hover:bg-accent',
							// Taken, or already gone: still choosable, but it
							// should not look like a free slot.
							! isSelected &&
								! slot.available &&
								'border-dashed text-muted-foreground line-through',
							! isSelected &&
								slot.available &&
								slot.past &&
								'text-muted-foreground'
						) }
					>
						{ slot.start }
					</button>
				);
			} ) }
		</div>
	);
}
