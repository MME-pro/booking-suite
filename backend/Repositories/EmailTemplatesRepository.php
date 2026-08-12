<?php
/**
 * The transactional email templates.
 *
 * Stored in `mmebk_settings` under the `email` group rather than in a table of
 * their own: the key/value store already handles long values and is where the
 * rest of the plugin's configuration lives.
 *
 * Reads go straight to the table instead of through SettingsRepository, whose
 * cache is loaded on every request — email bodies have no business being there.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Repositories;

use BookingSuite\Backend\Schemas\SettingsTable;

defined( 'ABSPATH' ) || exit;

final class EmailTemplatesRepository {

	public const GROUP = 'email';

	/** Sent when a guest submits a booking request. */
	public const BOOKING_REQUEST = 'booking_request';

	/** Sent when the owner approves that request. */
	public const BOOKING_APPROVED = 'booking_approved';

	/** Sent when the payment is marked as received. */
	public const PAYMENT_RECEIVED = 'payment_received';

	/**
	 * Sent when a booking is amended after it was invoiced and there is more
	 * to pay — the guest who extends a three-hour stay to twelve.
	 */
	public const BALANCE_DUE = 'balance_due';

	/**
	 * @return string[]
	 */
	public static function keys(): array {
		return array(
			self::BOOKING_REQUEST,
			self::BOOKING_APPROVED,
			self::PAYMENT_RECEIVED,
			self::BALANCE_DUE,
		);
	}

	/**
	 * The placeholders every template may use, with a description for the
	 * editor. Anything not listed here is left in the text untouched.
	 *
	 * @return array<string, string>
	 */
	public static function placeholders(): array {
		return array(
			'{{guest_name}}'      => __( "The guest's full name", 'booking-suite' ),
			'{{guest_first_name}}' => __( 'Their first name only', 'booking-suite' ),
			'{{reference}}'       => __( 'Booking reference', 'booking-suite' ),
			'{{apartment}}'       => __( 'Apartment name', 'booking-suite' ),
			'{{check_in}}'        => __( 'Arrival date and time', 'booking-suite' ),
			'{{check_out}}'       => __( 'Departure date and time', 'booking-suite' ),
			'{{guests}}'          => __( 'Number of guests', 'booking-suite' ),
			'{{total}}'           => __( 'Booking total, with currency', 'booking-suite' ),
			'{{amount_paid}}'     => __( 'Settled so far, with currency', 'booking-suite' ),
			'{{amount_due}}'      => __( 'Still to pay, with currency', 'booking-suite' ),
			'{{invoice_no}}'      => __( 'Invoice number, once one is issued', 'booking-suite' ),
			'{{status}}'          => __( 'Booking status', 'booking-suite' ),
			'{{payment_status}}'  => __( 'Payment status', 'booking-suite' ),
			'{{site_name}}'       => __( 'Your site name', 'booking-suite' ),
			'{{site_url}}'        => __( 'Your site address', 'booking-suite' ),
		);
	}

	/**
	 * What each template says before anyone edits it.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function defaults(): array {
		return array(
			self::BOOKING_REQUEST  => array(
				'label'       => __( 'Booking request received', 'booking-suite' ),
				'description' => __(
					'Sent to the guest the moment they submit a booking request.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'We have your request — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>We have your request</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>Thank you for your request. We have it, and we will confirm it shortly.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>Guests</th><td>{{guests}}</td></tr>\n"
					. "<tr><th>Total</th><td>{{total}}</td></tr>\n"
					. "</table>\n"
					. "<p>Nothing is due yet — we will send payment details once the booking is confirmed.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
			self::BOOKING_APPROVED => array(
				'label'       => __( 'Booking confirmed', 'booking-suite' ),
				'description' => __(
					'Sent when a request is approved and the dates are held.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Your booking is confirmed — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>Your booking is confirmed</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>Good news — your booking is confirmed and the dates are yours.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>Guests</th><td>{{guests}}</td></tr>\n"
					. "<tr><th>Total</th><td>{{total}}</td></tr>\n"
					. "</table>\n"
					. "<blockquote>Please transfer the total using the reference above. We will confirm as soon as it arrives.</blockquote>\n"
					. "<p>We look forward to having you.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
			self::PAYMENT_RECEIVED => array(
				'label'       => __( 'Payment received', 'booking-suite' ),
				'description' => __(
					'Sent when a payment is marked as paid, in the admin or on the payments screen.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Payment received — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>Payment received</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>We have received your payment of <strong>{{total}}</strong>. Your stay is fully settled.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "</table>\n"
					. "<p>Your invoice is attached to this email.</p>\n"
					. "<p>Safe travels, and see you soon.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
			self::BALANCE_DUE      => array(
				'label'       => __( 'Balance due', 'booking-suite' ),
				'description' => __(
					'Sent when a booking is changed after it was invoiced and there is more to pay — a guest extending their stay, for instance.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Updated invoice — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>Your booking has changed</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>Your booking has been updated, and there is a balance still to pay. The new invoice is attached.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>New total</th><td>{{total}}</td></tr>\n"
					. "<tr><th>Already paid</th><td>{{amount_paid}}</td></tr>\n"
					. "<tr><th>Still to pay</th><td>{{amount_due}}</td></tr>\n"
					. "</table>\n"
					. "<blockquote>Please transfer <strong>{{amount_due}}</strong> using the reference above.</blockquote>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
		);
	}

	/**
	 * Every template, stored values merged over the defaults.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function all(): array {
		$stored    = self::stored();
		$templates = array();

		foreach ( self::defaults() as $key => $default ) {
			$templates[ $key ] = array(
				'key'         => $key,
				'label'       => $default['label'],
				'description' => $default['description'],
				'enabled'     => isset( $stored[ $key . '_enabled' ] )
					? '1' === $stored[ $key . '_enabled' ]
					: (bool) $default['enabled'],
				'subject'     => $stored[ $key . '_subject' ] ?? $default['subject'],
				'body'        => $stored[ $key . '_body' ] ?? $default['body'],
				// Lets the editor offer "reset", and shows what was shipped.
				'isCustom'    => isset( $stored[ $key . '_subject' ] )
					|| isset( $stored[ $key . '_body' ] ),
			);
		}

		return $templates;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function find( string $key ): ?array {
		return self::all()[ $key ] ?? null;
	}

	/**
	 * @param array<string, mixed> $data subject, body and/or enabled.
	 *
	 * @return array<string, mixed>|null The stored template, or null if unknown.
	 */
	public static function save( string $key, array $data ): ?array {
		if ( ! in_array( $key, self::keys(), true ) ) {
			return null;
		}

		if ( array_key_exists( 'subject', $data ) ) {
			self::write( $key . '_subject', (string) $data['subject'] );
		}

		if ( array_key_exists( 'body', $data ) ) {
			self::write( $key . '_body', (string) $data['body'] );
		}

		if ( array_key_exists( 'enabled', $data ) ) {
			self::write( $key . '_enabled', $data['enabled'] ? '1' : '0' );
		}

		return self::find( $key );
	}

	/**
	 * Drops the stored copy so the shipped default applies again.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function reset( string $key ): ?array {
		global $wpdb;

		if ( ! in_array( $key, self::keys(), true ) ) {
			return null;
		}

		$table = SettingsTable::table();

		foreach ( array( '_subject', '_body', '_enabled' ) as $suffix ) {
			$wpdb->delete( $table, array( 'option_key' => $key . $suffix ) );
		}

		return self::find( $key );
	}

	/**
	 * Everything stored under the email group, keyed by option_key.
	 *
	 * @return array<string, string>
	 */
	private static function stored(): array {
		global $wpdb;

		$table = SettingsTable::table();

		// A missing table simply means the defaults apply.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_key, option_value FROM $table WHERE option_group = %s",
				self::GROUP
			),
			ARRAY_A
		) ?: array();

		return wp_list_pluck( $rows, 'option_value', 'option_key' );
	}

	private static function write( string $key, string $value ): void {
		global $wpdb;

		$table = SettingsTable::table();
		$now   = current_time( 'mysql', true );

		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO $table (option_group, option_key, option_value, locale, autoload, created_at, updated_at)
				VALUES (%s, %s, %s, '', 0, %s, %s)
				ON DUPLICATE KEY UPDATE option_value = VALUES(option_value), option_group = VALUES(option_group), updated_at = VALUES(updated_at)",
				self::GROUP,
				$key,
				$value,
				$now,
				$now
			)
		);
	}
}
