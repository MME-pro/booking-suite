<?php
/**
 * The link that opens a booking's payment page without a login.
 *
 * A guest who closes the tab, or comes back to the email a day later, has to be
 * able to reach the bank details again — and they have no account here to log
 * into. So the booking's own id is signed, and the signature is the credential.
 *
 * Signed rather than stored: a token in the database is a second thing that can
 * drift from the booking it names, needs its own cleanup, and turns "can this
 * person see this page" into a query. A signature answers it arithmetically and
 * cannot be guessed without the site's salt.
 *
 * The token grants exactly two things — reading that one booking's payment
 * details, and saying "I have sent the money". It cannot change what is owed,
 * cannot cancel, and names no other booking.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

defined( 'ABSPATH' ) || exit;

final class PaymentLink {

	/**
	 * How long a link stays good for.
	 *
	 * Long past any reservation window on purpose. The dates are released by
	 * the deadline, not by this — and a guest returning to a link that has died
	 * learns nothing about why, whereas one who reaches the page can see the
	 * booking was cancelled and what to do about it.
	 */
	private const TTL = 90 * DAY_IN_SECONDS;

	/**
	 * A token for one booking.
	 *
	 * @param int $booking_id The booking it opens.
	 */
	public static function token( int $booking_id ): string {
		$expires = time() + self::TTL;

		return $booking_id . '.' . $expires . '.' . self::sign( $booking_id, $expires );
	}

	/**
	 * The booking a token names, or null when it names none.
	 *
	 * Returns the id rather than the booking, so the caller decides what to do
	 * with a token that is valid for a booking that has since been deleted.
	 *
	 * @param string $token What the browser sent.
	 */
	public static function booking_id( string $token ): ?int {
		$parts = explode( '.', $token );

		if ( 3 !== count( $parts ) ) {
			return null;
		}

		[ $id, $expires, $signature ] = $parts;

		if ( ! ctype_digit( $id ) || ! ctype_digit( $expires ) ) {
			return null;
		}

		if ( (int) $expires < time() ) {
			return null;
		}

		// hash_equals, not ===: a token is a secret, and comparing secrets with
		// an operator that stops at the first wrong byte leaks how far a guess
		// got.
		if ( ! hash_equals( self::sign( (int) $id, (int) $expires ), $signature ) ) {
			return null;
		}

		return (int) $id;
	}

	/**
	 * The full URL of a booking's payment page.
	 *
	 * Built here so the email, the REST response and anything added later all
	 * produce the same link.
	 *
	 * The tidy path when permalinks are on, and the plain query string when they
	 * are not — PaymentPage answers to both, so a link that goes out in email
	 * keeps working even if the rewrite rules are later flushed away.
	 *
	 * @param int $booking_id The booking.
	 */
	public static function url( int $booking_id ): string {
		$token = self::token( $booking_id );

		if ( get_option( 'permalink_structure' ) ) {
			return home_url( '/' . PaymentPage::PATH . '/' . $token );
		}

		return add_query_arg(
			array( PaymentPage::QUERY_VAR => $token ),
			home_url( '/' )
		);
	}

	/**
	 * The signature over a booking and an expiry.
	 *
	 * Salted with wp_salt(), so a token minted on one site means nothing on
	 * another and a salt rotation invalidates every link at once.
	 */
	private static function sign( int $booking_id, int $expires ): string {
		return hash_hmac(
			'sha256',
			$booking_id . '|' . $expires,
			wp_salt( 'booking_suite_payment_link' )
		);
	}
}
