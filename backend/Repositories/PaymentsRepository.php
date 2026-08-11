<?php
/**
 * Data access for payments.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\BookingsTable;
use BookingSuite\Backend\Schemas\CustomersTable;
use BookingSuite\Backend\Schemas\PaymentsTable;

defined( 'ABSPATH' ) || exit;

final class PaymentsRepository {

	/**
	 * @param array<string, mixed> $data
	 *
	 * @return int|null Inserted id, or null when the insert failed.
	 */
	public static function create( array $data ): ?int {
		global $wpdb;

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			PaymentsTable::table(),
			array(
				'booking_id'          => (int) $data['booking_id'],
				'method'              => (string) ( $data['method'] ?? 'transfer' ),
				'status'              => (string) ( $data['status'] ?? 'pending' ),
				'amount'              => (float) ( $data['amount'] ?? 0 ),
				'currency'            => SettingsRepository::currency(),
				'proof_attachment_id' => empty( $data['proof_attachment_id'] )
					? null
					: (int) $data['proof_attachment_id'],
				'reference'           => (string) ( $data['reference'] ?? '' ),
				'paid_at'             => empty( $data['paid_at'] ) ? null : (string) $data['paid_at'],
				'notes'               => sanitize_textarea_field( (string) ( $data['notes'] ?? '' ) ),
				'created_at'          => $now,
				'updated_at'          => $now,
			),
			array( '%d', '%s', '%s', '%f', '%s', '%d', '%s', '%s', '%s', '%s', '%s' )
		);

		return false === $inserted ? null : (int) $wpdb->insert_id;
	}

	/**
	 * Every payment, newest first, with the booking and guest it belongs to.
	 *
	 * @param string $status Restrict to one payment status, or '' for all.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all( string $status = '' ): array {
		global $wpdb;

		$payments  = PaymentsTable::table();
		$bookings  = BookingsTable::table();
		$customers = CustomersTable::table();

		$sql = "SELECT p.*,
				b.reference AS booking_reference,
				b.payment_status AS booking_payment_status,
				b.total_amount AS booking_total,
				c.first_name, c.last_name, c.email
			FROM $payments p
			LEFT JOIN $bookings b ON b.id = p.booking_id
			LEFT JOIN $customers c ON c.id = b.customer_id";

		if ( '' !== $status && in_array( $status, PaymentsTable::STATUSES, true ) ) {
			$sql .= $wpdb->prepare( ' WHERE p.status = %s', $status );
		}

		$sql .= ' ORDER BY p.created_at DESC';

		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: array();

		return array_map( array( self::class, 'cast_with_booking' ), $rows );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$payments  = PaymentsTable::table();
		$bookings  = BookingsTable::table();
		$customers = CustomersTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT p.*,
					b.reference AS booking_reference,
					b.payment_status AS booking_payment_status,
					b.total_amount AS booking_total,
					c.first_name, c.last_name, c.email
				FROM $payments p
				LEFT JOIN $bookings b ON b.id = p.booking_id
				LEFT JOIN $customers c ON c.id = b.customer_id
				WHERE p.id = %d",
				$id
			),
			ARRAY_A
		);

		return $row ? self::cast_with_booking( $row ) : null;
	}

	/**
	 * Moves a payment along.
	 *
	 * Settling one stamps `paid_at` if it was not already set, so the date the
	 * money landed is recorded without asking the operator for it.
	 *
	 * @param int    $id
	 * @param string $status One of PaymentsTable::STATUSES.
	 *
	 * @return array<string, mixed>|null The stored payment, or null when missing.
	 */
	public static function set_status( int $id, string $status ): ?array {
		global $wpdb;

		$existing = self::find( $id );

		if ( null === $existing ) {
			return null;
		}

		$data = array(
			'status'     => $status,
			'updated_at' => current_time( 'mysql', true ),
		);

		if ( 'paid' === $status && '' === $existing['paidAt'] ) {
			$data['paid_at'] = current_time( 'mysql', true );
		}

		$wpdb->update( PaymentsTable::table(), $data, array( 'id' => $id ) );

		return self::find( $id );
	}

	/**
	 * Give a payment its invoice number, or return the one it already has.
	 *
	 * Numbers run PREFIX-YYYY-NNNN and restart each calendar year, which is
	 * what German bookkeeping expects. The sequence is read from the highest
	 * number already issued this year rather than from a counter, so it cannot
	 * drift out of step with what has actually been sent to guests.
	 *
	 * Assigning is a one-way step: an invoice that has been issued keeps its
	 * number for good, however many times the PDF is regenerated.
	 */
	public static function assign_invoice_number( int $id ): string {
		global $wpdb;

		$existing = self::find( $id );

		if ( null === $existing ) {
			return '';
		}

		if ( '' !== $existing['invoiceNo'] ) {
			return $existing['invoiceNo'];
		}

		$prefix = SettingsRepository::get( SettingsRepository::INVOICE_PREFIX );
		$prefix = '' !== trim( $prefix ) ? trim( $prefix ) : 'INV';
		$year   = ( new \DateTimeImmutable( 'now', wp_timezone() ) )->format( 'Y' );
		$stem   = $prefix . '-' . $year . '-';

		$table = PaymentsTable::table();

		$highest = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT invoice_no FROM $table WHERE invoice_no LIKE %s ORDER BY invoice_no DESC LIMIT 1",
				$wpdb->esc_like( $stem ) . '%'
			)
		);

		$next = '' === $highest
			? 1
			: (int) substr( $highest, strlen( $stem ) ) + 1;

		$number = $stem . str_pad( (string) $next, 4, '0', STR_PAD_LEFT );

		$wpdb->update(
			$table,
			array(
				'invoice_no' => $number,
				'updated_at' => current_time( 'mysql', true ),
			),
			array( 'id' => $id )
		);

		return $number;
	}

	/**
	 * Headline figures for the payments screen.
	 *
	 * Refunds are stored as negative amounts, so summing settled rows nets
	 * them off rather than counting them as income.
	 *
	 * @return array<string, float|int>
	 */
	public static function stats(): array {
		global $wpdb;

		$table = PaymentsTable::table();

		$rows = $wpdb->get_results(
			"SELECT status, COUNT(*) AS count, SUM(amount) AS total
			FROM $table GROUP BY status",
			ARRAY_A
		) ?: array();

		$stats = array(
			'total'    => 0,
			'settled'  => 0.0,
			'awaiting' => 0.0,
			'counts'   => array(),
		);

		foreach ( $rows as $row ) {
			$status = (string) $row['status'];
			$count  = (int) $row['count'];
			$amount = (float) $row['total'];

			$stats['total']            += $count;
			$stats['counts'][ $status ] = $count;

			if ( 'paid' === $status || 'refunded' === $status ) {
				$stats['settled'] += $amount;
			}

			if ( 'pending' === $status ) {
				$stats['awaiting'] += $amount;
			}
		}

		return $stats;
	}

	/**
	 * Payments recorded against a booking, newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function for_booking( int $booking_id ): array {
		global $wpdb;

		$table = PaymentsTable::table();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE booking_id = %d ORDER BY created_at DESC",
				$booking_id
			),
			ARRAY_A
		) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	/**
	 * A payment plus the booking and guest it belongs to, for the list screen.
	 *
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast_with_booking( array $row ): array {
		$name = trim(
			(string) ( $row['first_name'] ?? '' ) . ' ' . (string) ( $row['last_name'] ?? '' )
		);

		return self::cast( $row ) + array(
			'bookingId'            => (int) $row['booking_id'],
			'bookingReference'     => (string) ( $row['booking_reference'] ?? '' ),
			'bookingPaymentStatus' => (string) ( $row['booking_payment_status'] ?? '' ),
			'bookingTotal'         => (float) ( $row['booking_total'] ?? 0 ),
			'customerName'         => $name,
			'customerEmail'        => (string) ( $row['email'] ?? '' ),
			'invoiceNo'            => (string) ( $row['invoice_no'] ?? '' ),
		);
	}

	private static function cast( array $row ): array {
		$attachment_id = (int) ( $row['proof_attachment_id'] ?? 0 );

		return array(
			'id'        => (int) $row['id'],
			'method'    => (string) $row['method'],
			'status'    => (string) $row['status'],
			'amount'    => (float) $row['amount'],
			'currency'  => (string) $row['currency'],
			'reference' => (string) ( $row['reference'] ?? '' ),
			'paidAt'    => (string) ( $row['paid_at'] ?? '' ),
			'notes'     => (string) ( $row['notes'] ?? '' ),
			'proof'     => $attachment_id
				? array(
					'id'   => $attachment_id,
					'url'  => (string) wp_get_attachment_url( $attachment_id ),
					'mime' => (string) get_post_mime_type( $attachment_id ),
				)
				: null,
			'createdAt' => (string) $row['created_at'],
		);
	}
}
