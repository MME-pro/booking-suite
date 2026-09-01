<?php
/**
 * Data access for bookings.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Schemas\ApartmentsTable;
use BookingSuite\Backend\Schemas\BookingEventsTable;
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
	 * Cleaning turnaround per apartment, in minutes, for this request.
	 *
	 * @var array<int, int>
	 */
	private static array $cleaning = array();

	/**
	 * An occupied window grown by the apartment's turnaround at both ends.
	 *
	 * is_available() gets the same effect by widening the request instead; a
	 * caller holding a list of windows needs it baked into the windows.
	 *
	 * @return array{0: string, 1: string}
	 */
	private static function with_turnaround( int $apartment_id, string $starts_at, string $ends_at ): array {
		$cleaning = self::cleaning_minutes( $apartment_id );

		if ( 0 === $cleaning ) {
			return array( $starts_at, $ends_at );
		}

		$pad = $cleaning * MINUTE_IN_SECONDS;

		return array(
			gmdate( 'Y-m-d H:i:s', strtotime( $starts_at ) - $pad ),
			gmdate( 'Y-m-d H:i:s', strtotime( $ends_at ) + $pad ),
		);
	}

	/**
	 * How long the apartment needs between guests.
	 *
	 * The one place the buffer is read. It used to be a single site-wide
	 * setting, which meant three apartments configured for 60, 30 and 45
	 * minutes were all held to whichever number that setting carried.
	 *
	 * Cached for the request because the picker asks about one apartment
	 * dozens of times over — every start time in a day is its own
	 * is_available() call, and each would otherwise repeat this lookup.
	 *
	 * Read straight from the table rather than through ApartmentsRepository:
	 * one column by primary key, with no join to wp_posts for a name and a
	 * gallery that nothing here wants.
	 */
	private static function cleaning_minutes( int $apartment_id ): int {
		if ( isset( self::$cleaning[ $apartment_id ] ) ) {
			return self::$cleaning[ $apartment_id ];
		}

		global $wpdb;

		$table = ApartmentsTable::table();

		$minutes = $wpdb->get_var(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"SELECT cleaning_min FROM $table WHERE post_id = %d",
				$apartment_id
			)
		);

		// No row means no apartment; the caller is about to find that out for
		// itself, and inventing a buffer here would only mask it.
		self::$cleaning[ $apartment_id ] = null === $minutes ? 0 : max( 0, (int) $minutes );

		return self::$cleaning[ $apartment_id ];
	}

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

		/*
		 * Turnaround time — cleaning between one guest and the next.
		 *
		 * It is applied by widening the window being tested rather than by
		 * padding the stored bookings, so the gap is required on both sides of
		 * the request and nothing about what is stored has to change. Widening
		 * both ends is also what puts the buffer before an overnight check-in
		 * as well as after a departure, counted back from 16:00.
		 */
		$cleaning = self::cleaning_minutes( $apartment_id );

		if ( $cleaning > 0 ) {
			$starts_at = gmdate( 'Y-m-d H:i:s', strtotime( $starts_at ) - $cleaning * MINUTE_IN_SECONDS );
			$ends_at   = gmdate( 'Y-m-d H:i:s', strtotime( $ends_at ) + $cleaning * MINUTE_IN_SECONDS );
		}

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

		/*
		 * A block with no room_id is a central block covering every apartment.
		 *
		 * `extra_id IS NULL` is what keeps this to apartment locks: an extra's
		 * lock also carries no room_id, and without this guard locking a single
		 * projector would close the whole property to bookings.
		 */
		$blocked = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM $blocks
				WHERE extra_id IS NULL
				  AND (room_id = %d OR room_id IS NULL)
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
	 * Everything that occupies the given apartments between two moments.
	 *
	 * The bulk counterpart to is_available(): two queries for any number of
	 * apartments and any number of candidate windows, instead of one query per
	 * apartment per window. Asking "is this apartment free at any point today"
	 * means testing every start time in the day, and doing that a query at a
	 * time turns one filtered page into a hundred round trips.
	 *
	 * Blocking bookings and apartment locks are merged into one list per
	 * apartment, because a caller looking for a free gap does not care which of
	 * the two closed it. Master locks — no room_id — are folded into every
	 * apartment's list, and `extra_id IS NULL` keeps an extra's lock from
	 * closing the whole property, exactly as in is_available().
	 *
	 * Every window comes back grown by that apartment's cleaning turnaround,
	 * for the same reason: a gap too short to clean in is not a gap. Without it
	 * this returned bookable what is_available() then refused, and the search
	 * bar offered an apartment whose every slot the booking modal rejected.
	 *
	 * @param int[]  $room_ids
	 * @param string $from 'Y-m-d H:i:s'.
	 * @param string $to   'Y-m-d H:i:s'.
	 *
	 * @return array<int, array<int, array{0: string, 1: string}>> Windows by apartment id.
	 */
	public static function busy_windows( array $room_ids, string $from, string $to ): array {
		global $wpdb;

		$room_ids = array_values( array_unique( array_map( 'absint', $room_ids ) ) );

		if ( ! $room_ids ) {
			return array();
		}

		$busy = array_fill_keys( $room_ids, array() );

		$ids      = implode( ',', array_fill( 0, count( $room_ids ), '%d' ) );
		$statuses = implode( ',', array_fill( 0, count( self::BLOCKING_STATUSES ), '%s' ) );

		$bookings = BookingsTable::table();

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT room_id, starts_at, ends_at FROM $bookings
				WHERE room_id IN ($ids)
				  AND status IN ($statuses)
				  AND starts_at < %s
				  AND ends_at > %s",
				array_merge( $room_ids, self::BLOCKING_STATUSES, array( $to, $from ) )
			),
			ARRAY_A
		) ?: array();

		foreach ( $rows as $row ) {
			$busy[ (int) $row['room_id'] ][] = self::with_turnaround(
				(int) $row['room_id'],
				$row['starts_at'],
				$row['ends_at']
			);
		}

		$blocks = BlocksTable::table();

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$locks = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT room_id, starts_at, ends_at FROM $blocks
				WHERE extra_id IS NULL
				  AND (room_id IN ($ids) OR room_id IS NULL)
				  AND starts_at < %s
				  AND ends_at > %s",
				array_merge( $room_ids, array( $to, $from ) )
			),
			ARRAY_A
		) ?: array();

		foreach ( $locks as $lock ) {
			if ( null === $lock['room_id'] ) {
				// A master lock closes every apartment in the list, and each
				// pads it by its own turnaround.
				foreach ( $room_ids as $id ) {
					$busy[ $id ][] = self::with_turnaround(
						$id,
						$lock['starts_at'],
						$lock['ends_at']
					);
				}

				continue;
			}

			$busy[ (int) $lock['room_id'] ][] = self::with_turnaround(
				(int) $lock['room_id'],
				$lock['starts_at'],
				$lock['ends_at']
			);
		}

		return $busy;
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
				'status'         => (string) ( $data['status'] ?? 'pending' ),
				'payment_status' => (string) ( $data['payment_status'] ?? 'unpaid' ),
				'guests'         => (int) $data['guests'],
				'starts_at'      => (string) $data['starts_at'],
				'ends_at'        => (string) $data['ends_at'],
				'total_amount'   => (float) $data['total_amount'],
				'currency'       => SettingsRepository::currency(),
				'source'         => (string) ( $data['source'] ?? 'website' ),
				'notes'          => sanitize_textarea_field( (string) ( $data['notes'] ?? '' ) ),
				'created_at'     => $now,
				'updated_at'     => $now,
			),
			array( '%s', '%d', '%d', '%s', '%s', '%d', '%s', '%s', '%f', '%s', '%s', '%s', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return null;
		}

		$id = (int) $wpdb->insert_id;

		BookingEventsRepository::record( $id, BookingEventsTable::CREATED );

		return $id;
	}

	/**
	 * Whether moving a booking to this status would take the dates off the
	 * board.
	 */
	public static function status_blocks( string $status ): bool {
		return in_array( $status, self::BLOCKING_STATUSES, true );
	}

	/**
	 * Columns an update may write, with their $wpdb format.
	 */
	private const EDITABLE = array(
		'room_id'        => '%d',
		'customer_id'    => '%d',
		'status'         => '%s',
		'payment_status' => '%s',
		'guests'         => '%d',
		'starts_at'      => '%s',
		'ends_at'        => '%s',
		'total_amount'   => '%f',
		'notes'          => '%s',
	);

	/**
	 * Write the columns present in $data; absent keys are left alone.
	 *
	 * @param array<string, mixed> $data
	 */
	public static function update( int $id, array $data ): bool {
		global $wpdb;

		$fields  = array();
		$formats = array();

		foreach ( self::EDITABLE as $column => $format ) {
			if ( ! array_key_exists( $column, $data ) || '' === $data[ $column ] ) {
				continue;
			}

			$value = $data[ $column ];

			$fields[ $column ] = match ( $format ) {
				'%d'    => (int) $value,
				'%f'    => (float) $value,
				default => (string) $value,
			};

			$formats[] = $format;
		}

		if ( ! $fields ) {
			return true;
		}

		/*
		 * Read before writing. This is the only moment the old values still
		 * exist anywhere — a second later the row holds the new ones and what
		 * the booking used to say is gone for good.
		 */
		$before = self::raw( $id );

		$fields['updated_at'] = current_time( 'mysql', true );
		$formats[]            = '%s';

		$written = false !== $wpdb->update(
			BookingsTable::table(),
			$fields,
			array( 'id' => $id ),
			$formats,
			array( '%d' )
		);

		if ( $written && null !== $before ) {
			BookingEventsRepository::record(
				$id,
				BookingEventsTable::UPDATED,
				array( 'changes' => BookingEventsRepository::diff( $before, $fields ) )
			);
		}

		return $written;
	}

	/**
	 * A booking's own columns, unjoined and uncast.
	 *
	 * find() resolves the guest and the apartment and renames everything into
	 * camelCase, which is right for the API and wrong for a diff: the history
	 * compares against the columns an update actually writes.
	 *
	 * @return array<string, mixed>|null
	 */
	private static function raw( int $id ): ?array {
		global $wpdb;

		$table = BookingsTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Change the booking status, the payment status, or both.
	 *
	 * @param array{status?: string, payment_status?: string} $data
	 */
	public static function update_state( int $id, array $data ): bool {
		return self::update( $id, $data );
	}

	/**
	 * Erase a booking and everything hanging off it.
	 *
	 * A hard delete, by design, and the only one in the plugin. A booking that
	 * happened and then fell through is CANCELLED, which keeps the record and
	 * frees the dates; this is for the ones that were never real — a test
	 * booking, a duplicate, a request typed in twice — where there is nothing
	 * worth keeping and an operator who asks for it has already been asked
	 * whether they mean it.
	 *
	 * The extras lines and the payments go with it. Both are read through the
	 * booking they belong to and nothing looks them up any other way, so
	 * leaving them behind would leave rows that no screen can reach, that the
	 * revenue reports would still count, and that would claim invoice numbers
	 * for a stay that no longer exists.
	 *
	 * The uploaded receipt is left in the media library. It is an attachment
	 * like any other, it may be in use elsewhere, and removing files from under
	 * the library is not something a booking should decide.
	 *
	 * The history goes too. It is a record of what happened to THIS booking,
	 * and once the booking is gone there is no screen that could reach it and
	 * nothing it could be read against.
	 */
	public static function delete( int $id ): bool {
		global $wpdb;

		BookingEventsRepository::delete_for_booking( $id );

		$wpdb->delete( ExtraBookingTable::table(), array( 'booking_id' => $id ), array( '%d' ) );
		$wpdb->delete( PaymentsTable::table(), array( 'booking_id' => $id ), array( '%d' ) );

		return false !== $wpdb->delete( BookingsTable::table(), array( 'id' => $id ), array( '%d' ) );
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

			/*
			 * Which of the two billing models this stay is, decided here rather
			 * than guessed at by whoever is drawing it.
			 *
			 * The admin form worked it out from "does it span two dates", which
			 * is the same mistake the pricing engine used to make: an hourly
			 * visit from 22:00 to 02:00 spans two dates and is not a night. It
			 * loaded into the overnight fields and repriced accordingly.
			 */
			'mode'          => RateCalculator::is_overnight_window(
				(string) $row['starts_at'],
				(string) $row['ends_at']
			) ? 'overnight' : 'hourly',
			'total'         => (float) $row['total_amount'],
			'currency'      => (string) $row['currency'],
			'source'        => (string) $row['source'],
			'notes'         => (string) ( $row['notes'] ?? '' ),
			'createdAt'     => (string) $row['created_at'],
		);
	}

	/**
	 * One booking, in the same shape as all() — guest and apartment resolved,
	 * keys in camelCase. Callers must never have to know which one they got.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$bookings  = BookingsTable::table();
		$customers = CustomersTable::table();
		$payments  = PaymentsTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT b.*,
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
				WHERE b.id = %d",
				$id
			),
			ARRAY_A
		);

		return $row ? self::cast( $row ) : null;
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
