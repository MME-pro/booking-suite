/**
 * PaymentsFilters — status, method, a date range and a search box.
 *
 * The controls edit a DRAFT; nothing narrows the table until Filter is pressed
 * (or Enter, since this is a real form). That is deliberate: a half-typed date
 * would otherwise empty the table on every keystroke.
 */

import { __ } from '@wordpress/i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

/** Select cannot hold an empty value, so "any" stands in for one. */
export const ANY = 'any';

export const EMPTY_FILTERS = {
	status: ANY,
	method: ANY,
	from: '',
	to: '',
	search: '',
};

const label = ( value ) => String( value || '' ).replace( /_/g, ' ' );

export default function PaymentsFilters( {
	draft,
	onDraftChange,
	onApply,
	onClear,
	statuses,
	methods,
} ) {
	const set = ( key ) => ( value ) =>
		onDraftChange( { ...draft, [ key ]: value } );

	return (
		<form
			onSubmit={ ( event ) => {
				event.preventDefault();
				onApply();
			} }
			className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
		>
			<div className="flex flex-col gap-1.5">
				<Label
					htmlFor="bks-payments-status"
					className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{ __( 'Status', 'booking-suite' ) }
				</Label>
				<Select
					value={ draft.status }
					onValueChange={ set( 'status' ) }
				>
					<SelectTrigger
						id="bks-payments-status"
						className="w-[170px] capitalize"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ ANY }>
							{ __( 'All Statuses', 'booking-suite' ) }
						</SelectItem>
						{ statuses.map( ( value ) => (
							<SelectItem
								key={ value }
								value={ value }
								className="capitalize"
							>
								{ label( value ) }
							</SelectItem>
						) ) }
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label
					htmlFor="bks-payments-method"
					className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{ __( 'Payment method', 'booking-suite' ) }
				</Label>
				<Select
					value={ draft.method }
					onValueChange={ set( 'method' ) }
				>
					<SelectTrigger
						id="bks-payments-method"
						className="w-[170px] capitalize"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ ANY }>
							{ __( 'All Methods', 'booking-suite' ) }
						</SelectItem>
						{ methods.map( ( value ) => (
							<SelectItem
								key={ value }
								value={ value }
								className="capitalize"
							>
								{ label( value ) }
							</SelectItem>
						) ) }
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label
					htmlFor="bks-payments-from"
					className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{ __( 'From', 'booking-suite' ) }
				</Label>
				<Input
					id="bks-payments-from"
					type="date"
					value={ draft.from }
					onChange={ ( event ) =>
						set( 'from' )( event.target.value )
					}
					className="w-[170px]"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label
					htmlFor="bks-payments-to"
					className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
				>
					{ __( 'To', 'booking-suite' ) }
				</Label>
				<Input
					id="bks-payments-to"
					type="date"
					value={ draft.to }
					onChange={ ( event ) => set( 'to' )( event.target.value ) }
					className="w-[170px]"
				/>
			</div>

			<div className="flex flex-1 flex-col gap-1.5">
				<Label htmlFor="bks-payments-search" className="sr-only">
					{ __( 'Search transactions', 'booking-suite' ) }
				</Label>
				<Input
					id="bks-payments-search"
					type="search"
					value={ draft.search }
					onChange={ ( event ) =>
						set( 'search' )( event.target.value )
					}
					placeholder={ __(
						'Search transactions…',
						'booking-suite'
					) }
					className="min-w-[200px]"
				/>
			</div>

			<div className="flex items-center gap-2">
				<Button type="submit" variant="outline">
					{ __( 'Filter', 'booking-suite' ) }
				</Button>
				<Button type="button" variant="outline" onClick={ onClear }>
					{ __( 'Clear', 'booking-suite' ) }
				</Button>
			</div>
		</form>
	);
}
