<?php
/**
 * One-time codes proving a guest owns the address they booked with.
 *
 * Payment here is by bank transfer against an emailed instruction, so the
 * address IS the booking: get it wrong — a typo, or somebody else's — and the
 * dates come off the board, the confirmation goes to a stranger, and the
 * person who actually wanted the apartment never hears anything. A code sent
 * to the address and typed back is the cheapest way to know it is real.
 *
 * Nothing is stored in a table. A pending code lives in a transient keyed by
 * the address, and a verified address is carried by a SIGNED TOKEN rather than
 * a server-side session: WordPress has no session for a logged-out visitor,
 * and inventing one to hold a boolean would be a table, a cookie and a
 * cleanup job for something an HMAC already answers.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use WP_Error;

defined( 'ABSPATH' ) || exit;

final class EmailVerification {

	/** Six digits: long enough not to be guessed, short enough to retype. */
	private const CODE_LENGTH = 6;

	/** How long a code stays good for. */
	private const TTL = 10 * MINUTE_IN_SECONDS;

	/** How long a proven address stays proven. */
	private const TOKEN_TTL = 2 * HOUR_IN_SECONDS;

	/** Wrong guesses before the code is burnt and a new one must be asked for. */
	private const MAX_ATTEMPTS = 5;

	/** Codes one address may be sent in an hour. */
	private const MAX_SENDS = 5;

	/** Seconds before the same address may ask for another. */
	private const RESEND_AFTER = 60;

	/**
	 * Whether the site is asking guests to verify at all.
	 *
	 * Tied to the email template rather than a switch of its own, because the
	 * two cannot sensibly disagree: with mail off, or that template disabled,
	 * a code can be generated and never delivered — and requiring one the
	 * guest cannot receive would close the booking form completely. Turning
	 * "Email verification code" off on the Email Templates screen turns the
	 * whole step off, which is where an owner would look for it.
	 */
	public static function is_enabled(): bool {
		if ( ! SettingsRepository::emails_enabled() ) {
			return false;
		}

		$template = EmailTemplatesRepository::find( EmailTemplatesRepository::OTP_VERIFICATION );

		return null !== $template && (bool) $template['enabled'];
	}

	/**
	 * Send a code to an address.
	 *
	 * @param string $email The address to prove.
	 *
	 * @return array{expiresIn: int, resendIn: int}|WP_Error
	 */
	public static function request( string $email ) {
		$email = self::normalise( $email );

		if ( ! is_email( $email ) ) {
			return self::error( 'booking_suite_invalid_email', __( 'Please give a valid email address.', 'booking-suite' ), 400 );
		}

		$pending = get_transient( self::code_key( $email ) );

		/*
		 * A cooling-off period between sends. Without it the resend button is
		 * a way to post mail to anyone, from this site, at whatever rate the
		 * clicker likes.
		 */
		if ( is_array( $pending ) ) {
			$waited = time() - (int) ( $pending['sent'] ?? 0 );

			if ( $waited < self::RESEND_AFTER ) {
				return self::error(
					'booking_suite_too_soon',
					__( 'A code was just sent. Please wait a moment before asking for another.', 'booking-suite' ),
					429
				);
			}
		}

		$sends = (int) get_transient( self::sends_key( $email ) );

		if ( $sends >= self::MAX_SENDS ) {
			return self::error(
				'booking_suite_too_many',
				__( 'Too many codes have been sent to this address. Please try again later.', 'booking-suite' ),
				429
			);
		}

		$code = self::generate();

		set_transient(
			self::code_key( $email ),
			array(
				// Hashed, so the code cannot be read back out of the options
				// table by anything that can see transients.
				'hash'     => self::hash( $email, $code ),
				'attempts' => 0,
				'sent'     => time(),
			),
			self::TTL
		);

		set_transient( self::sends_key( $email ), $sends + 1, HOUR_IN_SECONDS );

		if ( ! BookingEmails::send_code( $email, $code, (int) ( self::TTL / MINUTE_IN_SECONDS ) ) ) {
			return self::error(
				'booking_suite_mail_failed',
				__( 'The code could not be sent. Please check the address and try again.', 'booking-suite' ),
				502
			);
		}

		return array(
			'expiresIn' => self::TTL,
			'resendIn'  => self::RESEND_AFTER,
		);
	}

	/**
	 * Check a code and, if it is right, prove the address.
	 *
	 * @param string $email The address being proved.
	 * @param string $code  What the guest typed.
	 *
	 * @return array{token: string, expiresIn: int}|WP_Error
	 */
	public static function confirm( string $email, string $code ) {
		$email = self::normalise( $email );
		$code  = preg_replace( '/\D/', '', $code ) ?? '';

		$pending = get_transient( self::code_key( $email ) );

		if ( ! is_array( $pending ) ) {
			return self::error(
				'booking_suite_code_expired',
				__( 'That code has expired. Please ask for a new one.', 'booking-suite' ),
				410
			);
		}

		$attempts = (int) ( $pending['attempts'] ?? 0 );

		/*
		 * Guesses are capped and the code is destroyed on the last one. Six
		 * digits is a million possibilities, which is plenty against a person
		 * and nothing against a script left running overnight.
		 */
		if ( $attempts >= self::MAX_ATTEMPTS ) {
			delete_transient( self::code_key( $email ) );

			return self::error(
				'booking_suite_code_burnt',
				__( 'Too many wrong codes. Please ask for a new one.', 'booking-suite' ),
				429
			);
		}

		if ( ! hash_equals( (string) $pending['hash'], self::hash( $email, $code ) ) ) {
			$pending['attempts'] = $attempts + 1;

			// Kept for what is left of the original window, not extended: a
			// wrong guess must not buy more time.
			set_transient( self::code_key( $email ), $pending, self::TTL );

			return self::error(
				'booking_suite_code_wrong',
				__( 'That code is not right. Please check it and try again.', 'booking-suite' ),
				400,
				'code'
			);
		}

		// Used once. A code that still works after it has been accepted is a
		// code sitting in an inbox waiting to be replayed.
		delete_transient( self::code_key( $email ) );
		delete_transient( self::sends_key( $email ) );

		return array(
			'token'     => self::issue( $email ),
			'expiresIn' => self::TOKEN_TTL,
		);
	}

	/**
	 * Whether a token really does prove this address.
	 *
	 * @param string $email The address the booking is being made with.
	 * @param string $token What the browser sent back.
	 */
	public static function is_verified( string $email, string $token ): bool {
		$email = self::normalise( $email );
		$parts = explode( '.', $token, 2 );

		if ( 2 !== count( $parts ) ) {
			return false;
		}

		[ $expires, $signature ] = $parts;

		if ( ! ctype_digit( $expires ) || (int) $expires < time() ) {
			return false;
		}

		return hash_equals( self::sign( $email, (int) $expires ), $signature );
	}

	/**
	 * A token saying this address has been proved, good until it expires.
	 */
	private static function issue( string $email ): string {
		$expires = time() + self::TOKEN_TTL;

		return $expires . '.' . self::sign( $email, $expires );
	}

	/**
	 * The signature over an address and an expiry.
	 *
	 * Salted with wp_salt(), so a token minted on one site means nothing on
	 * another and nothing survives a salt rotation.
	 */
	private static function sign( string $email, int $expires ): string {
		return hash_hmac( 'sha256', $email . '|' . $expires, wp_salt( 'booking_suite_email_verify' ) );
	}

	/** The stored form of a code: never the code itself. */
	private static function hash( string $email, string $code ): string {
		return hash_hmac( 'sha256', $email . '|' . $code, wp_salt( 'booking_suite_email_code' ) );
	}

	/**
	 * A fresh code.
	 *
	 * wp_rand() rather than rand(): this is a credential, however short-lived,
	 * and a predictable one is not a check at all.
	 */
	private static function generate(): string {
		return str_pad(
			(string) wp_rand( 0, ( 10 ** self::CODE_LENGTH ) - 1 ),
			self::CODE_LENGTH,
			'0',
			STR_PAD_LEFT
		);
	}

	/** Addresses are compared, keyed and signed in one form only. */
	private static function normalise( string $email ): string {
		return strtolower( trim( $email ) );
	}

	/** Hashed into the key, so no address is readable in the options table. */
	private static function code_key( string $email ): string {
		return 'bks_otp_' . md5( $email );
	}

	private static function sends_key( string $email ): string {
		return 'bks_otp_sends_' . md5( $email );
	}

	private static function error( string $code, string $message, int $status, string $field = '' ): WP_Error {
		return new WP_Error(
			$code,
			$message,
			array(
				'status' => $status,
				'field'  => $field,
			)
		);
	}
}
