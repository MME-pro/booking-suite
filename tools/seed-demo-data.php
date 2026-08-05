<?php
/**
 * Fills the database with believable demo data.
 *
 *   php tools/seed-demo-data.php                  # add to what is already there
 *   php tools/seed-demo-data.php --fresh          # empty the tables first
 *   php tools/seed-demo-data.php --apartments     # also create apartments if none exist
 *
 * What it makes:
 *   · customers with real-looking names, emails and cities
 *   · extras with a mix of unlimited and limited stock, one deactivated
 *   · bookings spread from six weeks ago to eight weeks out, overnight and
 *     hourly, across every status and payment status
 *   · extras attached to bookings, including two that deliberately collide so
 *     the per-window availability rules have something to bite on
 *   · a payment per booking, matching that booking's payment status
 *
 * The dates are relative to today, so the calendar always has something in the
 * past, something in progress and something ahead of it.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

if ( 'cli' !== PHP_SAPI ) {
	exit( 'Run this from the command line.' . PHP_EOL );
}

require_once __DIR__ . '/bootstrap.php';

use BookingSuite\Backend\Installer;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\CustomersRepository;
use BookingSuite\Backend\Repositories\ExtrasRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\CustomersTable;
use BookingSuite\Backend\Schemas\ExtraBookingTable;
use BookingSuite\Backend\Schemas\ExtrasTable;
use BookingSuite\Backend\Schemas\PaymentsTable;

global $wpdb;

$flags          = array_slice( $argv, 1 );
$fresh          = in_array( '--fresh', $flags, true );
$make_apartments = in_array( '--apartments', $flags, true );

// Every value below is fixed rather than random, so two runs are comparable
// and a bug found in seeded data can be reproduced.
Installer::install();

if ( $fresh ) {
	foreach (
		array(
			ExtraBookingTable::table(),
			PaymentsTable::table(),
			BookingsTable::table(),
			ExtrasTable::table(),
			CustomersTable::table(),
		) as $table
	) {
		$wpdb->query( "TRUNCATE TABLE $table" );
	}

	echo 'Emptied bookings, payments, extras, extra links and customers.' . PHP_EOL;
}

/* -------------------------------------------------------------------------
 * Apartments — used, not replaced. These are posts, so seeding them is opt-in.
 * ---------------------------------------------------------------------- */

$apartments = ApartmentsRepository::all();

if ( ! $apartments && $make_apartments ) {
	$demo = array(
		array( 'name' => 'City Suite', 'colour' => '#2a78d6', 'capacity' => 4, 'weekday_rate' => 120, 'weekend_rate' => 150 ),
		array( 'name' => 'Garden Room', 'colour' => '#1baf7a', 'capacity' => 2, 'weekday_rate' => 90, 'weekend_rate' => 110 ),
		array( 'name' => 'Attic Studio', 'colour' => '#eda100', 'capacity' => 3, 'weekday_rate' => 105, 'weekend_rate' => 130 ),
	);

	foreach ( $demo as $row ) {
		ApartmentsRepository::create(
			$row + array(
				'description'  => 'Demo apartment created by seed-demo-data.php.',
				'cleaning_min' => 45,
				'active'       => 1,
			)
		);
	}

	$apartments = ApartmentsRepository::all();

	printf( 'Created %d apartments.' . PHP_EOL, count( $apartments ) );
}

if ( ! $apartments ) {
	exit(
		'No apartments exist, so bookings would have nothing to point at.' . PHP_EOL
		. 'Add one in the admin, or re-run with --apartments.' . PHP_EOL
	);
}

$apartment_ids = array_map( static fn( array $a ): int => (int) $a['id'], $apartments );

/* -------------------------------------------------------------------------
 * Customers
 * ---------------------------------------------------------------------- */

