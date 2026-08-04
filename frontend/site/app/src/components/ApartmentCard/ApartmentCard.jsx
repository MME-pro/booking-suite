/**
 * ApartmentCard — one bookable apartment: gallery, highlights, price, CTA.
 */

import { useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';

import { formatPrice } from '../../utils/format';
import './ApartmentCard.css';

export default function ApartmentCard( { apartment, locale, nights } ) {
	const { images = [] } = apartment;
	const [ index, setIndex ] = useState( 0 );

	const hasGallery = images.length > 1;
	const current = images[ index ];

	const step = ( direction ) =>
		setIndex(
			( previous ) =>
				( previous + direction + images.length ) % images.length
		);

	return (
		<article className="bks-card">
			<div className="bks-card__media">
				{ current ? (
					<img
						className="bks-card__image"
						src={ current.url }
						alt={ current.alt || apartment.name }
						loading="lazy"
					/>
				) : (
					<div
						className="bks-card__placeholder"
						style={ { background: apartment.colour } }
						aria-hidden="true"
					/>
				) }

				{ hasGallery && (
					<>
						<button
							type="button"
							className="bks-card__nav bks-card__nav--prev"
							onClick={ () => step( -1 ) }
							aria-label={ __(
								'Previous photo',
								'booking-suite'
							) }
						>
							‹
						</button>
						<button
							type="button"
							className="bks-card__nav bks-card__nav--next"
							onClick={ () => step( 1 ) }
							aria-label={ __( 'Next photo', 'booking-suite' ) }
						>
							›
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

				<span
					className="bks-card__accent"
					style={ { background: apartment.colour } }
					aria-hidden="true"
				/>
			</div>

			<div className="bks-card__body">
				<h3 className="bks-card__title">{ apartment.name }</h3>

				<ul className="bks-card__highlights">
					<li>
						{ sprintf(
							/* translators: %d: maximum number of guests. */
							_n(
								'%d guest',
								'%d guests',
								apartment.capacity,
								'booking-suite'
							),
							apartment.capacity
						) }
					</li>
					<li>{ __( 'Self check-in', 'booking-suite' ) }</li>
				</ul>

				{ apartment.excerpt && (
					<p className="bks-card__excerpt">{ apartment.excerpt }</p>
				) }

				<div className="bks-card__footer">
					<div className="bks-card__price">
						{ null === apartment.priceFrom ? (
							<span className="bks-card__price-request">
								{ __( 'Price on request', 'booking-suite' ) }
							</span>
						) : (
							<>
								<span className="bks-card__price-label">
									{ __( 'from', 'booking-suite' ) }
								</span>
								<strong className="bks-card__price-value">
									{ formatPrice(
										apartment.priceFrom,
										apartment.currency,
										locale
									) }
								</strong>
								<span className="bks-card__price-unit">
									{ __( '/ night', 'booking-suite' ) }
								</span>
							</>
						) }
					</div>

					<a
						className="bks-card__cta"
						href={ apartment.bookingLink || '#' }
						aria-disabled={
							apartment.bookingLink ? undefined : 'true'
						}
					>
						{ nights > 0
							? __( 'Check availability', 'booking-suite' )
							: __( 'Book now', 'booking-suite' ) }
					</a>
				</div>
			</div>
		</article>
	);
}
