/**
 * QuickActions — the three things most often done from a standing start.
 *
 * A toolbar, not a card. Three buttons do not need a titled box around them,
 * and putting them at the top of the screen is the point: "Add Booking" is the
 * first thing an owner reaches for, so it should not be below two charts.
 *
 * Each screen has its own admin URL, so these are real navigations. The two
 * "add" links carry `action=new`, which the destination reads to open its form
 * immediately — otherwise the action would only take you to a list.
 */

import { __ } from '@wordpress/i18n';
import { CalendarDays, Building2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { settings } from '../../../../settings';

export default function QuickActions() {
	const actions = [
		{
			id: 'booking',
			label: __( 'Add Booking', 'booking-suite' ),
			href: settings.newBookingUrl,
			Icon: Plus,
			variant: 'default',
		},
		{
			id: 'apartment',
			label: __( 'Add Apartment', 'booking-suite' ),
			href: settings.newApartmentUrl,
			Icon: Building2,
			variant: 'outline',
		},
		{
			id: 'calendar',
			label: __( 'View Calendar', 'booking-suite' ),
			href: settings.calendarUrl,
			Icon: CalendarDays,
			variant: 'outline',
		},
	];

	return (
		<div className="flex flex-wrap items-center gap-2">
			{ actions.map( ( { id, label, href, Icon, variant } ) => (
				<Button key={ id } asChild variant={ variant } size="sm">
					{ /*
					 * no-underline: these are buttons that happen to be links,
					 * and wp-admin underlines every anchor.
					 */ }
					<a href={ href } className="no-underline">
						<Icon className="h-4 w-4" />
						{ label }
					</a>
				</Button>
			) ) }
		</div>
	);
}
