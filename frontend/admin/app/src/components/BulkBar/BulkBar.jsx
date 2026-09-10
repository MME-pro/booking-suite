/**
 * What to do with the rows that are ticked.
 *
 * Sits directly above the list rather than floating over it. A bar pinned to
 * the bottom of the window covers the last row of the very table it is acting
 * on — and on a phone that row is often the one the operator just ticked.
 *
 * It takes the space whether or not anything is selected, so the table does
 * not jump down the page on the first tick.
 */

import { __, _n, sprintf } from '@wordpress/i18n';
import { Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * @param {Object}   props
 * @param {number}   props.count         How many rows are ticked.
 * @param {Function} props.onClear       Untick everything.
 * @param {Function} props.onDelete      Delete the ticked rows.
 * @param {boolean}  [props.isBusy]      A bulk action is running.
 * @param {string}   [props.deleteLabel] Overrides the button's wording.
 * @return {JSX.Element} The bar.
 */
export default function BulkBar( {
	count,
	onClear,
	onDelete,
	isBusy = false,
	deleteLabel = '',
} ) {
	return (
		<div
			className="flex min-h-9 flex-wrap items-center gap-2"
			role="status"
			aria-live="polite"
		>
			{ count > 0 && (
				<>
					<span className="text-sm font-medium">
						{ sprintf(
							/* translators: %d: how many rows are ticked. */
							_n(
								'%d selected',
								'%d selected',
								count,
								'booking-suite'
							),
							count
						) }
					</span>

					<Button
						type="button"
						size="sm"
						variant="destructive"
						disabled={ isBusy }
						onClick={ onDelete }
					>
						<Trash2 className="h-4 w-4" />
						{ deleteLabel || __( 'Delete', 'booking-suite' ) }
					</Button>

					<Button
						type="button"
						size="sm"
						variant="ghost"
						disabled={ isBusy }
						onClick={ onClear }
					>
						<X className="h-4 w-4" />
						{ __( 'Clear', 'booking-suite' ) }
					</Button>
				</>
			) }
		</div>
	);
}
