<?php
/**
 * Data access for payments.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Schemas\BookingEventsTable;
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

		$now = current_time( 'mysql' );

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

		if ( false === $inserted ) {
			return null;
		}

		$id = (int) $wpdb->insert_id;

		BookingEventsRepository::record(
			(int) $data['booking_id'],
			BookingEventsTable::PAYMENT_RECORDED,
			array(
				'payment_id' => $id,
				'changes'    => array(
					'amount' => array(
						'from' => '',
						'to'   => number_format( (float) ( $data['amount'] ?? 0 ), 2, '.', '' ),
					),
					'status' => array(
						'from' => '',
						'to'   => (string) ( $data['status'] ?? 'pending' ),
					),
				),
				'note'       => (string) ( $data['notes'] ?? '' ),
			)
		);

		return $id;
	}

	/**
	 * What a booking's payment status is, given what has been settled.
	 *
	 * The one place this is decided. Every screen that shows a booking's
	 * money — the badge, the line under the total, the Payments ledger — reads
	 * the same answer from here, because two copies of this sum are two answers
	 * waiting to disagree, and they did.
	 *
	 * Half a cent of tolerance: transfers arrive rounded, and a booking stuck
	 * on "partial" for ever over half a cent is worse than one that calls
	 * itself settled.
	 *
	 * @param float $paid  What has actually come in.
	 * @param float $total What is owed.
	 */
	public static function state_for( float $paid, float $total ): string {
		$difference = round( $paid - $total, 2 );

		if ( $difference > 0.005 ) {
			return 'overpaid';
		}

		if ( $difference > -0.005 ) {
			return $paid > 0 ? 'paid' : 'unpaid';
		}

		return $paid > 0 ? 'partial' : 'unpaid';
	}

	/**
	 * Put a booking's payment status back in step with its payments.
	 *
	 * Called after anything that changes what has been settled — recording a
	 * payment, marking one off, deleting one. A booking left marked paid for
	 * money no longer recorded anywhere is the one state nobody can reconcile
	 * against a bank statement.
	 *
	 * @return string The status the booking now carries.
	 */
	public static function resync_booking( int $booking_id ): string {
		$booking = BookingsRepository::find( $booking_id );

		if ( null === $booking ) {
			return '';
		}

		$state = self::state_for(
			self::settled_for( $booking_id ),
			(float) ( $booking['total'] ?? 0 )
		);

		// Through the repository, so the change leaves a trace like every other
		// edit to a booking rather than being the one silent one.
		BookingsRepository::update( $booking_id, array( 'payment_status' => $state ) );

		return $state;
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
			'updated_at' => current_time( 'mysql' ),
		);

		if ( 'paid' === $status && '' === $existing['paidAt'] ) {
			$data['paid_at'] = current_time( 'mysql' );
		}

		$wpdb->update( PaymentsTable::table(), $data, array( 'id' => $id ) );

		if ( $status !== (string) $existing['status'] ) {
			BookingEventsRepository::record(
				(int) $existing['bookingId'],
				BookingEventsTable::PAYMENT_STATUS,
				array(
					'payment_id' => $id,
					'changes'    => array(
						'status' => array(
							'from' => (string) $existing['status'],
							'to'   => $status,
						),
					),
				)
			);
		}

		return self::find( $id );
	}

	/**
	 * What has actually been settled against a booking.
	 *
	 * Refunds are stored as negative amounts, so summing the settled rows nets
	 * them off rather than counting them as income.
	 */
	public static function settled_for( int $booking_id ): float {
		$paid = 0.0;

		foreach ( self::for_booking( $booking_id ) as $payment ) {
			if ( 'paid' === ( $payment['status'] ?? '' ) ) {
				$paid += (float) ( $payment['amount'] ?? 0 );
			}
		}

		return round( $paid, 2 );
	}

	/**
	 * The booking's outstanding payment request, if one is waiting.
	 *
	 * A booking carries at most one unsettled row at a time: when the price
	 * changes again before the guest has paid, the existing request is amended
	 * rather than a second one raised beside it.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function pending_for( int $booking_id ): ?array {
		foreach ( self::for_booking( $booking_id ) as $payment ) {
			if ( 'pending' === ( $payment['status'] ?? '' ) ) {
				return self::find( (int) $payment['id'] );
			}
		}

		return null;
	}

	/**
	 * Change what an unsettled payment asks for.
	 *
	 * This rewrites the row in place, on purpose: the guest is being asked for
	 * one amount, not handed a second request beside the first. But it means
	 * the figure they were originally quoted exists nowhere afterwards, which
	 * is exactly the sort of thing they ring up about — so the old amount goes
	 * into the history on the way past.
	 */
	public static function set_amount( int $id, float $amount ): void {
		global $wpdb;

		$existing = self::find( $id );

		$wpdb->update(
			PaymentsTable::table(),
			array(
				'amount'     => round( $amount, 2 ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id ),
			array( '%f', '%s' ),
			array( '%d' )
		);

		$was = null === $existing ? null : number_format( (float) $existing['amount'], 2, '.', '' );
		$now = number_format( round( $amount, 2 ), 2, '.', '' );

		if ( null !== $existing && $was !== $now ) {
			BookingEventsRepository::record(
				(int) $existing['bookingId'],
				BookingEventsTable::PAYMENT_AMENDED,
				array(
					'payment_id' => $id,
					'changes'    => array(
						'amount' => array(
							'from' => $was,
							'to'   => $now,
						),
					),
				)
			);
		}
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
	/**
	 * Fix the VAT rate this invoice is drawn at.
	 *
	 * Written once and then left alone: an invoice that has gone to a guest is
	 * a document, and a rate that changed underneath it would silently reissue
	 * different paper under the same number. Re-drawing at a different rate is
	 * a credit note and a new invoice, which is a decision rather than an edit.
	 *
	 * @param int   $id   The payment carrying the invoice.
	 * @param float $rate The rate as a percentage — 7, not 0.07.
	 */
	public static function set_tax_rate( int $id, float $rate ): bool {
		global $wpdb;

		$existing = self::find( $id );

		if ( null === $existing || null !== ( $existing['taxRate'] ?? null ) ) {
			return false;
		}

		return false !== $wpdb->update(
			PaymentsTable::table(),
			array(
				'tax_rate'   => max( 0.0, min( 100.0, $rate ) ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id ),
			array( '%f', '%s' ),
			array( '%d' )
		);
	}

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

		/*
		 * A counter set in Settings raises the floor — for a business carrying
		 * numbering over from whatever it invoiced with before. It can only push
		 * the sequence forward: letting it pull numbers back would mean issuing
		 * a number that has already been sent to someone.
		 */
		$floor = (int) SettingsRepository::get( SettingsRepository::INVOICE_COUNTER );

		if ( $floor > $next ) {
			$next = $floor;
		}

		$number = $stem . str_pad( (string) $next, 4, '0', STR_PAD_LEFT );

		$wpdb->update(
			$table,
			array(
				'invoice_no' => $number,
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $id )
		);

		BookingEventsRepository::record(
			(int) $existing['bookingId'],
			BookingEventsTable::INVOICE_ISSUED,
			array(
				'payment_id' => $id,
				'note'       => $number,
			)
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
			/*
			 * Null until an invoice is drawn, which is what lets Invoice
			 * tell "never invoiced" from "invoiced at zero per cent".
			 */
			'taxRate'   => null === ( $row['tax_rate'] ?? null ) ? null : (float) $row['tax_rate'],
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

	/**
	 * Remove a payment, and put the booking's totals back.
	 *
	 * A payment is not a record of itself — it is part of what a booking has
	 * been paid. Deleting the row without recalculating would leave a booking
	 * marked paid for money that is no longer recorded anywhere, which is the
	 * one state nobody can reconcile against a bank statement.
	 *
	 * @param int $id The payment.
	 * @return bool Whether the row went.
	 */
	public static function delete( int $id ): bool {
		global $wpdb;

		$payment = self::find( $id );

		if ( null === $payment ) {
			return false;
		}

		$gone = (bool) $wpdb->delete( PaymentsTable::table(), array( 'id' => $id ), array( '%d' ) );

		if ( ! $gone ) {
			return false;
		}

		self::resync_booking( (int) $payment['bookingId'] );

		return true;
	}}
