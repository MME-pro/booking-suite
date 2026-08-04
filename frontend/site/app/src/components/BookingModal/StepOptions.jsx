/**
 * Step 2 — guests and any extras offered with this apartment.
 */

import { __ } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

export default function StepOptions( {
	stay,
	onChange,
	capacity,
	extras,
	chosen,
	onExtrasChange,
	currency,
} ) {
	const setQuantity = ( id, quantity ) =>
		onExtrasChange( { ...chosen, [ id ]: Math.max( 0, quantity ) } );

	return (
		<div className="bks-step">
			<div className="bks-field bks-field--narrow">
				<label htmlFor="bks-modal-option-guests">
					{ __( 'Guests', 'booking-suite' ) }
				</label>
				<input
					id="bks-modal-option-guests"
					type="number"
					min="1"
					max={ capacity }
					value={ stay.guests }
					onChange={ ( event ) =>
						onChange( {
							...stay,
							guests: Math.max(
								1,
								Math.min(
									capacity,
									Number.parseInt( event.target.value, 10 ) ||
										1
								)
							),
						} )
					}
				/>
			</div>

			<h3 className="bks-step__title">
				{ __( 'Extras', 'booking-suite' ) }
			</h3>

			{ ! extras.length && (
				<p className="bks-step__hint">
					{ __(
						'No extras are offered with this apartment.',
						'booking-suite'
					) }
				</p>
			) }

			<ul className="bks-extras">
				{ extras.map( ( extra ) => {
					const quantity = chosen[ extra.id ] ?? 0;
					const soldOut = null !== extra.stock && extra.stock < 1;

					return (
						<li key={ extra.id } className="bks-extras__item">
							<div className="bks-extras__text">
								<strong>{ extra.name }</strong>
								{ extra.description && (
									<span>{ extra.description }</span>
								) }
								<span className="bks-extras__price">
									{ formatPrice(
										extra.price,
										currency,
										settings.locale
									) }
								</span>
							</div>

							<div className="bks-extras__stepper">
								<button
									type="button"
									onClick={ () =>
										setQuantity( extra.id, quantity - 1 )
									}
									disabled={ quantity < 1 }
									aria-label={ __(
										'Remove one',
										'booking-suite'
									) }
								>
									−
								</button>
								<span>{ quantity }</span>
								<button
									type="button"
									onClick={ () =>
										setQuantity( extra.id, quantity + 1 )
									}
									disabled={
										soldOut ||
										( null !== extra.stock &&
											quantity >= extra.stock )
									}
									aria-label={ __(
										'Add one',
										'booking-suite'
									) }
								>
									+
								</button>
							</div>
						</li>
					);
				} ) }
			</ul>
		</div>
	);
}
