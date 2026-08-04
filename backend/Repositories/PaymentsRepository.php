<?php
/**
 * Data access for payments.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

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
