/**
 * ApartmentsToolbar — search, status filter and the add action.
 */

import { __ } from '@wordpress/i18n';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FILTERS = [
	{ value: 'all', label: __( 'All', 'booking-suite' ) },
	{ value: 'active', label: __( 'Active', 'booking-suite' ) },
	{ value: 'inactive', label: __( 'Inactive', 'booking-suite' ) },
];

export default function ApartmentsToolbar( {
	search,
	onSearchChange,
	statusFilter = 'all',
	onStatusFilterChange,
	onAddApartment,
	count = null,
} ) {
	return (
		<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={ search }
						onChange={ ( event ) =>
							onSearchChange( event.target.value )
						}
						aria-label={ __(
							'Search apartments',
							'booking-suite'
						) }
						placeholder={ __( 'Search by name…', 'booking-suite' ) }
						className="w-full pl-8 sm:w-64"
					/>
				</div>

				<Tabs
					value={ statusFilter }
					onValueChange={ onStatusFilterChange }
				>
					<TabsList>
						{ FILTERS.map( ( { value, label } ) => (
							<TabsTrigger key={ value } value={ value }>
								{ label }
							</TabsTrigger>
						) ) }
					</TabsList>
				</Tabs>
			</div>

			<div className="flex items-center gap-3">
				{ count && (
					<span className="text-xs text-muted-foreground">
						{ count }
					</span>
				) }
				<Button onClick={ onAddApartment }>
					<Plus className="h-4 w-4" />
					{ __( 'Add Apartment', 'booking-suite' ) }
				</Button>
			</div>
		</div>
	);
}
