<?php
/**
 * The invoice PDF sent to the guest when a payment is marked paid.
 *
 * The layout follows the client's supplied template: logo and RECHNUNG on the
 * left, the invoice meta beneath it, the sender block on the right, the
 * recipient below, then one table of everything booked, the totals, and the
 * closing lines.
 *
 * Only the booking supplies figures. Every fixed word on the page — the sender
 * block, the closing lines, the telephone number, the notice — comes from
 * Settings, so the owner can change them without a developer.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

use BookingSuite\Backend\Pricing\RateCalculator;
use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\PaymentsRepository;
use BookingSuite\Backend\Repositories\SettingsRepository;
use DateTimeImmutable;

defined( 'ABSPATH' ) || exit;

final class Invoice {

	/* Taken from the template. */
	private const INK      = '#2C3E50';
	private const BODY     = '#333333';
	private const MUTED    = '#666666';
	private const ZEBRA    = '#F8F9FA';
	private const RULE     = '#DDDDDD';
	private const HAIRLINE = '#EEEEEE';

	private const MARGIN = 50.0;
	private const RIGHT  = 545.0;

	/** Where the second of the two party columns starts. */
	private const COLUMN_TWO = 316.0;

	/** Room kept for the meta values, so their labels never run into them. */
	private const META_VALUE_WIDTH = 92.0;

	/** Column x positions and widths, matching the template's table. */
	private const COLUMNS = array(
		array( 50.0, 200.35 ),   // Beschreibung
		array( 251.0, 64.1 ),    // Datum
		array( 316.0, 94.06 ),   // Gebuchte Uhrzeit
		array( 411.0, 84.92 ),   // Anzahl der Std.
		array( 496.0, 49.32 ),   // Kosten
	);

	private const ROW_HEIGHT = 29.0;

	/**
	 * The invoice for one payment, ready to hand to BookingEmails::send().
	 *
	 * Numbering happens here rather than inside render(), so a payment is
	 * numbered once at the moment it is invoiced however it was settled.
	 *
	 * @return array<string, string> Filename => PDF bytes; empty when there is
	 *                               nothing to invoice.
	 */
	public static function attachment( int $payment_id ): array {
		$payment = PaymentsRepository::find( $payment_id );

		if ( null === $payment ) {
			return array();
		}

		PaymentsRepository::assign_invoice_number( $payment_id );

		$payment = PaymentsRepository::find( $payment_id ) ?? $payment;
		$pdf     = self::render( $payment );

		return null === $pdf ? array() : array( self::filename( $payment ) => $pdf );
	}

	/**
	 * The invoice for a booking, whichever of its payments settled it.
	 *
	 * A booking's payment status can be set straight from the Bookings screen,
	 * without going through an individual payment — so the payment to invoice
	 * has to be worked out: the settled one, or failing that the most recent.
	 *
	 * @return array<string, string> Filename => PDF bytes.
	 */
	public static function attachment_for_booking( int $booking_id ): array {
		// Newest first, per PaymentsRepository::for_booking().
		$payments = PaymentsRepository::for_booking( $booking_id );

		if ( ! $payments ) {
			return array();
		}

		$chosen = $payments[0];

		foreach ( $payments as $payment ) {
			if ( 'paid' === ( $payment['status'] ?? '' ) ) {
				$chosen = $payment;
				break;
			}
		}

		return self::attachment( (int) $chosen['id'] );
	}

	/**
	 * What the guest sees the attachment called.
	 *
	 * @param array<string, mixed> $payment
	 */
	public static function filename( array $payment ): string {
		$number = (string) ( $payment['invoiceNo'] ?? '' );

		return sanitize_file_name(
			sprintf(
				'%s-%s.pdf',
				__( 'Rechnung', 'booking-suite' ),
				'' !== $number ? $number : (string) ( $payment['id'] ?? '' )
			)
		);
	}

	/**
	 * Build the PDF for one payment.
	 *
	 * @param array<string, mixed> $payment A PaymentsRepository row.
	 *
	 * @return string|null Raw PDF bytes, or null when the booking has gone.
	 */
	public static function render( array $payment ): ?string {
		$booking_id = (int) ( $payment['bookingId'] ?? 0 );
		$booking    = BookingsRepository::find( $booking_id );

		if ( null === $booking ) {
			return null;
		}

		/*
		 * find() returns the booking without its extras — every caller loads
		 * them separately. Left out here they do not merely go missing from the
		 * table: the room line is derived by subtraction, so their cost would be
		 * silently added to the room instead.
		 */
		$booking['extras'] = BookingsRepository::extras_for( $booking_id );

		$pdf = new Pdf();
		$y   = self::MARGIN;

		$y = self::header( $pdf, $booking, $payment, $y );
		$y = self::parties( $pdf, $booking, $y );
		$y = self::items( $pdf, $booking, $y );
		$y = self::totals( $pdf, $booking, $y );

		self::footer( $pdf, $y );

		return $pdf->render();
	}

	/* ── Header ──────────────────────────────────────────────────────── */

	/**
	 * @param array<string, mixed> $booking
	 * @param array<string, mixed> $payment
	 */
	private static function header( Pdf $pdf, array $booking, array $payment, float $y ): float {
		// Row one: the logo, alone.
		$logo = self::logo();

		if ( null !== $logo ) {
			$pdf->logo( $logo, self::MARGIN, $y, 150, 55 );
			$y += 66;
		}

		// Row two: the title on the right, with the invoice's own details under
		// it — they belong to the document rather than to either party.
		$pdf->text_right( __( 'RECHNUNG', 'booking-suite' ), self::RIGHT, $y, 24, Pdf::BOLD, self::INK );
		$y += 38;

		$meta = array(
			array( __( 'Rechnungsnummer:', 'booking-suite' ), self::number( $payment ) ),
			array( __( 'Datum:', 'booking-suite' ), self::date( self::issued_at( $payment ) ) ),
			array( __( 'Fälligkeitsdatum:', 'booking-suite' ), self::date( self::due_at( $payment ) ) ),
			array( __( 'Buchungsnummer:', 'booking-suite' ), (string) ( $booking['reference'] ?? '' ) ),
		);

		/*
		 * Values share one right edge and labels end a fixed gap short of it.
		 * Measuring the label instead would put them a few points out, because
		 * the labels are bold and the width table is the regular face.
		 */
		$values_right = self::RIGHT;
		$labels_right = $values_right - self::META_VALUE_WIDTH;

		foreach ( $meta as [ $label, $value ] ) {
			$pdf->text_right( $label, $labels_right, $y, 9, Pdf::BOLD, self::INK );
			$pdf->text_right( $value, $values_right, $y, 9, Pdf::REGULAR, self::BODY );
			$y += 14;
		}

		return $y + 14;
	}

	/**
	 * Row three: who is sending the invoice, and who is receiving it.
	 *
	 * @param array<string, mixed> $booking
	 */
	private static function parties( Pdf $pdf, array $booking, float $y ): float {
		$pdf->line( self::MARGIN, $y, self::RIGHT, $y, self::HAIRLINE );
		$y += 18;

		// Built from Company Information, so the details are entered once.
		$sender = SettingsRepository::sender_lines();

		$recipient = array_values(
			array_filter(
				array(
					(string) ( $booking['customerName'] ?? '' ),
					(string) ( $booking['customerEmail'] ?? '' ),
					'' !== (string) ( $booking['customerPhone'] ?? '' )
						/* translators: %s: the guest's telephone number. */
						? sprintf( __( 'Tel: %s', 'booking-suite' ), $booking['customerPhone'] )
						: '',
				)
			)
		);

		$pdf->text( __( 'Absender:', 'booking-suite' ), self::MARGIN, $y, 10, Pdf::BOLD, self::INK );
		$pdf->text( __( 'Rechnungsempfänger:', 'booking-suite' ), self::COLUMN_TWO, $y, 10, Pdf::BOLD, self::INK );

		$y += 16;

		// Both columns start level and run as deep as the longer of the two.
		$depth = max( count( $sender ), count( $recipient ) );

		for ( $line = 0; $line < $depth; $line++ ) {
			if ( isset( $sender[ $line ] ) ) {
				$pdf->text( $sender[ $line ], self::MARGIN, $y, 9, Pdf::REGULAR, self::BODY );
			}

			if ( isset( $recipient[ $line ] ) ) {
				$pdf->text( $recipient[ $line ], self::COLUMN_TWO, $y, 9, Pdf::REGULAR, self::BODY );
			}

			$y += 13;
		}

		return $y + 16;
	}

	/* ── The table ───────────────────────────────────────────────────── */

	/**
	 * @param array<string, mixed> $booking
	 */
	private static function items( Pdf $pdf, array $booking, float $y ): float {
		$headings = array(
			__( 'Beschreibung', 'booking-suite' ),
			__( 'Datum', 'booking-suite' ),
			__( 'Gebuchte Uhrzeit', 'booking-suite' ),
			__( 'Anzahl der Std.', 'booking-suite' ),
			__( 'Kosten', 'booking-suite' ),
		);

		$pdf->rect( self::MARGIN, $y, self::RIGHT - self::MARGIN, self::ROW_HEIGHT, self::ZEBRA );

		foreach ( $headings as $index => $heading ) {
			[ $x, $width ] = self::COLUMNS[ $index ];

			if ( count( self::COLUMNS ) - 1 === $index ) {
				$pdf->text_right( $heading, $x + $width, $y + 11, 9, Pdf::BOLD, self::INK );
				continue;
			}

			$pdf->text( $heading, $x + 6, $y + 11, 9, Pdf::BOLD, self::INK );
		}

		$y += self::ROW_HEIGHT;
		$pdf->line( self::MARGIN, $y, self::RIGHT, $y, self::RULE );

		$currency = (string) ( $booking['currency'] ?? 'EUR' );

		foreach ( self::rows( $booking ) as $index => $row ) {
			// Banded, so a long list of extras stays readable.
			if ( 0 === $index % 2 ) {
				$pdf->rect( self::MARGIN, $y, self::RIGHT - self::MARGIN, self::ROW_HEIGHT, self::ZEBRA );
			}

			foreach ( $row as $column => $value ) {
				[ $x, $width ] = self::COLUMNS[ $column ];

				if ( count( self::COLUMNS ) - 1 === $column ) {
					$pdf->text_right(
						self::money( (float) $value, $currency ),
						$x + $width,
						$y + 11,
						9,
						Pdf::REGULAR,
						self::BODY
					);
					continue;
				}

				/*
				 * The description carries the make-up of the line — the unit
				 * price and what it is charged per — so it is the one column
				 * that needs a second line to fall back on.
				 */
				if ( 0 === $column ) {
					$lines = array_slice( Pdf::wrap( (string) $value, $width - 12, 9 ), 0, 2 );
					$top   = count( $lines ) > 1 ? $y + 7 : $y + 11;

					foreach ( $lines as $line ) {
						$pdf->text( $line, $x + 6, $top, 9, Pdf::REGULAR, self::BODY );
						$top += 11;
					}

					continue;
				}

				$pdf->text( (string) $value, $x + 6, $y + 11, 9, Pdf::REGULAR, self::BODY );
			}

			$y += self::ROW_HEIGHT;
			$pdf->line( self::MARGIN, $y, self::RIGHT, $y, self::HAIRLINE );
		}

		return $y;
	}

	/**
	 * Every billable line, in the template's order: the room, then each extra,
	 * then the surcharge for guests beyond the number the rate includes.
	 *
	 * @param array<string, mixed> $booking
	 *
	 * @return array<int, array<int, string|float>>
	 */
	private static function rows( array $booking ): array {
		$currency = (string) ( $booking['currency'] ?? 'EUR' );
		$starts   = self::local( (string) ( $booking['startsAt'] ?? '' ) );
		$ends     = self::local( (string) ( $booking['endsAt'] ?? '' ) );

		$hours = ( null !== $starts && null !== $ends )
			? ( $ends->getTimestamp() - $starts->getTimestamp() ) / 3600
			: 0.0;

		$extras    = is_array( $booking['extras'] ?? null ) ? $booking['extras'] : array();
		$surcharge = RateCalculator::guest_surcharge( (int) ( $booking['guests'] ?? 0 ) );

		$extras_total = 0.0;

		foreach ( $extras as $extra ) {
			$extras_total += (float) $extra['price'] * (int) $extra['quantity'];
		}

		// The room is what is left once the priced lines are taken off the
		// total, so the invoice always adds up to what the guest was charged.
		$room = (float) ( $booking['total'] ?? 0 ) - $extras_total - (float) $surcharge['total'];

		$rows = array(
			array(
				sprintf(
					/* translators: %s: the apartment's name. */
					__( '%s gebuchtes Zimmer', 'booking-suite' ),
					(string) ( $booking['apartmentName'] ?? '' )
				),
				null !== $starts ? self::date( $starts ) : '-',
				( null !== $starts && null !== $ends )
					? $starts->format( 'H:i' ) . ' - ' . $ends->format( 'H:i' )
					: '-',
				sprintf(
					/* translators: %s: number of hours, to two decimals. */
					__( '%s Std.', 'booking-suite' ),
					number_format_i18n( $hours, 2 )
				),
				max( 0, $room ),
			),
		);

		// Each extra shows its unit price, so the line total can be checked.
		foreach ( $extras as $extra ) {
			$rows[] = array(
				sprintf(
					/* translators: 1: name of the extra, 2: price of one of them. */
					__( '%1$s (Extra) — %2$s je Stück', 'booking-suite' ),
					(string) $extra['name'],
					self::money( (float) $extra['price'], $currency )
				),
				'-',
				'-',
				sprintf(
					/* translators: %d: how many were booked. */
					__( '%dx', 'booking-suite' ),
					(int) $extra['quantity']
				),
				(float) $extra['price'] * (int) $extra['quantity'],
			);
		}

		/*
		 * The guest surcharge, itemised: how many guests the rate already
		 * covers, how many are charged for, and what each one costs. Without
		 * this the line is a bare figure the guest cannot check.
		 */
		if ( $surcharge['extraGuests'] > 0 ) {
			$rows[] = array(
				sprintf(
					/* translators: 1: price per additional guest, 2: guests included in the rate. */
					__( 'Zusätzliche Person — %1$s je Person (%2$d im Preis enthalten)', 'booking-suite' ),
					self::money( (float) $surcharge['perGuest'], $currency ),
					(int) $surcharge['includedGuests']
				),
				'-',
				'-',
				sprintf(
					/* translators: %d: number of additional guests. */
					__( '%dx', 'booking-suite' ),
					(int) $surcharge['extraGuests']
				),
				(float) $surcharge['total'],
			);
		}

		return $rows;
	}

	/* ── Totals and close ────────────────────────────────────────────── */

	/**
	 * @param array<string, mixed> $booking
	 */
	private static function totals( Pdf $pdf, array $booking, float $y ): float {
		$total    = (float) ( $booking['total'] ?? 0 );
		$currency = (string) ( $booking['currency'] ?? 'EUR' );
		$settled  = self::settled( (int) ( $booking['id'] ?? 0 ) );

		$y += 14;

		/*
		 * The stored total is what the guest pays, so it is gross. Where a VAT
		 * rate is set, the net and the tax are worked back out of it rather
		 * than added on top — adding it on would change what is charged.
		 */
		$rate = SettingsRepository::tax_fraction();
		$net  = $rate > 0 ? round( $total / ( 1 + $rate ), 2 ) : $total;
		$tax  = round( $total - $net, 2 );

		$lines = array(
			array( __( 'Netto:', 'booking-suite' ), $net ),
		);

		if ( $rate > 0 ) {
			$lines[] = array(
				sprintf(
					/* translators: %s: the VAT rate as a percentage. */
					__( 'zzgl. %s%% MwSt.:', 'booking-suite' ),
					number_format_i18n( $rate * 100, 0 )
				),
				$tax,
			);
		}

		$lines[] = array( __( 'Gesamt:', 'booking-suite' ), $total );

		/*
		 * Once something has been paid, the invoice has to say so and show what
		 * is left. Re-issuing after the total changes is the whole point of
		 * this: without these two lines the guest is looking at a new full
		 * amount with no sign of what they already sent.
		 */
		if ( $settled > 0.005 ) {
			$lines[] = array( __( 'Bereits bezahlt:', 'booking-suite' ), -$settled );
		}

		foreach ( $lines as [ $label, $amount ] ) {
			$pdf->text_right(
				$label . ' ' . self::money( $amount, $currency ),
				self::RIGHT,
				$y,
				9,
				Pdf::REGULAR,
				self::BODY
			);
			$y += 15;
		}

		$y += 4;
		$pdf->line( self::RIGHT - 200, $y, self::RIGHT, $y, self::RULE );
		$y += 10;

		// With a part payment recorded, the bold figure is what is still owed.
		$outstanding = round( $total - $settled, 2 );

		$pdf->text_right(
			( $settled > 0.005
				? __( 'Offener Betrag:', 'booking-suite' )
				: __( 'Gesamtbetrag:', 'booking-suite' ) )
			. ' ' . self::money( max( 0, $outstanding ), $currency ),
			self::RIGHT,
			$y,
			12,
			Pdf::BOLD,
			self::INK
		);

		return $y + 34;
	}

	private static function settled( int $booking_id ): float {
		return $booking_id ? PaymentsRepository::settled_for( $booking_id ) : 0.0;
	}

	private static function footer( Pdf $pdf, float $y ): void {
		$pdf->line( self::MARGIN, $y, self::RIGHT, $y, self::HAIRLINE );
		$y += 16;

		$thanks = SettingsRepository::get( SettingsRepository::INVOICE_THANKS );

		if ( '' !== $thanks ) {
			$y = $pdf->paragraph(
				$thanks,
				self::MARGIN,
				$y,
				self::RIGHT - self::MARGIN,
				9,
				13,
				Pdf::REGULAR,
				self::MUTED
			);
		}

		foreach (
			array(
				array( __( 'Telefon:', 'booking-suite' ), SettingsRepository::get( SettingsRepository::INVOICE_PHONE ) ),
				array( __( 'E-Mail:', 'booking-suite' ), SettingsRepository::get( SettingsRepository::INVOICE_EMAIL ) ),
			) as [ $label, $value ]
		) {
			if ( '' === $value ) {
				continue;
			}

			$pdf->text( $label . ' ' . $value, self::MARGIN, $y, 9, Pdf::REGULAR, self::MUTED );
			$y += 13;
		}

		// Where to send the money, on the document that asks for it.
		$bank = SettingsRepository::bank_lines();

		if ( $bank ) {
			$y    += 4;
			$label = __( 'Bankverbindung:', 'booking-suite' );
			$left  = self::MARGIN + Pdf::width( $label . ' ', 9, Pdf::BOLD );

			$pdf->text( $label, self::MARGIN, $y, 9, Pdf::BOLD, self::MUTED );

			foreach ( $bank as $line ) {
				$pdf->text( $line, $left, $y, 9, Pdf::REGULAR, self::MUTED );
				$y += 12;
			}
		}

		$notice = SettingsRepository::get( SettingsRepository::INVOICE_NOTICE );

		if ( '' !== $notice ) {
			$y   += 4;
			$label = __( 'Hinweis:', 'booking-suite' );

			$pdf->text( $label, self::MARGIN, $y, 9, Pdf::BOLD, self::MUTED );
			$pdf->text(
				$notice,
				// Measured as bold, plus a word space; the label is drawn bold.
				self::MARGIN + Pdf::width( $label . ' ', 9, Pdf::BOLD ),
				$y,
				9,
				Pdf::REGULAR,
				self::MUTED
			);
		}
	}

	/* ── Values ──────────────────────────────────────────────────────── */

	/**
	 * The invoice number, generating and storing one the first time it is
	 * needed so that re-sending an invoice never renumbers it.
	 *
	 * @param array<string, mixed> $payment
	 */
	private static function number( array $payment ): string {
		$existing = (string) ( $payment['invoiceNo'] ?? '' );

		if ( '' !== $existing ) {
			return $existing;
		}

		return PaymentsRepository::assign_invoice_number( (int) $payment['id'] );
	}

	/**
	 * @param array<string, mixed> $payment
	 */
	private static function issued_at( array $payment ): DateTimeImmutable {
		$paid = self::local( (string) ( $payment['paidAt'] ?? '' ) );

		return $paid ?? new DateTimeImmutable( 'now', wp_timezone() );
	}

	/**
	 * @param array<string, mixed> $payment
	 */
	private static function due_at( array $payment ): DateTimeImmutable {
		$days = max( 0, (int) SettingsRepository::get( SettingsRepository::INVOICE_DUE_DAYS ) );

		return self::issued_at( $payment )->modify( "+{$days} days" );
	}

	/** Stored times are UTC; the invoice is read in the site's timezone. */
	private static function local( string $value ): ?DateTimeImmutable {
		if ( '' === $value ) {
			return null;
		}

		try {
			return ( new DateTimeImmutable( $value, new \DateTimeZone( 'UTC' ) ) )
				->setTimezone( wp_timezone() );
		} catch ( \Exception $e ) {
			return null;
		}
	}

	private static function date( DateTimeImmutable $date ): string {
		return $date->format( 'd.m.Y' );
	}

	private static function money( float $amount, string $currency ): string {
		return number_format_i18n( $amount, 2 ) . ' ' . self::symbol( $currency );
	}

	private static function symbol( string $currency ): string {
		$symbols = array(
			'EUR' => '€',
			'USD' => '$',
			'GBP' => '£',
			'CHF' => 'CHF',
		);

		return $symbols[ strtoupper( $currency ) ] ?? $currency;
	}

	/**
	 * @return string[]
	 */
	private static function lines( string $text ): array {
		return array_values(
			array_filter(
				array_map( 'trim', preg_split( '/\R/', $text ) ?: array() ),
				static fn( string $line ): bool => '' !== $line
			)
		);
	}

	/**
	 * The logo as JPEG bytes.
	 *
	 * Whatever was uploaded is re-encoded rather than embedded as-is: the PDF
	 * writer speaks JPEG, and a PNG with transparency would otherwise have to
	 * be handled as a separate image type for no visible gain.
	 */
	private static function logo(): ?string {
		$id = SettingsRepository::logo_id();

		if ( ! $id ) {
			return null;
		}

		$path = get_attached_file( $id );

		if ( ! $path || ! is_readable( $path ) || ! function_exists( 'imagecreatefromstring' ) ) {
			return null;
		}

		$source = @imagecreatefromstring( (string) file_get_contents( $path ) );

		if ( false === $source ) {
			return null;
		}

		// Flattened onto white, because JPEG has no alpha channel.
		$width  = imagesx( $source );
		$height = imagesy( $source );
		$canvas = imagecreatetruecolor( $width, $height );

		imagefill( $canvas, 0, 0, imagecolorallocate( $canvas, 255, 255, 255 ) );
		imagecopy( $canvas, $source, 0, 0, 0, 0, $width, $height );

		ob_start();
		imagejpeg( $canvas, null, 92 );
		$jpeg = (string) ob_get_clean();

		imagedestroy( $source );
		imagedestroy( $canvas );

		return '' !== $jpeg ? $jpeg : null;
	}
}
