/**
 * ApartmentGrid — the responsive card grid and everything it can show instead.
 *
 * Four states in one place: loading, failed, empty, and results. Keeping them
 * together is what stops two of them rendering at once, which is the usual bug
 * when each is a separate conditional in the page component.
 *
 * The skeleton count matches the number of cards last shown, so a filter change
 * redraws the grid at the height it already had rather than collapsing the page
 * and pushing everything below it upwards.
 */

import { __, sprintf, _n } from '@wordpress/i18n';

import { ApartmentCard, ApartmentCardSkeleton } from '../ApartmentCard';
import './ApartmentGrid.css';

/**
 * @param {Object}   props
 * @param {Array}    props.apartments     The apartments to show.
 * @param {number}   props.columns        Preferred columns on wide screens.
 * @param {string}   props.locale         WordPress locale, for prices.
 * @param {Object}   [props.stay]         `{ date, nights, guests }` to pre-fill.
 * @param {boolean}  [props.isLoading]    Nothing has arrived yet.
 * @param {boolean}  [props.isRefreshing] A filter changed; results exist.
 * @param {*}        [props.error]        Truthy when the fetch failed.
 * @param {Function} [props.onRetry]      Called to try the fetch again.
 * @param {number}   [props.placeholders] How many skeletons to draw.
 */
export default function ApartmentGrid( {
	apartments,
	columns = 3,
	locale,
	stay = null,
	isLoading = false,
	isRefreshing = false,
	error = null,
	onRetry = null,
	placeholders = 3,
} ) {
	const style = { '--bks-site-columns': columns };

	if ( isLoading || isRefreshing ) {
		return (
			<>
				{ /*
				 * The one thing assistive technology should hear while waiting.
				 * The skeletons themselves are hidden from it.
				 */ }
				<p className="bks-sr-only" role="status">
					{ __( 'Searching for apartments…', 'booking-suite' ) }
				</p>

				<div className="bks-grid" style={ style }>
					{ Array.from(
						{ length: Math.max( 1, placeholders ) },
						( _, index ) => (
							<ApartmentCardSkeleton key={ index } />
						)
					) }
				</div>
			</>
		);
	}

	if ( error ) {
		return (
			<div className="bks-grid__state" role="alert">
				<p className="bks-grid__state-title">
					{ __(
						'The apartments could not be loaded.',
						'booking-suite'
					) }
				</p>
				<p className="bks-grid__state-text">
					{ __(
						'Something went wrong at our end. Please try again.',
						'booking-suite'
					) }
				</p>

				{ onRetry && (
					<button
						type="button"
						className="bks-grid__retry"
						onClick={ onRetry }
					>
						{ __( 'Try again', 'booking-suite' ) }
					</button>
				) }
			</div>
		);
	}

	if ( ! apartments.length ) {
		return (
			<div className="bks-grid__state">
				<p className="bks-grid__state-title">
					{ __(
						'No apartments match your search.',
						'booking-suite'
					) }
				</p>
				<p className="bks-grid__state-text">
					{ __(
						'Try a smaller party size, or different dates.',
						'booking-suite'
					) }
				</p>
			</div>
		);
	}

	return (
		<>
			<p className="bks-sr-only" role="status">
				{ sprintf(
					/* translators: %d: number of apartments found. */
					_n(
						'%d apartment found',
						'%d apartments found',
						apartments.length,
						'booking-suite'
					),
					apartments.length
				) }
			</p>

			<div className="bks-grid" style={ style }>
				{ apartments.map( ( apartment ) => (
					<ApartmentCard
						key={ apartment.id }
						apartment={ apartment }
						locale={ locale }
						stay={ stay }
					/>
				) ) }
			</div>
		</>
	);
}