$people = array(
	array( 'Lena', 'Hoffmann', 'lena.hoffmann@example.de', '+49 151 2345678', 'Frankfurt' ),
	array( 'Jonas', 'Weber', 'jonas.weber@example.de', '+49 160 8765432', 'Wiesbaden' ),
	array( 'Sofia', 'Bauer', 'sofia.bauer@example.de', '+49 171 5559182', 'Mainz' ),
	array( 'Mattis', 'Krüger', 'mattis.krueger@example.de', '+49 152 4471203', 'Darmstadt' ),
	array( 'Amelie', 'Schneider', 'amelie.schneider@example.de', '+49 176 3320981', 'Offenbach' ),
	array( 'Tobias', 'Fischer', 'tobias.fischer@example.de', '+49 157 9902114', 'Kassel' ),
	array( 'Clara', 'Wagner', 'clara.wagner@example.de', '+49 159 1120347', 'Gießen' ),
	array( 'Elias', 'Richter', 'elias.richter@example.de', '+44 7700 900412', 'London' ),
);

$customer_ids = array();

foreach ( $people as list( $first, $last, $email, $phone, $city ) ) {
	$id = CustomersRepository::find_or_create(
		array(
			'first_name' => $first,
			'last_name'  => $last,
			'email'      => $email,
			'phone'      => $phone,
			'city'       => $city,
			'country'    => 'London' === $city ? 'GB' : 'DE',
		)
	);

	if ( $id ) {
		$customer_ids[] = (int) $id;
	}
}

printf( 'Customers: %d.' . PHP_EOL, count( $customer_ids ) );

/* -------------------------------------------------------------------------
 * Extras — a deliberate spread of unlimited, plentiful and scarce.
 * ---------------------------------------------------------------------- */

$extra_specs = array(
	array( 'key' => 'breakfast', 'name' => 'Breakfast', 'price' => 12.50, 'stock' => null, 'sort' => 1, 'active' => true, 'description' => 'Served daily from 07:00 to 10:30.' ),
	array( 'key' => 'parking', 'name' => 'Parking space', 'price' => 8.00, 'stock' => 2, 'sort' => 2, 'active' => true, 'description' => 'Reserved space in the courtyard.' ),
	array( 'key' => 'projector', 'name' => 'Projector', 'price' => 25.00, 'stock' => 3, 'sort' => 3, 'active' => true, 'description' => 'Full HD, with HDMI and USB-C cables.' ),
	array( 'key' => 'bikes', 'name' => 'Bike hire', 'price' => 15.00, 'stock' => 4, 'sort' => 4, 'active' => true, 'description' => 'City bikes, helmet and lock included.' ),
	array( 'key' => 'late', 'name' => 'Late checkout', 'price' => 20.00, 'stock' => 1, 'sort' => 5, 'active' => true, 'description' => 'Stay until 15:00 instead of 11:00.' ),
	array( 'key' => 'hamper', 'name' => 'Welcome hamper', 'price' => 35.00, 'stock' => 6, 'sort' => 6, 'active' => false, 'description' => 'Local wine, bread and cheese. Off the menu for now.' ),
);

$extras = array();

foreach ( $extra_specs as $spec ) {
	$created = ExtrasRepository::create(
		array(
			'name'        => $spec['name'],
			'description' => $spec['description'],
			'price'       => $spec['price'],
			'stock'       => $spec['stock'],
			'sort_order'  => $spec['sort'],
			'active'      => $spec['active'],
			'room_ids'    => array(),
		)
	);

	if ( $created ) {
		$extras[ $spec['key'] ] = $created;
	}
}

printf( 'Extras: %d.' . PHP_EOL, count( $extras ) );

/* -------------------------------------------------------------------------
 * Bookings
 *
 * `days` is relative to today, so the set always straddles now. Overnight
 * stays run 15:00 → 11:00; hourly ones sit inside a single day.
 * ---------------------------------------------------------------------- */

