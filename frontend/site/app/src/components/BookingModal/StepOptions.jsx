/**
 * Step 2 — the extras offered with this apartment.
 *
 * Guests are set in the previous step and deliberately not repeated here:
 * asking twice invites the two inputs to disagree.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import { settings } from '../../services/apartmentService';

export default function StepOptions( {
	extras,
	chosen,
	onExtrasChange,
	currency,
	available = null,
} ) {
	const setQuantity = ( id, quantity ) =>
		onExtrasChange( { ...chosen, [ id ]: Math.max( 0, quantity ) } );

	/**
	 * How many of an extra can still be taken for the chosen dates.
	 *
	 * Stock is not a counter that runs down: it is how many exist, and one
	 * held by an overlapping booking comes back once that stay ends. Until the
	 * server has quoted the window, fall back to the extra's own total.
	 *
	 * @param {Object} extra The extra.
	 * @return {number|null} Units free, or null when unlimited.
	 */
	const freeFor = ( extra ) => {
		if ( available && undefined !== available[ extra.id ] ) {
			return available[ extra.id ];
		}

		return extra.stock ?? null;
	};

	return (
		<div className="bks-step">
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
					const free = freeFor( extra );
					const soldOut = null !== free && free < 1;

					return (
						<li key={ extra.id } className="bks-extras__item">
							{ /* Optional; set per extra in the admin. */ }
							{ extra.image_url && (
								<img
									className="bks-extras__image"
									src={ extra.image_url }
									alt=""
								/>
							) }

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

								{ /*
								 * Only worth saying when it limits the guest:
								 * unlimited says nothing, and so does
								 * plenty-in-stock.
								 */ }
								{ soldOut && (
									<span className="bks-extras__stock bks-extras__stock--out">
										{ __(
											'Not available for these dates',
											'booking-suite'
										) }
									</span>
								) }

								{ ! soldOut && null !== free && free <= 3 && (
									<span className="bks-extras__stock">
										{ sprintf(
											/* translators: %d: how many are left. */
											_n(
												'Only %d left for these dates',
												'Only %d left for these dates',
												free,
												'booking-suite'
											),
											free
										) }
									</span>
								) }
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
										( null !== free && quantity >= free )
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
