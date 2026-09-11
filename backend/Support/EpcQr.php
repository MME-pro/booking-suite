<?php
/**
 * The GiroCode: a SEPA credit transfer, as the lines a banking app expects.
 *
 * Every German banking app can scan one of these and open a prefilled
 * transfer — payee, IBAN, amount and reference already in place. That matters
 * more here than anywhere else in the plugin: bank transfer is the only way to
 * pay, so the difference between a guest typing a 22-character IBAN correctly
 * on a phone and pointing a camera at a square is the difference between the
 * money arriving and the booking expiring.
 *
 * The format is the European Payments Council's EPC069-12 — "Quick Response
 * Code: Guidelines to Enable the Data Capture for the Initiation of a SEPA
 * Credit Transfer". It is POSITIONAL: every line means what it means because
 * of where it is, not because of any label. An element in the wrong row is not
 * a formatting slip, it is a different instruction — which is exactly how an
 * earlier version of this file put the amount where the account number belongs
 * and left the IBAN out of the payload altogether.
 *
 * The twelve elements, in order:
 *
 *    1  Service tag                     BCD
 *    2  Version                         002
 *    3  Character set                   1 = UTF-8
 *    4  Identification                  SCT
 *    5  BIC of the beneficiary bank     optional under version 002
 *    6  Name of the beneficiary         max 70
 *    7  Account number of the           the IBAN, max 34
 *       beneficiary
 *    8  Amount                          EUR###.##
 *    9  Purpose of the credit transfer  max 4, unused here
 *   10  Structured remittance           max 35
 *       reference
 *   11  Unstructured remittance         max 140 — the booking number
 *       information
 *   12  Beneficiary to originator       max 70, unused here
 *       information
 *
 * This builds the string only. Turning it into a square is the page's job.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

defined( 'ABSPATH' ) || exit;

final class EpcQr {

	/** Version 002 — the one under which the BIC may be left out. */
	private const VERSION = '002';

	/** 1 is UTF-8, so a payee called Müller survives the round trip. */
	private const CHARSET = '1';

	/**
	 * The specification's field lengths, which are not advisory.
	 *
	 * A payload that exceeds them is not merely long: banking apps reject the
	 * whole code rather than truncating, so it is better to trim here and
	 * produce something scannable.
	 */
	private const MAX_NAME      = 70;
	private const MAX_IBAN      = 34;
	private const MAX_REFERENCE = 140;

	/** The whole payload, per the specification. */
	private const MAX_PAYLOAD = 331;

	/**
	 * The largest amount the format can carry: EUR999999999.99.
	 *
	 * Far above any booking here, but a number beyond it would silently
	 * produce an unscannable code.
	 */
	private const MAX_AMOUNT = 999999999.99;

	/**
	 * The payload for one transfer, or '' when it cannot be built.
	 *
	 * Returns nothing rather than something half-filled. A QR code that opens
	 * a transfer with no account number in it is worse than no QR code at all,
	 * because the guest believes they have used it — which is precisely what
	 * the earlier version of this did.
	 *
	 * @param string $holder    The beneficiary: Settings → Payment, account holder.
	 * @param string $iban      Their IBAN, from the same screen.
	 * @param string $bic       Their BIC, from the same screen. Optional.
	 * @param float  $amount    What is owed, in euro.
	 * @param string $reference The booking number, used as the remittance text.
	 */
	public static function payload(
		string $holder,
		string $iban,
		string $bic,
		float $amount,
		string $reference
	): string {
		$iban      = self::compact( $iban );
		$bic       = self::compact( $bic );
		$holder    = self::clean( $holder, self::MAX_NAME );
		$reference = self::clean( $reference, self::MAX_REFERENCE );

		/*
		 * The three that cannot be missing or wrong. A transfer with no payee,
		 * no account or no amount is not a transfer, and an amount outside the
		 * format's range makes the whole code unreadable rather than merely
		 * odd.
		 */
		if ( '' === $holder || '' === $iban || strlen( $iban ) > self::MAX_IBAN ) {
			return '';
		}

		if ( $amount < 0.01 || $amount > self::MAX_AMOUNT ) {
			return '';
		}

		$lines = array(
			// 1
			'BCD',
			// 2
			self::VERSION,
			// 3
			self::CHARSET,
			// 4
			'SCT',
			// 5 — empty is allowed under 002 and common for domestic SEPA.
			$bic,
			// 6
			$holder,
			// 7 — the account the money goes to. The element this file once
			// omitted; nothing else in the payload can stand in for it.
			$iban,
			// 8 — always two decimals, always a full stop, never a separator.
			'EUR' . number_format( $amount, 2, '.', '' ),
			// 9 — purpose code. Nothing here is a "salary" or a "tax", so it
			// stays empty rather than claiming a category.
			'',
			/*
			 * 10 — structured reference. Deliberately empty: the specification
			 * allows EITHER a structured reference OR unstructured text, never
			 * both, and a booking number is not an ISO 11649 creditor
			 * reference. It goes in 11 instead, which is the free-text field
			 * the payer's statement shows.
			 */
			'',
			// 11
			$reference,
		);

		/*
		 * Element 12 is omitted rather than sent empty. Trailing empty elements
		 * may be left off, and a payload that ends on a newline has been read
		 * by some apps as a twelfth, blank field.
		 */
		$payload = implode( "\n", $lines );

		return strlen( $payload ) > self::MAX_PAYLOAD ? '' : $payload;
	}

	/**
	 * An IBAN or BIC as the format wants it: upper case, no spaces.
	 *
	 * Owners type IBANs in groups of four because that is how a bank prints
	 * them, and a space anywhere in element 7 invalidates the code.
	 */
	private static function compact( string $value ): string {
		return strtoupper( (string) preg_replace( '/\s+/', '', $value ) );
	}

	/**
	 * Free text, fit for a positional format.
	 *
	 * Newlines are the element separator, so one inside a value would shift
	 * every field after it by a row — the same class of error this file exists
	 * to avoid. Collapsed to spaces rather than stripped, so words do not run
	 * together.
	 *
	 * @param string $value The text.
	 * @param int    $limit The specification's length for that element.
	 */
	private static function clean( string $value, int $limit ): string {
		$value = (string) preg_replace( '/\s+/u', ' ', trim( $value ) );

		return trim( mb_substr( $value, 0, $limit ) );
	}
}