$specs = array(
	// Behind us — the completed, settled end of the ledger.
	array( 'days' => -41, 'nights' => 3, 'guests' => 2, 'status' => 'completed', 'payment' => 'paid', 'extras' => array( 'breakfast' => 6 ), 'source' => 'website' ),
	array( 'days' => -27, 'hours' => 6, 'start' => '10:00', 'guests' => 8, 'status' => 'completed', 'payment' => 'paid', 'extras' => array( 'projector' => 1 ), 'source' => 'admin' ),
	array( 'days' => -18, 'nights' => 2, 'guests' => 4, 'status' => 'completed', 'payment' => 'refunded', 'extras' => array( 'parking' => 1 ), 'source' => 'website' ),
	array( 'days' => -9, 'nights' => 4, 'guests' => 2, 'status' => 'completed', 'payment' => 'paid', 'extras' => array( 'breakfast' => 8, 'bikes' => 2 ), 'source' => 'website' ),

	// Around now — something for the calendar to show in progress.
	array( 'days' => -1, 'nights' => 3, 'guests' => 3, 'status' => 'confirmed', 'payment' => 'paid', 'extras' => array( 'late' => 1 ), 'source' => 'website' ),
	array( 'days' => 0, 'hours' => 8, 'start' => '09:00', 'guests' => 10, 'status' => 'confirmed', 'payment' => 'partial', 'extras' => array( 'projector' => 2 ), 'source' => 'admin' ),

	// Just ahead.
	array( 'days' => 3, 'nights' => 2, 'guests' => 2, 'status' => 'confirmed', 'payment' => 'paid', 'extras' => array( 'breakfast' => 4, 'parking' => 1 ), 'source' => 'website' ),
	array( 'days' => 6, 'nights' => 5, 'guests' => 4, 'status' => 'reserved', 'payment' => 'unpaid', 'extras' => array( 'bikes' => 2 ), 'source' => 'website' ),
	array( 'days' => 9, 'hours' => 4, 'start' => '13:00', 'guests' => 6, 'status' => 'pending', 'payment' => 'unpaid', 'extras' => array(), 'source' => 'website' ),

	/*
	 * These two share a day on purpose. Between them they take all three
	 * projectors, so a third booking that day is offered none — which is the
	 * per-window availability rule doing its job rather than a bug.
	 */
	array( 'days' => 12, 'hours' => 5, 'start' => '09:00', 'guests' => 9, 'status' => 'confirmed', 'payment' => 'paid', 'extras' => array( 'projector' => 2 ), 'source' => 'admin' ),
	array( 'days' => 12, 'hours' => 5, 'start' => '10:00', 'guests' => 5, 'status' => 'reserved', 'payment' => 'unpaid', 'extras' => array( 'projector' => 1 ), 'source' => 'website' ),

	// Further out — the chase list.
	array( 'days' => 17, 'nights' => 3, 'guests' => 2, 'status' => 'pending', 'payment' => 'unpaid', 'extras' => array( 'breakfast' => 6 ), 'source' => 'website' ),
	array( 'days' => 24, 'nights' => 7, 'guests' => 4, 'status' => 'reserved', 'payment' => 'partial', 'extras' => array( 'parking' => 2, 'breakfast' => 14 ), 'source' => 'website' ),
	array( 'days' => 33, 'nights' => 2, 'guests' => 3, 'status' => 'pending', 'payment' => 'unpaid', 'extras' => array( 'late' => 1 ), 'source' => 'website' ),
	array( 'days' => 45, 'nights' => 4, 'guests' => 2, 'status' => 'confirmed', 'payment' => 'unpaid', 'extras' => array( 'bikes' => 1 ), 'source' => 'admin' ),
	array( 'days' => 56, 'nights' => 3, 'guests' => 5, 'status' => 'pending', 'payment' => 'unpaid', 'extras' => array(), 'source' => 'website' ),
);

$today = new DateTimeImmutable( 'today', new DateTimeZone( 'UTC' ) );

/** Roughly what a stay costs, so totals are not all identical. */
$nightly = 110.0;
$hourly  = 45.0;

$made     = 0;
$payments = 0;

