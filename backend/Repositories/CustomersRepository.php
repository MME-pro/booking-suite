<?php
/**
 * Data access for guests.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\CustomersTable;

defined( 'ABSPATH' ) || exit;

final class CustomersRepository {

	/**
	 * Guests with their history, newest booking first.
	 *
	 * The table carries denormalised `bookings_count`, `total_spent` and
	 * `last_booking_at` columns, but record_booking() — the only thing that
	 * maintains them — runs solely on the public booking path. A booking taken
	 * in the admin never touches them, so those columns understate any guest
	 * who has ever been booked in by hand. The figures below are therefore
	 * counted live from the bookings table, which is right whichever way the
	 * booking arrived.
	 *
	 * @param string $search Name, email or phone; '' for everyone.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all( string $search = '' ): array {
		global $wpdb;

		$customers = CustomersTable::table();
		$bookings  = BookingsTable::table();

		$sql = "SELECT c.*,
				COUNT( b.id ) AS live_bookings,
				COALESCE( SUM( b.total_amount ), 0 ) AS live_spent,
				MAX( b.starts_at ) AS live_last_stay
			FROM $customers c
			LEFT JOIN $bookings b ON b.customer_id = c.id";

		$params = array();

		if ( '' !== $search ) {
			$like = '%' . $wpdb->esc_like( $search ) . '%';

			$sql     .= ' WHERE ( CONCAT( c.first_name, " ", c.last_name ) LIKE %s
				OR c.email LIKE %s OR c.phone LIKE %s OR c.city LIKE %s )';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		$sql .= ' GROUP BY c.id ORDER BY live_last_stay DESC, c.last_name ASC';

		$rows = $params
			? $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A )
			: $wpdb->get_results( $sql, ARRAY_A );

		return array_map( array( self::class, 'cast' ), $rows ?: array() );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$customers = CustomersTable::table();
		$bookings  = BookingsTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT c.*,
					COUNT( b.id ) AS live_bookings,
					COALESCE( SUM( b.total_amount ), 0 ) AS live_spent,
					MAX( b.starts_at ) AS live_last_stay
				FROM $customers c
				LEFT JOIN $bookings b ON b.customer_id = c.id
				WHERE c.id = %d
				GROUP BY c.id",
				$id
			),
			ARRAY_A
		);

		return $row ? self::cast( $row ) : null;
	}

	/**
	 * One guest's stays, most recent first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function bookings_for( int $customer_id ): array {
		global $wpdb;

		$bookings = BookingsTable::table();
		$posts    = $wpdb->posts;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT b.*, p.post_title AS apartment_name
				FROM $bookings b
				LEFT JOIN $posts p ON p.ID = b.room_id
				WHERE b.customer_id = %d
				ORDER BY b.starts_at DESC",
				$customer_id
			),
			ARRAY_A
		) ?: array();

		return array_map(
			static fn( array $row ): array => array(
				'id'            => (int) $row['id'],
				'reference'     => (string) ( $row['reference'] ?? '' ),
				'apartmentName' => (string) ( $row['apartment_name'] ?? '' ),
				'status'        => (string) $row['status'],
				'paymentStatus' => (string) $row['payment_status'],
				'guests'        => (int) $row['guests'],
				'startsAt'      => (string) $row['starts_at'],
				'endsAt'        => (string) $row['ends_at'],
				'total'         => (float) $row['total_amount'],
				'currency'      => (string) $row['currency'],
				'createdAt'     => (string) $row['created_at'],
			),
			$rows
		);
	}

	/**
	 * Headline figures for the customers screen.
	 *
	 * @return array<string, float|int>
	 */
	public static function stats(): array {
		$customers = self::all();

		$repeat = 0;
		$spent  = 0.0;
		$stays  = 0;

		foreach ( $customers as $customer ) {
			$spent += (float) $customer['totalSpent'];
			$stays += (int) $customer['bookingsCount'];

			if ( $customer['bookingsCount'] > 1 ) {
				$repeat++;
			}
		}

		$total = count( $customers );

		return array(
			'total'   => $total,
			'repeat'  => $repeat,
			'spent'   => round( $spent, 2 ),
			'average' => $total ? round( $spent / $total, 2 ) : 0.0,
			'stays'   => $stays,
		);
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$name = trim(
			(string) $row['first_name'] . ' ' . (string) $row['last_name']
		);

		return array(
			'id'            => (int) $row['id'],
			'firstName'     => (string) $row['first_name'],
			'lastName'      => (string) $row['last_name'],
			'name'          => $name,
			'email'         => (string) ( $row['email'] ?? '' ),
			'phone'         => (string) ( $row['phone'] ?? '' ),
			'company'       => (string) ( $row['company'] ?? '' ),
			'city'          => (string) ( $row['city'] ?? '' ),
			'country'       => (string) ( $row['country'] ?? '' ),
			'language'      => (string) ( $row['language'] ?? '' ),
			'notes'         => (string) ( $row['notes'] ?? '' ),
			'bookingsCount' => (int) ( $row['live_bookings'] ?? 0 ),
			'totalSpent'    => (float) ( $row['live_spent'] ?? 0 ),
			'lastStayAt'    => (string) ( $row['live_last_stay'] ?? '' ),
			'createdAt'     => (string) $row['created_at'],
		);
	}

	/**
	 * Find the guest by email, or create one.
	 *
	 * Email carries a UNIQUE key, so returning the existing row keeps a
	 * repeat guest as a single record with their history intact.
	 *
	 * @param array<string, mixed> $data
	 */
	public static function find_or_create( array $data ): ?int {
		global $wpdb;

		$table = CustomersTable::table();
		$email = sanitize_email( (string) ( $data['email'] ?? '' ) );

		if ( '' !== $email ) {
			$existing = $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM $table WHERE email = %s LIMIT 1", $email )
			);

			if ( null !== $existing ) {
				self::update( (int) $existing, $data );

				return (int) $existing;
			}
		}

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			$table,
			array(
				'first_name' => sanitize_text_field( (string) ( $data['first_name'] ?? '' ) ),
				'last_name'  => sanitize_text_field( (string) ( $data['last_name'] ?? '' ) ),
				'email'      => '' === $email ? null : $email,
				'phone'      => sanitize_text_field( (string) ( $data['phone'] ?? '' ) ),
				'address'    => sanitize_text_field( (string) ( $data['address'] ?? '' ) ),
				'postcode'   => sanitize_text_field( (string) ( $data['postcode'] ?? '' ) ),
				'city'       => sanitize_text_field( (string) ( $data['city'] ?? '' ) ),
				'country'    => strtoupper( substr( sanitize_text_field( (string) ( $data['country'] ?? '' ) ), 0, 2 ) ),
				'notes'      => sanitize_textarea_field( (string) ( $data['notes'] ?? '' ) ),
				'created_at' => $now,
				'updated_at' => $now,
			),
			array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' )
		);

		return false === $inserted ? null : (int) $wpdb->insert_id;
	}

	/**
	 * Refresh the contact details of a returning guest.
	 *
	 * @param array<string, mixed> $data
	 */
	private static function update( int $id, array $data ): void {
		global $wpdb;

		$fields = array();

		foreach ( array( 'first_name', 'last_name', 'phone', 'address', 'postcode', 'city' ) as $field ) {
			if ( ! empty( $data[ $field ] ) ) {
				$fields[ $field ] = sanitize_text_field( (string) $data[ $field ] );
			}
		}

		if ( ! $fields ) {
			return;
		}

		$fields['updated_at'] = current_time( 'mysql', true );

		$wpdb->update( CustomersTable::table(), $fields, array( 'id' => $id ) );
	}

	/**
	 * Roll the booking into the guest's history counters.
	 */
	public static function record_booking( int $customer_id, float $amount, string $booked_at ): void {
		global $wpdb;

		$table = CustomersTable::table();

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE $table
				SET bookings_count = bookings_count + 1,
					total_spent = total_spent + %f,
					last_booking_at = %s,
					updated_at = %s
				WHERE id = %d",
				$amount,
				$booked_at,
				current_time( 'mysql', true ),
				$customer_id
			)
		);
	}
}
