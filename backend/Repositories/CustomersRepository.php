<?php
/**
 * Data access for guests.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\CustomersTable;

defined( 'ABSPATH' ) || exit;

final class CustomersRepository {

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
