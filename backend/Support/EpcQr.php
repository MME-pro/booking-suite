<?php
/**
 * The GiroCode: a transfer, as the twelve lines a banking app expects.
 *
 * Every German banking app can scan one of these and open a prefilled transfer
 * — payee, IBAN, amount and purpose already in place. That matters more here
 * than anywhere else in the plugin: bank transfer is the only way to pay, so
 * the difference between a guest typing a 22-character IBAN correctly on a
 * phone and pointing a camera at a square is the difference between the money
 * arriving and the booking expiring.
 *
 * The format is the European Payments Council's EPC069-12. It is positional,
 * not labelled: the lines mean what they mean because of where they are, so
 * none of them may be skipped or reordered even when empty.
 *
 * This builds the string only. Turning it into a square is the page's job.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

defined( 'ABSPATH' ) || exit;

final class EpcQr {

	/**
	 * The purpose line's limit, from the specification.
	 *
	 * A booking number is nowhere near it, but the reference is what the owner
	 * matches a bank line against, so it is truncated rather than allowed to
	 * push the payload over and make the whole code unreadable.
	 */
	private const REFERENCE_LIMIT = 140;

	/**
	 * The payload for one transfer, or '' when it cannot be built.
	 *
	 * Returns nothing rather than something half-filled: a QR code that opens a
	 * transfer with no IBAN in it is worse than no QR code, because the guest
	 * believes they have used it.
	 *
	 * @param string $holder    Who is being paid.
	 * @param string $iban      Their IBAN.
	 * @param string $bic       Their BIC. Optional; the line stays either way.
	 * @param float  $amount    What is owed.
	 * @param string $reference The booking number, used as the purpose.
	 */
	public static function payload(
		string $holder,
		string $iban,
		string $bic,
		float $amount,
		string $reference
	): string {
		$iban   = strtoupper( (string) preg_replace( '/\s+/', '', $iban ) );
		$holder = trim( $holder );

		if ( '' === $iban || '' === $holder || $amount <= 0 ) {
			return '';
		}

		/*
		 * Positional, and every line is required even when it carries nothing.
		 * The order is the specification's:
		 *
		 *  1 service tag        7 amount, EUR with two decimals
		 *  2 version            8 purpose code (unused)
		 *  3 character set      9 structured reference (unused)
		 * 	4 identification    10 unstructured reference — the booking number
		 *  5 BIC               11 information to the payer (unused)
		 *  6 payee
		 */
		$lines = array(
			'BCD',
			'002',
			// 1 = UTF-8. The payee's name may carry umlauts, and any other
			// character set here would mangle them in the banking app.
			'1',
			'SCT',
			strtoupper( (string) preg_replace( '/\s+/', '', $bic ) ),
			$holder,
			'EUR' . number_format( $amount, 2, '.', '' ),
			'',
			'',
			mb_substr( trim( $reference ), 0, self::REFERENCE_LIMIT ),
			'',
		);

		return implode( "\n", $lines );
	}
}
