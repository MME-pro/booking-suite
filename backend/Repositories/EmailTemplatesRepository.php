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

	/** Sent to the guest a few days before they arrive. */
	public const BOOKING_REMINDER = 'booking_reminder';

	/** Carries the one-time code that proves a guest owns their email. */
	public const OTP_VERIFICATION = 'otp_verification';

	/** Sent to the guest when their booking is called off. */
	public const BOOKING_CANCELLED = 'booking_cancelled';

	/** Tells the owner a booking has been confirmed. */
	public const ADMIN_BOOKING_CONFIRMED = 'admin_booking_confirmed';

	/** Tells the owner money has arrived. */
	public const ADMIN_PAYMENT_RECEIVED = 'admin_payment_received';

	/**
	 * Who a template is written for.
	 *
	 * The distinction is not cosmetic. A guest email is a piece of the
	 * property's voice and goes to a customer; an owner email is an internal
	 * notice and may carry things — a guest's phone number, a link straight
	 * into wp-admin — that must never appear in the other kind. Keeping them
	 * apart in the editor is what stops the two being edited as though they
	 * were the same thing.
	 */
	public const AUDIENCE_GUEST = 'guest';

	public const AUDIENCE_ADMIN = 'admin';

	/**
	 * @return string[]
	 */
	public static function keys(): array {
		return array_keys( self::defaults() );
	}

	/**
	 * Who each template is addressed to.
	 *
	 * Anything unlisted is treated as a guest email — the safer default, since
	 * a guest template is the one that must not leak internal detail.
	 *
	 * @return array<string, string>
	 */
	public static function audiences(): array {
		return array(
			self::BOOKING_REQUEST         => self::AUDIENCE_GUEST,
			self::BOOKING_APPROVED        => self::AUDIENCE_GUEST,
			self::BOOKING_REMINDER        => self::AUDIENCE_GUEST,
			self::OTP_VERIFICATION        => self::AUDIENCE_GUEST,
			self::BOOKING_CANCELLED       => self::AUDIENCE_GUEST,
			self::PAYMENT_RECEIVED        => self::AUDIENCE_GUEST,
			self::BALANCE_DUE             => self::AUDIENCE_GUEST,
			self::ADMIN_BOOKING_CONFIRMED => self::AUDIENCE_ADMIN,
			self::ADMIN_PAYMENT_RECEIVED  => self::AUDIENCE_ADMIN,
		);
	}

	public static function audience_of( string $key ): string {
		return self::audiences()[ $key ] ?? self::AUDIENCE_GUEST;
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
			'{{guest_email}}'     => __( "The guest's email address", 'booking-suite' ),
			'{{guest_phone}}'     => __( "The guest's phone number", 'booking-suite' ),
			'{{nights}}'          => __( 'Length of stay in nights', 'booking-suite' ),
			/*
			 * Place it yourself to control where the account appears. Leave it
			 * out and any email about a booking with money still owing gets
			 * the same block appended at the end, so a guest is never told
			 * what they owe without being told where to send it.
			 */
			'{{bank_details}}'    => __( 'Your bank account, with a note on how to pay', 'booking-suite' ),
			/*
			 * Only filled in for the emails that have something to say with
			 * them; elsewhere they resolve to nothing rather than printing the
			 * token, so a stray one cannot reach a guest as {{otp_code}}.
			 */
			'{{otp_code}}'        => __( 'The one-time verification code', 'booking-suite' ),
			'{{otp_minutes}}'     => __( 'How long that code stays valid', 'booking-suite' ),
			'{{cancel_reason}}'   => __( 'Why the booking was cancelled', 'booking-suite' ),
			// Admin templates only: a link into wp-admin has no business in a
			// guest email, so it is left blank in one.
			'{{admin_url}}'       => __( 'Link to the booking in the admin', 'booking-suite' ),
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

			// ── Guest ───────────────────────────────────────────────────────
			self::BOOKING_REMINDER => array(
				'label'       => __( 'Booking reminder', 'booking-suite' ),
				'description' => __(
					'A note to the guest shortly before they arrive, with the practicalities.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Your stay is coming up — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>We are looking forward to having you</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>Your stay at {{apartment}} is coming up. Here are the details again.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>Guests</th><td>{{guests}}</td></tr>\n"
					. "</table>\n"
					. "<p>If anything about your arrival has changed, reply to this email and let us know.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
			self::OTP_VERIFICATION => array(
				'label'       => __( 'Email verification code', 'booking-suite' ),
				'description' => __(
					'Carries the one-time code that proves the guest owns the address they booked with.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Your verification code: {{otp_code}}', 'booking-suite' ),
				/*
				 * No booking details here on purpose. A verification code is
				 * sent to an address nobody has proved they own yet, so the
				 * email must not carry anything about the booking with it.
				 */
				'body'        => __(
					"<h1>Your verification code</h1>\n"
					. "<p>Hello,</p>\n"
					. "<p>Use this code to confirm your email address:</p>\n"
					. "<blockquote><strong>{{otp_code}}</strong></blockquote>\n"
					. "<p>It is valid for {{otp_minutes}} minutes. If you did not ask for it, you can ignore this message — nothing has been booked.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),
			self::BOOKING_CANCELLED => array(
				'label'       => __( 'Booking cancelled', 'booking-suite' ),
				'description' => __(
					'Sent to the guest when their booking is called off, whoever cancelled it.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __( 'Your booking has been cancelled — {{reference}}', 'booking-suite' ),
				'body'        => __(
					"<h1>Your booking has been cancelled</h1>\n"
					. "<p>Hello {{guest_first_name}},</p>\n"
					. "<p>Your booking has been cancelled and the dates released.</p>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>Reason</th><td>{{cancel_reason}}</td></tr>\n"
					. "</table>\n"
					. "<p>Anything already paid will be refunded to the account it came from. Do reply if you would like to book other dates.</p>\n"
					. '<p>{{site_name}}</p>',
					'booking-suite'
				),
			),

			// ── Owner ───────────────────────────────────────────────────────
			self::ADMIN_BOOKING_CONFIRMED => array(
				'label'       => __( 'Booking confirmed (owner)', 'booking-suite' ),
				'description' => __(
					'Tells you a booking has been confirmed, with the guest’s contact details.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __(
					'Booking confirmed: {{apartment}}, {{check_in}} — {{reference}}',
					'booking-suite'
				),
				/*
				 * Contact details and an admin link, which is exactly what the
				 * guest templates must never carry — the reason the two
				 * audiences are separated in the editor.
				 */
				'body'        => __(
					"<h1>Booking confirmed</h1>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Arrival</th><td>{{check_in}}</td></tr>\n"
					. "<tr><th>Departure</th><td>{{check_out}}</td></tr>\n"
					. "<tr><th>Guests</th><td>{{guests}}</td></tr>\n"
					. "<tr><th>Guest</th><td>{{guest_name}}</td></tr>\n"
					. "<tr><th>Email</th><td>{{guest_email}}</td></tr>\n"
					. "<tr><th>Phone</th><td>{{guest_phone}}</td></tr>\n"
					. "<tr><th>Total</th><td>{{total}}</td></tr>\n"
					. "<tr><th>Payment</th><td>{{payment_status}}</td></tr>\n"
					. "</table>\n"
					. '<p><a href="{{admin_url}}">Open this booking in the admin</a></p>',
					'booking-suite'
				),
			),
			self::ADMIN_PAYMENT_RECEIVED  => array(
				'label'       => __( 'Payment received (owner)', 'booking-suite' ),
				'description' => __(
					'Tells you money has arrived against a booking.',
					'booking-suite'
				),
				'enabled'     => true,
				'subject'     => __(
					'Payment received: {{amount_paid}} — {{reference}}',
					'booking-suite'
				),
				'body'        => __(
					"<h1>Payment received</h1>\n"
					. "<table>\n"
					. "<tr><th>Reference</th><td>{{reference}}</td></tr>\n"
					. "<tr><th>Guest</th><td>{{guest_name}}</td></tr>\n"
					. "<tr><th>Apartment</th><td>{{apartment}}</td></tr>\n"
					. "<tr><th>Invoice</th><td>{{invoice_no}}</td></tr>\n"
					. "<tr><th>Received</th><td>{{amount_paid}}</td></tr>\n"
					. "<tr><th>Still to pay</th><td>{{amount_due}}</td></tr>\n"
					. "<tr><th>Booking total</th><td>{{total}}</td></tr>\n"
					. "</table>\n"
					. '<p><a href="{{admin_url}}">Open this booking in the admin</a></p>',
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
				// Guest or owner; the editor keeps the two apart.
				'audience'    => self::audience_of( $key ),
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
