/**
 * SlotPicker — the start times available on a date.
 *
 * The same picker the guest gets, with two differences an operator needs:
 * times that have already passed are offered, because a walk-in is often
 * recorded after the event, and a taken slot is shown rather than hidden, so
 * it is clear the apartment is busy rather than the picker broken.
 *
 * Free reads green and taken reads red, both at low opacity. An operator scans
 * this grid looking for a gap, and a page of identically-shaped buttons makes
 * them read every label to find one.
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
								: 'bg-background',
							/*
							 * Free and taken are told apart by colour as well as
							 * by shape: a green edge over a faint green ground,
							 * a red one over red. The tints are kept low so a
							 * long grid reads as a whole rather than as a wall
							 * of colour, and the borders carry the signal.
							 *
							 * Both remain choosable — an operator may double-book
							 * deliberately — so this is information, not a lock.
							 * The strike-through stays, which is what says
							 * "taken" without relying on colour.
							 */
							! isSelected &&
								slot.available &&
								! slot.past &&
								'border-success/50 bg-success/5 hover:bg-success/10',
							! isSelected &&
								! slot.available &&
								'border-destructive/50 bg-destructive/5 text-muted-foreground line-through hover:bg-destructive/10',
							// Free, but the time has gone. Neither promised nor
							// refused: an operator recording a walk-in wants it.
							! isSelected &&
								slot.available &&
								slot.past &&
								'border-dashed text-muted-foreground hover:bg-accent'
						) }
					>
						{ slot.start }
					</button>
				);
			} ) }
		</div>
	);
}
