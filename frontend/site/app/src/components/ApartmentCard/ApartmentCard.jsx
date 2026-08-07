/**
 * ApartmentCard — one bookable apartment.
 *
 * Gallery, price badge, name, facts, and the two things a guest can do next.
 *
 * The card is a presentation component: it holds only the gallery index and
 * takes everything else as props, so it can be rendered from a list, a single
 * apartment page, or a story without dragging the data layer along.
 *
 * The primary action opens the booking modal rather than navigating. It carries
 * the stay through `data-bks-*` attributes, which the delegated launcher reads
 * — the same contract the PHP showcase uses, so both surfaces open the modal
 * pre-filled by exactly one mechanism.
 */

import { useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ImageIcon,
	MapPinIcon,
	UsersIcon,
} from '../icons';
import './ApartmentCard.css';

/**
 * The facts worth showing under the name.
 *
 * Built from what the API actually returns. `bedrooms`, `bathrooms`, `size` and
 * `amenities` are read when present and skipped when not, so the card is ready
 * for those fields the day the backend grows them — and shows nothing invented
 * until then.
 *
 * @param {Object} apartment The apartment.
 * @return {Array<{key: string, icon: Function, label: string}>} The facts.
 */
const factsFor = ( apartment ) => {
	const facts = [];

	if ( apartment.capacity > 0 ) {
		facts.push( {
			key: 'capacity',
			icon: UsersIcon,
			label: sprintf(
				/* translators: %d: maximum number of guests. */
				_n(
					'Up to %d guest',
					'Up to %d guests',
					apartment.capacity,
					'booking-suite'
				),
				apartment.capacity
			),
		} );
	}

	( apartment.amenities ?? [] ).forEach( ( amenity, index ) =>
		facts.push( {
			key: `amenity-${ index }`,
			icon: null,
			label: String( amenity?.label ?? amenity ),
		} )
	);

	return facts;
};

/**
 * @param {Object} props
 * @param {Object} props.apartment One apartment from the public API.
 * @param {string} props.locale    WordPress locale, for price formatting.
 * @param {Object} [props.stay]    `{ date, nights, guests }` to pre-fill.
 */
export default function ApartmentCard( { apartment, locale, stay = null } ) {
	const { images = [] } = apartment;
	const [ index, setIndex ] = useState( 0 );

	const hasGallery = images.length > 1;
	const current = images[ index ];

	const step = ( direction ) => ( event ) => {
		// The controls sit on the card; a click on one is not a click on it.
		event.preventDefault();
		event.stopPropagation();

		setIndex(
			( previous ) =>
				( previous + direction + images.length ) % images.length
		);
	};

	const facts = factsFor( apartment );

	return (
		<article className="bks-card">
			<div className="bks-card__media">
				{ current ? (
					<img
						className="bks-card__image"
						src={ current.url }
						alt={ current.alt || apartment.name }
						loading="lazy"
						decoding="async"
					/>
				) : (
					<div className="bks-card__placeholder" aria-hidden="true">
						{ /* The apartment's own colour, softened, rather than
						     a grey box — it ties the card to its calendar. */ }
						<span
							className="bks-card__placeholder-wash"
							style={ { background: apartment.colour } }
						/>
						<ImageIcon size={ 28 } />
					</div>
				) }

				{ hasGallery && (
					<>
						<button
							type="button"
							className="bks-card__nav bks-card__nav--prev"
							onClick={ step( -1 ) }
							aria-label={ __(
								'Previous photo',
								'booking-suite'
							) }
						>
							<ChevronLeftIcon size={ 18 } />
						</button>

						<button
							type="button"
							className="bks-card__nav bks-card__nav--next"
							onClick={ step( 1 ) }
							aria-label={ __( 'Next photo', 'booking-suite' ) }
						>
							<ChevronRightIcon size={ 18 } />
						</button>

						<span className="bks-card__dots" aria-hidden="true">
							{ images.map( ( image, position ) => (
								<span
									key={ image.url }
									className={ `bks-card__dot${
										position === index ? ' is-active' : ''
									}` }
								/>
							) ) }
						</span>
					</>
				) }

				{ /* Price on the photo, where the eye lands first. */ }
				<span className="bks-card__badge">
					{ null === apartment.priceFrom ? (
						<span className="bks-card__badge-request">
							{ __( 'Price on request', 'booking-suite' ) }
						</span>
					) : (
						<>
							<strong className="bks-card__badge-value">
								{ formatPrice(
									apartment.priceFrom,
									apartment.currency,
									locale
								) }
							</strong>
							<span className="bks-card__badge-unit">
								{ __( '/ night', 'booking-suite' ) }
							</span>
						</>
					) }
				</span>
			</div>

			<div className="bks-card__body">
				<div className="bks-card__heading">
					<h3 className="bks-card__title">{ apartment.name }</h3>

					{ /* Rendered only when the backend supplies it. */ }
					{ apartment.location && (
						<p className="bks-card__location">
							<MapPinIcon size={ 14 } />
							<span className="bks-card__location-text">
								{ apartment.location }
							</span>
						</p>
					) }
				</div>

				{ facts.length > 0 && (
					<ul className="bks-card__facts">
						{ facts.map( ( { key, icon: Icon, label } ) => (
							<li key={ key } className="bks-card__fact">
								{ Icon && <Icon size={ 15 } /> }
								<span className="bks-card__fact-text">
									{ label }
								</span>
							</li>
						) ) }
					</ul>
				) }

				{ apartment.excerpt && (
					<p className="bks-card__excerpt">{ apartment.excerpt }</p>
				) }

				<div className="bks-card__footer">
					{ apartment.permalink && (
						<a
							className="bks-card__link"
							href={ apartment.permalink }
						>
							{ __( 'View details', 'booking-suite' ) }
						</a>
					) }

					<button
						type="button"
						className="bks-card__cta"
						data-booking-suite-book={ apartment.id }
						data-bks-date={ stay?.date || undefined }
						data-bks-hours={ stay?.hours || undefined }
						data-bks-guests={ stay?.guests || undefined }
					>
						{ __( 'Book now', 'booking-suite' ) }
						<span className="bks-sr-only">
							{ sprintf(
								/* translators: %s: apartment name. */
								__( '— %s', 'booking-suite' ),
								apartment.name
							) }
						</span>
					</button>
				</div>
			</div>
		</article>
	);
}