foreach ( $specs as $index => $spec ) {
	$apartment_id = $apartment_ids[ $index % count( $apartment_ids ) ];
	$customer_id  = $customer_ids[ $index % count( $customer_ids ) ];

	$day = $today->modify( sprintf( '%+d days', (int) $spec['days'] ) );

	if ( isset( $spec['hours'] ) ) {
		$starts = $day->modify( $spec['start'] );
		$ends   = $starts->modify( sprintf( '+%d hours', (int) $spec['hours'] ) );
		$base   = $hourly * (int) $spec['hours'];
	} else {
		$starts = $day->modify( '15:00' );
		$ends   = $day->modify( sprintf( '+%d days', (int) $spec['nights'] ) )->modify( '11:00' );
		$base   = $nightly * (int) $spec['nights'];
	}

	// Extras are priced into the total, the way a real booking would be.
	$extras_total = 0.0;

	foreach ( $spec['extras'] as $key => $quantity ) {
		if ( isset( $extras[ $key ] ) ) {
			$extras_total += (float) $extras[ $key ]['price'] * (int) $quantity;
		}
	}

	$total = round( $base + $extras_total, 2 );

	$booking_id = BookingsRepository::create(
		array(
			'room_id'        => $apartment_id,
			'customer_id'    => $customer_id,
			'guests'         => (int) $spec['guests'],
			'starts_at'      => $starts->format( 'Y-m-d H:i:s' ),
			'ends_at'        => $ends->format( 'Y-m-d H:i:s' ),
			'total_amount'   => $total,
			'status'         => $spec['status'],
			'payment_status' => $spec['payment'],
			'source'         => $spec['source'],
			'notes'          => 0 === $index % 4 ? 'Arriving late, around 22:00.' : '',
		)
	);

	if ( ! $booking_id ) {
		continue;
	}

	$made++;

	$now = current_time( 'mysql', true );

	foreach ( $spec['extras'] as $key => $quantity ) {
		if ( ! isset( $extras[ $key ] ) ) {
			continue;
		}

		$wpdb->insert(
			ExtraBookingTable::table(),
			array(
				'booking_id' => $booking_id,
				'extra_id'   => (int) $extras[ $key ]['id'],
				'quantity'   => (int) $quantity,
				// Copied at booking time, so later price changes leave it alone.
				'unit_price' => (float) $extras[ $key ]['price'],
				'created_at' => $now,
			),
			array( '%d', '%d', '%d', '%f', '%s' )
		);
	}

	/*
	 * A payment for every booking, mirroring its payment status. The live
	 * booking flow only records one when the guest uploads a receipt or gives
	 * a date, so seeded data is deliberately fuller than reality here.
	 */
	$payment_status = array(
		'paid'     => 'paid',
		'partial'  => 'paid',
		'refunded' => 'refunded',
		'unpaid'   => 'pending',
	)[ $spec['payment'] ] ?? 'pending';

	$amount = $total;

	if ( 'partial' === $spec['payment'] ) {
		$amount = round( $total / 2, 2 );
	}

	if ( 'refunded' === $spec['payment'] ) {
		$amount = -$total;
	}

	$paid_at = in_array( $payment_status, array( 'paid', 'refunded' ), true )
		? $starts->modify( '-2 days' )->format( 'Y-m-d H:i:s' )
		: null;

	if ( PaymentsRepository::create(
		array(
			'booking_id' => $booking_id,
			'method'     => 0 === $index % 5 ? 'cash' : 'transfer',
			'status'     => $payment_status,
			'amount'     => $amount,
			'paid_at'    => $paid_at,
			'reference'  => 'SEED-' . str_pad( (string) $booking_id, 4, '0', STR_PAD_LEFT ),
			'notes'      => 'refunded' === $payment_status ? 'Guest cancelled; refunded in full.' : '',
		)
	) ) {
		$payments++;
	}
}

printf( 'Bookings: %d.' . PHP_EOL, $made );
printf( 'Payments: %d.' . PHP_EOL, $payments );
echo 'Done.' . PHP_EOL;
