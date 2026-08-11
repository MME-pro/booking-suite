<?php
/**
 * Transactional email to the guest.
 *
 * Three moments send mail, and each is triggered from the code that performs
 * the change rather than from a hook on the table, so an email only ever goes
 * out for a change that actually happened:
 *
 *   · the request is submitted   (PublicBookingController::create)
 *   · the request is approved    (BookingsController::update)
 *   · the payment is settled     (BookingsController / PaymentsController)
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;

defined( 'ABSPATH' ) || exit;

final class BookingEmails {

	/**
	 * Send one template for one booking.
	 *
	 * Quiet about failure by design: a booking must never be lost because the
	 * mail server was unreachable. Everything that can stop a send — no
	 * template, switched off, no email address — simply returns false.
	 *
	 * @param string                $template    One of EmailTemplatesRepository::keys().
	 * @param int                   $booking_id
	 * @param array<string, string> $attachments Filename => raw bytes.
	 *
	 * @return bool Whether the mail was handed to wp_mail().
	 */
	public static function send( string $template, int $booking_id, array $attachments = array() ): bool {
		$definition = EmailTemplatesRepository::find( $template );

		if ( null === $definition || ! $definition['enabled'] ) {
			return false;
		}

		$booking = BookingsRepository::find( $booking_id );

		if ( null === $booking ) {
			return false;
		}

		$to = (string) ( $booking['customerEmail'] ?? '' );

		if ( ! is_email( $to ) ) {
			// Walk-in guests may have no address; nothing to do.
			return false;
		}

		$tokens = self::tokens( $booking );

		$subject = self::replace( (string) $definition['subject'], $tokens );
		$body    = self::replace( (string) $definition['body'], $tokens );

		/**
		 * Last chance to change or stop a guest email.
		 *
		 * @param array<string, mixed> $mail     to, subject, body.
		 * @param string               $template The template key.
		 * @param array<string, mixed> $booking  The booking being sent about.
		 */
		$mail = apply_filters(
			'booking_suite_guest_email',
			array(
				'to'      => $to,
				'subject' => $subject,
				'body'    => $body,
			),
			$template,
			$booking
		);

		if ( empty( $mail['to'] ) || empty( $mail['subject'] ) ) {
			return false;
		}

		/*
		 * wp_mail attaches files by path, so anything generated in memory has to
		 * touch disk first. These go to the system temp directory rather than
		 * the uploads folder: an invoice is not media, and nothing should be
		 * able to reach it over the web.
		 */
		$paths = array();

		foreach ( $attachments as $filename => $bytes ) {
			$path = trailingslashit( get_temp_dir() ) . wp_unique_filename( get_temp_dir(), $filename );

			if ( false !== file_put_contents( $path, $bytes ) ) {
				$paths[] = $path;
			}
		}

		/*
		 * Templates are written as plain text, so the body is sent as text and
		 * newlines survive. Switching to HTML later means changing the header
		 * and running the body through wpautop, not rewriting the templates.
		 */
		$sent = wp_mail(
			(string) $mail['to'],
			(string) $mail['subject'],
			(string) $mail['body'],
			array( 'Content-Type: text/plain; charset=UTF-8' ),
			$paths
		);

		// wp_mail has read them by now, whether or not it succeeded.
		foreach ( $paths as $path ) {
			wp_delete_file( $path );
		}

		return $sent;
	}

	/**
	 * Placeholder values for one booking.
	 *
	 * @param array<string, mixed> $booking
	 *
	 * @return array<string, string>
	 */
	private static function tokens( array $booking ): array {
		$name  = (string) ( $booking['customerName'] ?? '' );
		$first = trim( explode( ' ', $name )[0] ?? '' );

		return array(
			'{{guest_name}}'       => $name,
			'{{guest_first_name}}' => '' !== $first ? $first : $name,
			'{{reference}}'        => (string) ( $booking['reference'] ?? '' ),
			'{{apartment}}'        => (string) ( $booking['apartmentName'] ?? '' ),
			'{{check_in}}'         => self::date( (string) ( $booking['startsAt'] ?? '' ) ),
			'{{check_out}}'        => self::date( (string) ( $booking['endsAt'] ?? '' ) ),
			'{{guests}}'           => (string) ( $booking['guests'] ?? '' ),
			'{{total}}'            => self::money(
				(float) ( $booking['total'] ?? 0 ),
				(string) ( $booking['currency'] ?? 'EUR' )
			),
			'{{status}}'           => (string) ( $booking['status'] ?? '' ),
			'{{payment_status}}'   => (string) ( $booking['paymentStatus'] ?? '' ),
			'{{site_name}}'        => (string) get_bloginfo( 'name' ),
			'{{site_url}}'         => (string) home_url(),
		);
	}

	/**
	 * @param array<string, string> $tokens
	 */
	private static function replace( string $text, array $tokens ): string {
		return strtr( $text, $tokens );
	}

	/**
	 * Stored times are UTC; guests should read them in the site's timezone.
	 */
	private static function date( string $value ): string {
		if ( '' === $value ) {
			return '';
		}

		$timestamp = strtotime( $value . ' UTC' );

		if ( ! $timestamp ) {
			return $value;
		}

		return wp_date(
			get_option( 'date_format' ) . ', ' . get_option( 'time_format' ),
			$timestamp
		) ?: $value;
	}

	private static function money( float $amount, string $currency ): string {
		return number_format_i18n( $amount, 2 ) . ' ' . $currency;
	}
}
