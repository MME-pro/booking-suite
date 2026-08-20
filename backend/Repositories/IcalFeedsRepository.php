<?php
/**
 * Data access for calendar subscriptions.
 *
 * A feed is one apartment plus one .ics URL published by a portal. Pulling it
 * is IcalImporter's job; this class only stores the subscription and the
 * outcome of the last pull.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\IcalFeedsTable;

defined( 'ABSPATH' ) || exit;

final class IcalFeedsRepository {

	/** Outcome of the last pull. */
	public const STATUS_OK = 'ok';

	public const STATUS_ERROR = 'error';

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public static function all(): array {
		global $wpdb;

		$table = IcalFeedsTable::table();
		$posts = $wpdb->posts;

		$rows = $wpdb->get_results(
			"SELECT f.*, p.post_title AS apartment_name
			FROM $table f
			LEFT JOIN $posts p ON p.ID = f.room_id
			ORDER BY p.post_title ASC, f.name ASC",
			ARRAY_A
		) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * Feeds a scheduled sync should pull: switched on, and pointing somewhere.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function due(): array {
		return array_values(
			array_filter(
				self::all(),
				static fn( array $feed ): bool => $feed['active'] && '' !== $feed['url']
			)
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$table = IcalFeedsTable::table();
		$posts = $wpdb->posts;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT f.*, p.post_title AS apartment_name
				FROM $table f
				LEFT JOIN $posts p ON p.ID = f.room_id
				WHERE f.id = %d",
				$id
			),
			ARRAY_A
		);

		return $row ? self::cast( $row ) : null;
	}

	/**
	 * Every subscription belonging to one apartment, oldest first.
	 *
	 * The order matters only in that it is stable: the apartment form lists
	 * these as rows the operator edits in place, and a list that reshuffled
	 * itself between saves would move a row out from under them.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function for_apartment( int $apartment_id ): array {
		global $wpdb;

		$table = IcalFeedsTable::table();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT f.*, p.post_title AS apartment_name
				FROM $table f
				LEFT JOIN {$wpdb->posts} p ON p.ID = f.room_id
				WHERE f.room_id = %d
				ORDER BY f.id ASC",
				$apartment_id
			),
			ARRAY_A
		) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * Whether another feed already subscribes this apartment to this URL.
	 *
	 * Two subscriptions to the same URL for the same apartment would fight over
	 * the same locks on every sync, so the controller refuses the second.
	 */
	public static function exists( int $apartment_id, string $url, int $ignore_id = 0 ): bool {
		global $wpdb;

		$table = IcalFeedsTable::table();

		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM $table
				WHERE room_id = %d AND url = %s AND id <> %d
				LIMIT 1",
				$apartment_id,
				$url,
				$ignore_id
			)
		);
	}

	/**
	 * @param array<string, mixed> $values
	 *
	 * @return int|null The new id, or null when the insert failed.
	 */
	public static function create( array $values ): ?int {
		global $wpdb;

		$now = current_time( 'mysql', true );

		$inserted = $wpdb->insert(
			IcalFeedsTable::table(),
			array(
				'room_id'    => (int) ( $values['room_id'] ?? 0 ),
				'name'       => substr( (string) ( $values['name'] ?? '' ), 0, 191 ),
				'url'        => substr( (string) ( $values['url'] ?? '' ), 0, 500 ),
				'source'     => (string) ( $values['source'] ?? 'other' ),
				'active'     => empty( $values['active'] ) ? 0 : 1,
				'created_at' => $now,
				'updated_at' => $now,
			)
		);

		return false === $inserted ? null : (int) $wpdb->insert_id;
	}

	/**
	 * Partial update — only the keys present are written.
	 *
	 * @param array<string, mixed> $values
	 */
	public static function update( int $id, array $values ): bool {
		global $wpdb;

		$data = array();

		if ( array_key_exists( 'room_id', $values ) ) {
			$data['room_id'] = (int) $values['room_id'];
		}

		if ( array_key_exists( 'name', $values ) ) {
			$data['name'] = substr( (string) $values['name'], 0, 191 );
		}

		if ( array_key_exists( 'url', $values ) ) {
			$data['url'] = substr( (string) $values['url'], 0, 500 );
		}

		if ( array_key_exists( 'source', $values ) ) {
			$data['source'] = (string) $values['source'];
		}

		if ( array_key_exists( 'active', $values ) ) {
			$data['active'] = empty( $values['active'] ) ? 0 : 1;
		}

		if ( ! $data ) {
			return true;
		}

		$data['updated_at'] = current_time( 'mysql', true );

		return false !== $wpdb->update( IcalFeedsTable::table(), $data, array( 'id' => $id ) );
	}

	/**
	 * Record how the last pull went.
	 *
	 * The event count is only meaningful for a pull that worked, so a failure
	 * leaves the previous one showing rather than resetting it to zero — "42
	 * events, last seen an hour ago, now failing" is more use than "0 events".
	 */
	public static function record_sync(
		int $id,
		string $status,
		string $message,
		?int $event_count = null
	): void {
		global $wpdb;

		$data = array(
			'last_sync_at' => current_time( 'mysql', true ),
			'last_status'  => $status,
			'last_message' => substr( $message, 0, 255 ),
			'updated_at'   => current_time( 'mysql', true ),
		);

		if ( null !== $event_count ) {
			$data['last_event_count'] = $event_count;
		}

		$wpdb->update( IcalFeedsTable::table(), $data, array( 'id' => $id ) );
	}

	public static function delete( int $id ): bool {
		global $wpdb;

		return (bool) $wpdb->delete( IcalFeedsTable::table(), array( 'id' => $id ) );
	}

	/**
	 * Drop every subscription belonging to an apartment.
	 *
	 * Called when the apartment itself is deleted. Left behind, these rows keep
	 * being pulled on every scheduled sync — writing locks for a room nobody
	 * can see, against a portal listing that is no longer anything to do with
	 * this site — and no screen shows them, because every screen lists them by
	 * the apartment they belong to.
	 *
	 * @return int How many were removed.
	 */
	public static function delete_for_apartment( int $apartment_id ): int {
		global $wpdb;

		return (int) $wpdb->delete(
			IcalFeedsTable::table(),
			array( 'room_id' => $apartment_id ),
			array( '%d' )
		);
	}

	/**
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		return array(
			'id'             => (int) $row['id'],
			'apartmentId'    => (int) $row['room_id'],
			'apartmentName'  => (string) ( $row['apartment_name'] ?? '' ),
			'name'           => (string) $row['name'],
			'url'            => (string) $row['url'],
			'source'         => (string) $row['source'],
			'active'         => (bool) $row['active'],
			'lastSyncAt'     => empty( $row['last_sync_at'] ) ? '' : (string) $row['last_sync_at'],
			'lastStatus'     => (string) $row['last_status'],
			'lastMessage'    => (string) $row['last_message'],
			'lastEventCount' => (int) $row['last_event_count'],
			'createdAt'      => (string) $row['created_at'],
		);
	}
}
