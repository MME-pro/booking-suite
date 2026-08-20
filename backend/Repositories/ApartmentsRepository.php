<?php
/**
 * Data access for apartments.
 *
 * An apartment is a bks_apartment post joined to one row in mmebk_apartments:
 * the post owns title, content, permalink and featured image; the table owns
 * every field the booking engine reads.
 *
 * The method contract has not changed since the fields lived elsewhere, so the
 * REST controllers, the meta box and the React admin app are unaffected.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Schemas\ApartmentsTable;
use WP_Post;

defined( 'ABSPATH' ) || exit;

final class ApartmentsRepository {

	private const STATUSES = array( 'publish', 'draft', 'pending', 'private' );

	/**
	 * Columns a caller may write, with their $wpdb format.
	 */
	private const WRITABLE = array(
		'capacity'            => '%d',
		'colour'              => '%s',
		'cleaning_min'        => '%d',
		'weekday_rate'        => '%f',
		'weekend_rate'        => '%f',
		'holiday_hesse'       => '%d',
		'active'              => '%d',
		'internal_short_link' => '%s',
		'booking_short_link'  => '%s',
		'images'              => '%s',
	);

	/**
	 * @param array{search?: string, active?: bool|null, orderby?: string, order?: string} $args
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public static function all( array $args = array() ): array {
		global $wpdb;

		$table  = ApartmentsTable::table();
		$where  = array( 'p.post_type = %s' );
		$params = array( ApartmentPostType::POST_TYPE );

		$statuses = implode( ',', array_fill( 0, count( self::STATUSES ), '%s' ) );
		$where[]  = "p.post_status IN ($statuses)";
		$params   = array_merge( $params, self::STATUSES );

		if ( ! empty( $args['search'] ) ) {
			$where[]  = 'p.post_title LIKE %s';
			$params[] = '%' . $wpdb->esc_like( (string) $args['search'] ) . '%';
		}

		if ( isset( $args['active'] ) && null !== $args['active'] ) {
			$where[]  = 'a.active = %d';
			$params[] = $args['active'] ? 1 : 0;
		}

		// Whitelisted because ORDER BY cannot be parameterised.
		$orderby = match ( $args['orderby'] ?? '' ) {
			'capacity'   => 'a.capacity',
			'created_at' => 'p.post_date_gmt',
			default      => 'p.post_title',
		};

		$order = 'DESC' === strtoupper( $args['order'] ?? '' ) ? 'DESC' : 'ASC';

		$sql = "SELECT p.ID, p.post_title, p.post_content, p.post_date_gmt, p.post_modified_gmt, a.*
			FROM {$wpdb->posts} p
			INNER JOIN $table a ON a.post_id = p.ID
			WHERE " . implode( ' AND ', $where ) . "
			ORDER BY $orderby $order";

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A ) ?: array();

		return array_map( array( self::class, 'cast' ), $rows );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( int $id ): ?array {
		global $wpdb;

		$post = get_post( $id );

		if ( ! $post instanceof WP_Post || ApartmentPostType::POST_TYPE !== $post->post_type ) {
			return null;
		}

		$table = ApartmentsTable::table();

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE post_id = %d", $id ),
			ARRAY_A
		);

		if ( null === $row ) {
			// A post created straight from wp-admin has no row yet.
			self::ensure_row( $id );

			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM $table WHERE post_id = %d", $id ),
				ARRAY_A
			) ?: array();
		}

		return self::cast(
			array_merge(
				$row,
				array(
					'ID'                => $post->ID,
					'post_title'        => $post->post_title,
					'post_content'      => $post->post_content,
					'post_date_gmt'     => $post->post_date_gmt,
					'post_modified_gmt' => $post->post_modified_gmt,
				)
			)
		);
	}

	/**
	 * @param array<string, mixed> $data
	 *
	 * @return int|null Inserted id, or null when the insert failed.
	 */
	public static function create( array $data ): ?int {
		$id = wp_insert_post(
			array(
				'post_type'    => ApartmentPostType::POST_TYPE,
				'post_status'  => 'publish',
				'post_title'   => (string) ( $data['name'] ?? '' ),
				'post_content' => (string) ( $data['description'] ?? '' ),
			),
			true
		);

		if ( is_wp_error( $id ) ) {
			return null;
		}

		self::ensure_row( (int) $id );
		self::write( (int) $id, $data );

		return (int) $id;
	}

	/**
	 * @param array<string, mixed> $data
	 */
	public static function update( int $id, array $data ): bool {
		$post = array( 'ID' => $id );

		if ( array_key_exists( 'name', $data ) ) {
			$post['post_title'] = (string) $data['name'];
		}

		if ( array_key_exists( 'description', $data ) ) {
			$post['post_content'] = (string) $data['description'];
		}

		if ( count( $post ) > 1 && is_wp_error( wp_update_post( $post, true ) ) ) {
			return false;
		}

		self::ensure_row( $id );

		return self::write( $id, $data );
	}

	public static function delete( int $id ): bool {
		// The row is removed by the deleted_post hook in ApartmentPostType.
		return (bool) wp_delete_post( $id, true );
	}

	/**
	 * Guarantee a row exists for a post, using the column defaults.
	 */
	public static function ensure_row( int $post_id ): void {
		global $wpdb;

		$table = ApartmentsTable::table();

		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT post_id FROM $table WHERE post_id = %d", $post_id )
		);

		if ( null !== $exists ) {
			return;
		}

		$now = current_time( 'mysql', true );

		$wpdb->insert(
			$table,
			array(
				'post_id'    => $post_id,
				'images'     => wp_json_encode( array() ),
				'created_at' => $now,
				'updated_at' => $now,
			),
			array( '%d', '%s', '%s', '%s' )
		);
	}

	public static function delete_row( int $post_id ): void {
		global $wpdb;

		$wpdb->delete( ApartmentsTable::table(), array( 'post_id' => $post_id ), array( '%d' ) );
	}

	/**
	 * This apartment's calendar-export secret, creating one if it has none.
	 *
	 * The token is minted on demand rather than with the apartment, so an
	 * apartment whose calendar is never published never has a live public URL
	 * at all. Once minted it is stable: the operator gives the link to a portal
	 * and the portal keeps reading it, so changing it without being asked would
	 * silently break the connection.
	 */
	public static function ensure_token( int $post_id ): string {
		global $wpdb;

		self::ensure_row( $post_id );

		$table = ApartmentsTable::table();

		$token = (string) $wpdb->get_var(
			$wpdb->prepare( "SELECT ical_token FROM $table WHERE post_id = %d", $post_id )
		);

		if ( '' !== $token ) {
			return $token;
		}

		return self::reset_token( $post_id );
	}

	/**
	 * The apartment's export secret, or '' when it has never been asked for.
	 *
	 * The read-only counterpart of ensure_token(): listing the apartments on a
	 * screen should not quietly publish the ones nobody has published.
	 */
	public static function token( int $post_id ): string {
		global $wpdb;

		$table = ApartmentsTable::table();

		return (string) $wpdb->get_var(
			$wpdb->prepare( "SELECT ical_token FROM $table WHERE post_id = %d", $post_id )
		);
	}

	/**
	 * Mint a new secret, invalidating the old link.
	 *
	 * The way to revoke a calendar that has been shared too widely: every
	 * portal still holding the previous URL stops being able to read it, and
	 * has to be given the new one.
	 */
	public static function reset_token( int $post_id ): string {
		global $wpdb;

		// 32 hex characters from the CSPRNG. This is a bearer credential on a
		// public URL, so it is generated the way a password would be.
		$token = bin2hex( random_bytes( 16 ) );

		$wpdb->update(
			ApartmentsTable::table(),
			array(
				'ical_token' => $token,
				'updated_at' => current_time( 'mysql', true ),
			),
			array( 'post_id' => $post_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		return $token;
	}

	/**
	 * The apartment a calendar token belongs to, or null.
	 *
	 * Deliberately narrow: it returns the id alone, because the only caller is
	 * the public feed and nothing there should be handed a whole apartment row.
	 */
	public static function find_by_token( string $token ): ?int {
		global $wpdb;

		// Cheap rejection before touching the database — every real token is
		// exactly 32 hex characters.
		if ( ! preg_match( '/^[a-f0-9]{32}$/', $token ) ) {
			return null;
		}

		$table = ApartmentsTable::table();

		$post_id = $wpdb->get_var(
			$wpdb->prepare( "SELECT post_id FROM $table WHERE ical_token = %s", $token )
		);

		return null === $post_id ? null : (int) $post_id;
	}

	/**
	 * Whether a short link is already taken by a different apartment.
	 */
	public static function short_link_taken( string $column, string $value, ?int $ignore_id = null ): bool {
		global $wpdb;

		if ( ! in_array( $column, array( 'internal_short_link', 'booking_short_link' ), true ) ) {
			return false;
		}

		$table = ApartmentsTable::table();

		// $column is whitelisted directly above.
		$sql = $wpdb->prepare(
			"SELECT post_id FROM $table WHERE $column = %s AND post_id <> %d LIMIT 1",
			$value,
			$ignore_id ?? 0
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return null !== $wpdb->get_var( $sql );
	}

	/**
	 * Write the columns present in $data; absent keys are left alone.
	 *
	 * @param array<string, mixed> $data
	 */
	private static function write( int $post_id, array $data ): bool {
		global $wpdb;

		$values  = array();
		$formats = array();

		foreach ( self::WRITABLE as $column => $format ) {
			if ( ! array_key_exists( $column, $data ) ) {
				continue;
			}

			$value = $data[ $column ];

			if ( 'images' === $column ) {
				$images = array_values( array_filter( array_map( 'absint', (array) $value ) ) );

				$value = wp_json_encode( $images );

				// Mirror the first photo onto the featured image so Elementor
				// and theme templates need no extra setup.
				if ( $images ) {
					set_post_thumbnail( $post_id, $images[0] );
				} else {
					delete_post_thumbnail( $post_id );
				}
			} elseif ( '%d' === $format ) {
				$value = (int) $value;
			} elseif ( '%f' === $format ) {
				$value = max( 0, (float) $value );
			} else {
				$value = (string) $value;

				// NULL rather than '' so the UNIQUE keys tolerate "not set".
				if ( '' === $value && str_contains( $column, 'short_link' ) ) {
					$value = null;
				}
			}

			$values[ $column ] = $value;
			$formats[]         = $format;
		}

		if ( ! $values ) {
			return true;
		}

		$values['updated_at'] = current_time( 'mysql', true );
		$formats[]            = '%s';

		return false !== $wpdb->update(
			ApartmentsTable::table(),
			$values,
			array( 'post_id' => $post_id ),
			$formats,
			array( '%d' )
		);
	}

	/**
	 * One joined row => the array shape the rest of the plugin expects.
	 *
	 * @param array<string, mixed> $row
	 *
	 * @return array<string, mixed>
	 */
	private static function cast( array $row ): array {
		$id     = (int) $row['ID'];
		$images = json_decode( (string) ( $row['images'] ?? '' ), true );

		return array(
			'id'                  => $id,
			'name'                => (string) $row['post_title'],
			'description'         => (string) $row['post_content'],
			'images'              => is_array( $images ) ? array_map( 'absint', $images ) : array(),
			'capacity'            => (int) ( $row['capacity'] ?? 1 ),
			'colour'              => (string) ( $row['colour'] ?? ApartmentsTable::DEFAULT_COLOUR ),
			'internal_short_link' => (string) ( $row['internal_short_link'] ?? '' ),
			'booking_short_link'  => (string) ( $row['booking_short_link'] ?? '' ),
			'holiday_hesse'       => (bool) ( $row['holiday_hesse'] ?? false ),
			'cleaning_min'        => (int) ( $row['cleaning_min'] ?? 30 ),
			'weekday_rate'        => (float) ( $row['weekday_rate'] ?? 0 ),
			'weekend_rate'        => (float) ( $row['weekend_rate'] ?? 0 ),
			'active'              => (bool) ( $row['active'] ?? true ),
			'permalink'           => (string) get_permalink( $id ),
			'created_at'          => (string) $row['post_date_gmt'],
			'updated_at'          => (string) $row['post_modified_gmt'],
		);
	}
}
