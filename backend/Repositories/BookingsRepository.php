<?php
/**
 * Data access for bookings.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BlocksTable;
use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\CustomersTable;
use BookingSuite\Backend\Schemas\ExtraBookingTable;
use BookingSuite\Backend\Schemas\ExtrasTable;
use BookingSuite\Backend\Schemas\PaymentsTable;

defined( 'ABSPATH' ) || exit;

final class BookingsRepository {

	/**
	 * Statuses that occupy the apartment.
	 *
	 * A pending request is not among them: until it is reserved or approved it
	 * holds nothing, so the slot stays open to other guests. Approving one is
	 * what takes the dates off the board.
	 */
	private const BLOCKING_STATUSES = array( 'reserved', 'confirmed' );

	/**
	 * Whether the apartment is free for the whole window.
	 *
	 * Ranges touch rather than overlap when one ends exactly as the other
	 * begins, so a same-day changeover stays bookable.
	 */
	public static function is_available( int $apartment_id, string $starts_at, string $ends_at, ?int $ignore_booking_id = null ): bool {
		global $wpdb;

		$bookings = BookingsTable::table();
		$statuses = implode( ',', array_fill( 0, count( self::BLOCKING_STATUSES ), '%s' ) );

		$params = array_merge(
			array( $apartment_id ),
			self::BLOCKING_STATUSES,
			array( $ends_at, $starts_at, $ignore_booking_id ?? 0 )
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$clash = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM $bookings
				WHERE room_id = %d
				  AND status IN ($statuses)
				  AND starts_at < %s
				  AND ends_at > %s
				  AND id <> %d
				LIMIT 1",
				$params
			)
		);

		if ( null !== $clash ) {
			return false;
		}

		$blocks = BlocksTable::table();

		// A block with no room_id is a central block covering everything.
		$blocked = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM $blocks
				WHERE (room_id = %d OR room_id IS NULL)
				  AND starts_at < %s
				  AND ends_at > %s
				LIMIT 1",
				$apartment_id,
				$ends_at,
				$starts_at
			)
		);

		return null === $blocked;
	}

	/**
	 * @param array<string, mixed> $data
	 *
	 * @return int|null Inserted id, or null when the insert failed.
	 */
	public static function create( array $data ): ?int {
		global $wpdb;

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			BookingsTable::table(),
			array(
				'reference'      => self::unique_reference(),
				'room_id'        => (int) $data['room_id'],
				'customer_id'    => isset( $data['customer_id'] ) ? (int) $data['customer_id'] : null,
				'status'         => 'pending',
				'payment_status' => 'unpaid',
				'guests'         => (int) $data['guests'],
				'starts_at'      => (string) $data['starts_at'],
				'ends_at'        => (string) $data['ends_at'],
				'total_amount'   => (float) $data['total_amount'],
				'currency'       => SettingsRepository::currency(),
				'source'         => 'website',
				'notes'          => sanitize_textarea_field( (string) ( $data['notes'] ?? '' ) ),
				'created_at'     => $now,
				'updated_at'     => $now,
			),
			array( '%s', '%d', '%d', '%s', '%s', '%d', '%s', '%s', '%f', '%s', '%s', '%s', '%s', '%s' )
		);

		return false === $inserted ? null : (int) $wpdb->insert_id;
	}

	/**
	 * Whether moving a booking to this status would take the dates off the
	 * board.
	 */
	public static function status_blocks( string $status ): bool {
		return in_array( $status, self::BLOCKING_STATUSES, true );
	}

	/**
	 * Change the booking status, the payment status, or both.
	 *
	 * @param array{status?: string, payment_status?: string} $data
	 */
	public static function update_state( int $id, array $data ): bool {
		global $wpdb;

		$fields  = array();
		$formats = array();

		if ( ! empty( $data['status'] ) ) {
			$fields['status'] = (string) $data['status'];
			$formats[]        = '%s';
		}

		if ( ! empty( $data['payment_status'] ) ) {
			$fields['payment_status'] = (string) $data['payment_status'];
			$formats[]                = '%s';
		}

		if ( ! $fields ) {
			return true;
		}

		$fields['updated_at'] = current_time( 'mysql', true );
		$formats[]            = '%s';

		return false !== $wpdb->update(
			BookingsTable::table(),
			$fields,
			array( 'id' => $id ),
			$formats,
			array( '%d' )
		);
	}

	/**
	 * Attach the chosen extras, pricing them at today's rate.
	 *
	 * @param array<int, array{id: int, quantity: int, price: float}> $extras
	 */
	public static function attach_extras( int $booking_id, array $extras ): void {
		global $wpdb;

		$now = current_time( 'mysql', true );

		foreach ( $extras as $extra ) {
			$wpdb->insert(
				ExtraBookingTable::table(),
				array(
					'booking_id' => $booking_id,
					'extra_id'   => $extra['id'],
					'quantity'   => $extra['quantity'],
					'unit_price' => $extra['price'],
					'created_at' => $now,
				),
				array( '%d', '%d', '%d', '%f', '%s' )
			);
		}
	}

	/**
	 * Every booking, with the guest and apartment already resolved.
	 *
	 * @param array{search?: string, status?: string, payment_status?: string} $args
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all( array $args = array() ): array {
		global $wpdb;

		$bookings  = BookingsTable::table();
		$customers = CustomersTable::table();

		$where  = array( '1=1' );
		$params = array();

		if ( ! empty( $args['status'] ) ) {
			$where[]  = 'b.status = %s';
			$params[] = (string) $args['status'];
		}

		if ( ! empty( $args['payment_status'] ) ) {
			$where[]  = 'b.payment_status = %s';
			$params[] = (string) $args['payment_status'];
		}

		if ( ! empty( $args['search'] ) ) {
			$like     = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
			$where[]  = '( b.reference LIKE %s OR p.post_title LIKE %s OR c.email LIKE %s OR CONCAT( c.first_name, " ", c.last_name ) LIKE %s )';
			$params   = array_merge( $params, array( $like, $like, $like, $like ) );
		}

		$payments = PaymentsTable::table();

		// The newest payment row carries the receipt the guest uploaded.
		$sql = "SELECT b.*,
				p.post_title AS apartment_name,
				c.first_name, c.last_name, c.email, c.phone,
				( SELECT pay.proof_attachment_id
					FROM $payments pay
					WHERE pay.booking_id = b.id AND pay.proof_attachment_id IS NOT NULL
					ORDER BY pay.created_at DESC
					LIMIT 1 ) AS proof_attachment_id
			FROM $bookings b
			LEFT JOIN {$wpdb->posts} p ON p.ID = b.room_id
			LEFT JOIN $customers c ON c.id = b.customer_id
			WHERE " . implode( ' AND ', $where ) . '
			ORDER BY b.created_at DESC';

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $params
			? $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A )
			: $wpdb->get_results( $sql, ARRAY_A );

		return array_map( array( self::class, 'cast' ), $rows ?: array() );
	}

	/**
	 * Counts by status, for the summary tiles.
	 *
	 * @return array<string, int>
	 */
	public static function counts(): array {
		global $wpdb;

		$table = BookingsTable::table();

		$rows = $wpdb->get_results(
			"SELECT status, COUNT(*) AS total FROM $table GROUP BY status",
			ARRAY_A
		) ?: array();

		$counts = array( 'all' => 0 );

		foreach ( $rows as $row ) {
			$counts[ $row['status'] ] = (int) $row['total'];
			$counts['all']           += (int) $row['total'];
		}

		return $counts;
	}

	/**
	 * The extras attached to a booking.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function extras_for( int $booking_id ): array {
		global $wpdb;

		$link   = ExtraBookingTable::table();
		$extras = ExtrasTable::table();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT l.quantity, l.unit_price, e.name
				FROM $link l
				LEFT JOIN $extras e ON e.id = l.extra_id
				WHERE l.booking_id = %d",
				$booking_id
			),
			ARRAY_A
		) ?: array();

		return array_map(
			static fn( array $row ): array => array(
				'name'     => (string) ( $row['name'] ?? '' ),
				'quantity' => (int) $row['quantity'],
				'price'    => (float) $row['unit_price'],
			),
			$rows
		);
	}

	/**
	 * Cast one joined row.
	 *
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$name          = trim( ( $row['first_name'] ?? '' ) . ' ' . ( $row['last_name'] ?? '' ) );
		$attachment_id = (int) ( $row['proof_attachment_id'] ?? 0 );

		return array(
			'paymentProof' => $attachment_id
				? array(
					'id'   => $attachment_id,
					'url'  => (string) wp_get_attachment_url( $attachment_id ),
					'mime' => (string) get_post_mime_type( $attachment_id ),
				)
				: null,
			'id'            => (int) $row['id'],
			'reference'     => (string) ( $row['reference'] ?? '' ),
			'apartmentId'   => (int) $row['room_id'],
			'apartmentName' => (string) ( $row['apartment_name'] ?? '' ),
			'customerId'    => null === $row['customer_id'] ? null : (int) $row['customer_id'],
			'customerName'  => $name,
			'customerEmail' => (string) ( $row['email'] ?? '' ),
			'customerPhone' => (string) ( $row['phone'] ?? '' ),
			'status'        => (string) $row['status'],
			'paymentStatus' => (string) $row['payment_status'],
			'guests'        => (int) $row['guests'],
			'startsAt'      => (string) $row['starts_at'],
			'endsAt'        => (string) $row['ends_at'],
			'total'         => (float) $row['total_amount'],
			'currency'      => (string) $row['currency'],
			'source'        => (string) $row['source'],
			'notes'         => (string) ( $row['notes'] ?? '' ),
			'createdAt'     => (string) $row['created_at'],
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$table = BookingsTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Human-facing booking number, checked for collisions.
	 */
	private static function unique_reference(): string {
		global $wpdb;

		$table = BookingsTable::table();

		do {
			$reference = 'BKS-' . strtoupper( wp_generate_password( 6, false, false ) );

			$taken = $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM $table WHERE reference = %s LIMIT 1", $reference )
			);
		} while ( null !== $taken );

		return $reference;
	}
}
