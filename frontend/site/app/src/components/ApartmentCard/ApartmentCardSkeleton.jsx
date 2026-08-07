/**
 * ApartmentCardSkeleton — the card's shape while its data is in flight.
 *
 * Built from the same box as the real card (same border, radius, padding and
 * 4:3 media) so that when the data lands nothing moves. A skeleton whose
 * proportions differ from the content it stands in for causes exactly the
 * layout shift it was added to prevent.
 *
 * Entirely hidden from assistive technology: a screen reader should hear the
 * status message, not a description of grey rectangles.
 */

import './ApartmentCardSkeleton.css';

export default function ApartmentCardSkeleton() {
	return (
		<div className="bks-skeleton-card" aria-hidden="true">
			<div className="bks-skeleton-card__media bks-shimmer" />

			<div className="bks-skeleton-card__body">
				<span className="bks-shimmer bks-skeleton-card__line bks-skeleton-card__line--title" />

				<span className="bks-skeleton-card__facts">
					<span className="bks-shimmer bks-skeleton-card__chip" />
					<span className="bks-shimmer bks-skeleton-card__chip bks-skeleton-card__chip--short" />
				</span>

				<span className="bks-shimmer bks-skeleton-card__line" />
				<span className="bks-shimmer bks-skeleton-card__line bks-skeleton-card__line--short" />

				<div className="bks-skeleton-card__footer">
					<span className="bks-shimmer bks-skeleton-card__line bks-skeleton-card__line--link" />
					<span className="bks-shimmer bks-skeleton-card__cta" />
				</div>
			</div>
		</div>
	);
}
