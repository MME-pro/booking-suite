/**
 * Shape of an apartment, mirroring backend/schemas/mmebk_rooms.php.
 *
 * `id`, `created_at` and `updated_at` are owned by the database and never
 * appear in the form.
 */

import { sprintf, _n } from '@wordpress/i18n';

/** Matches RoomsTable::CLEANING_MINUTES. */
export const CLEANING_MINUTES = [ 30, 45, 60 ];

/** Matches the `colour` column default. */
export const DEFAULT_COLOUR = '#3858e9';

/** varchar(191) on `name` and both short links. */
export const MAX_LENGTH_191 = 191;

/** varchar(500) on the subscription's `url` column. */
export const MAX_LENGTH_URL = 500;

/** `capacity` is smallint unsigned; one guest is the column default. */
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 65535;

export const cleaningOptions = () =>
	CLEANING_MINUTES.map( ( minutes ) => ( {
		value: String( minutes ),
		label: sprintf(
			/* translators: %d: cleaning turnaround in minutes. */
			_n( '%d minute', '%d minutes', minutes, 'booking-suite' ),
			minutes
		),
	} ) );

/** Nights starting Fri or Sat take the weekend rate; Sun–Thu the weekday one. */
export const WEEKEND_DAYS_LABEL = 'Fri/Sat';
export const WEEKDAY_DAYS_LABEL = 'Sun–Thu';

export const emptyApartment = () => ( {
	name: '',
	description: '',
	images: [],
	capacity: String( MIN_CAPACITY ),
	colour: DEFAULT_COLOUR,
	internalShortLink: '',
	bookingShortLink: '',
	holidayHesse: false,
	cleaningMin: String( CLEANING_MINUTES[ 0 ] ),
	weekdayRate: '0.00',
	weekendRate: '0.00',

	// 20.00 is what the site-wide surcharges carried before they moved onto
	// the apartment, so a new room starts where every existing one sits.
	surchargeHour: '20.00',
	surchargeGuest: '20.00',
	active: true,
	icalFeeds: [],
} );
