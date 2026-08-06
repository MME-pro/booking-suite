/**
 * Root component.
 *
 * PHP decides which screen is being rendered and passes the name through
 * `window.bookingSuiteAdmin.view`; this component maps that to a page. When
 * more screens are added, register them in VIEWS — no routing library needed
 * while every screen has its own admin URL.
 *
 * The screen title lives in the app bar, following the reference design, so
 * pages start straight in on their own content.
 */

import { __ } from '@wordpress/i18n';

import { AppBar } from './components';
import { ApartmentsPage } from './pages/Apartments';
import { BookingsPage } from './pages/Bookings';
import { AvailabilityPage } from './pages/Availability';
import { CalendarPage } from './pages/Calendar';
import { DashboardPage } from './pages/Dashboard';
import { CustomersPage } from './pages/Customers';
import { EmailTemplatesPage } from './pages/EmailTemplates';
import { ExtrasPage } from './pages/Extras';
import { GuidePage } from './pages/Guide';
import { PaymentsPage } from './pages/Payments';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { settings } from './settings';
import './App.css';

const VIEWS = {
	dashboard: {
		title: __( 'Dashboard', 'booking-suite' ),
		Component: DashboardPage,
	},
	apartments: {
		title: __( 'Apartments', 'booking-suite' ),
		Component: ApartmentsPage,
	},
	bookings: {
		title: __( 'Bookings', 'booking-suite' ),
		Component: BookingsPage,
	},
	payments: {
		title: __( 'Payments', 'booking-suite' ),
		Component: PaymentsPage,
	},
	customers: {
		title: __( 'Customers', 'booking-suite' ),
		Component: CustomersPage,
	},
	reports: {
		title: __( 'Reports & Analytics', 'booking-suite' ),
		Component: ReportsPage,
	},
	calendar: {
		title: __( 'Calendar', 'booking-suite' ),
		Component: CalendarPage,
	},
	availability: {
		title: __( 'Availability', 'booking-suite' ),
		Component: AvailabilityPage,
	},
	extras: {
		title: __( 'Extras', 'booking-suite' ),
		Component: ExtrasPage,
	},
	emailTemplates: {
		title: __( 'Email Templates', 'booking-suite' ),
		Component: EmailTemplatesPage,
	},
	settings: {
		title: __( 'Settings', 'booking-suite' ),
		Component: SettingsPage,
	},
	guide: {
		title: __( 'User Guide', 'booking-suite' ),
		Component: GuidePage,
	},
};

export default function App() {
	const view = VIEWS[ settings.view ];

	if ( ! view ) {
		return (
			<div className="bks-app">
				<AppBar title={ __( 'Booking Suite', 'booking-suite' ) } />
				<div className="bks-app__body bks-app__body--unknown">
					<p>
						{ __(
							'Unknown Booking Suite screen.',
							'booking-suite'
						) }
					</p>
				</div>
			</div>
		);
	}

	const { title, Component } = view;

	return (
		<div className="bks-app">
			<AppBar title={ title } />
			<div className="bks-app__body">
				<Component />
			</div>
		</div>
	);
}
