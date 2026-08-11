<?php
/**
 * A very small PDF writer.
 *
 * The plugin has no Composer dependencies and adding a PDF library for one
 * document would pull in several megabytes, so the handful of operators an
 * invoice actually needs — positioned text, filled rectangles, lines and one
 * raster logo — are written directly.
 *
 * Everything is A4 portrait in points, with the origin moved to the top-left
 * corner: `y` counts downwards, the way page layout is normally described.
 * The three built-in Helvetica faces need no embedding, and WinAnsi encoding
 * covers the German alphabet and the euro sign.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

defined( 'ABSPATH' ) || exit;

final class Pdf {

	public const WIDTH  = 595.28;
	public const HEIGHT = 841.89;

	public const REGULAR = 'F1';
	public const BOLD    = 'F2';
	public const ITALIC  = 'F3';

	/** Drawing operators for the current page. */
	private string $content = '';

	/** JPEG logo, once embedded: [ data, width, height ]. */
	private ?array $image = null;

	/**
	 * Widths of Helvetica at 1pt, indexed by byte. Only what text measurement
	 * needs — without it, right-aligned figures and centred labels would each
	 * have to be positioned by hand.
	 *
	 * @var array<int, int>
	 */
	private const WIDTHS = array(
		32 => 278, 33 => 278, 34 => 355, 35 => 556, 36 => 556, 37 => 889, 38 => 667,
		39 => 191, 40 => 333, 41 => 333, 42 => 389, 43 => 584, 44 => 278, 45 => 333,
		46 => 278, 47 => 278, 48 => 556, 49 => 556, 50 => 556, 51 => 556, 52 => 556,
		53 => 556, 54 => 556, 55 => 556, 56 => 556, 57 => 556, 58 => 278, 59 => 278,
		60 => 584, 61 => 584, 62 => 584, 63 => 556, 64 => 1015, 65 => 667, 66 => 667,
		67 => 722, 68 => 722, 69 => 667, 70 => 611, 71 => 778, 72 => 722, 73 => 278,
		74 => 500, 75 => 667, 76 => 556, 77 => 833, 78 => 722, 79 => 778, 80 => 667,
		81 => 778, 82 => 722, 83 => 667, 84 => 611, 85 => 722, 86 => 667, 87 => 944,
		88 => 667, 89 => 667, 90 => 611, 91 => 278, 92 => 278, 93 => 278, 94 => 469,
		95 => 556, 96 => 333, 97 => 556, 98 => 556, 99 => 500, 100 => 556, 101 => 556,
		102 => 278, 103 => 556, 104 => 556, 105 => 222, 106 => 222, 107 => 500,
		108 => 222, 109 => 833, 110 => 556, 111 => 556, 112 => 556, 113 => 556,
		114 => 333, 115 => 500, 116 => 278, 117 => 556, 118 => 500, 119 => 722,
		120 => 500, 121 => 500, 122 => 500, 123 => 334, 124 => 260, 125 => 334,
		126 => 584,
	);

	/**
	 * The same for Helvetica-Bold, which is materially wider — measuring a bold
	 * label with the regular table puts the value that follows it several points
	 * too far left, and short labels end up overlapping their own values.
	 *
	 * @var array<int, int>
	 */
	private const BOLD_WIDTHS = array(
		32 => 278, 33 => 333, 34 => 474, 35 => 556, 36 => 556, 37 => 889, 38 => 722,
		39 => 238, 40 => 333, 41 => 333, 42 => 389, 43 => 584, 44 => 278, 45 => 333,
		46 => 278, 47 => 278, 48 => 556, 49 => 556, 50 => 556, 51 => 556, 52 => 556,
		53 => 556, 54 => 556, 55 => 556, 56 => 556, 57 => 556, 58 => 333, 59 => 333,
		60 => 584, 61 => 584, 62 => 584, 63 => 611, 64 => 975, 65 => 722, 66 => 722,
		67 => 722, 68 => 722, 69 => 667, 70 => 611, 71 => 778, 72 => 722, 73 => 278,
		74 => 556, 75 => 722, 76 => 611, 77 => 833, 78 => 722, 79 => 778, 80 => 667,
		81 => 778, 82 => 722, 83 => 667, 84 => 611, 85 => 722, 86 => 667, 87 => 944,
		88 => 667, 89 => 667, 90 => 611, 91 => 333, 92 => 278, 93 => 333, 94 => 584,
		95 => 556, 96 => 333, 97 => 556, 98 => 611, 99 => 556, 100 => 611, 101 => 556,
		102 => 333, 103 => 611, 104 => 611, 105 => 278, 106 => 278, 107 => 556,
		108 => 278, 109 => 889, 110 => 611, 111 => 611, 112 => 611, 113 => 611,
		114 => 389, 115 => 556, 116 => 333, 117 => 611, 118 => 556, 119 => 778,
		120 => 556, 121 => 556, 122 => 500, 123 => 389, 124 => 280, 125 => 389,
		126 => 584,
	);

	/** Accented characters are close enough to their base letter to measure as one. */
	private const FALLBACK_WIDTH = 556;

	private const BOLD_FALLBACK_WIDTH = 611;

	/* ── Drawing ─────────────────────────────────────────────────────── */

	public function text(
		string $text,
		float $x,
		float $y,
		float $size = 10,
		string $font = self::REGULAR,
		string $colour = '#333333'
	): void {
		if ( '' === $text ) {
			return;
		}

		$this->content .= sprintf(
			"BT %s /%s %.2F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET\n",
			self::fill( $colour ),
			$font,
			$size,
			$x,
			self::HEIGHT - $y - $size,
			self::escape( $text )
		);
	}

	/** Text whose right edge lands on $right — money columns and totals. */
	public function text_right(
		string $text,
		float $right,
		float $y,
		float $size = 10,
		string $font = self::REGULAR,
		string $colour = '#333333'
	): void {
		$this->text( $text, $right - self::width( $text, $size, $font ), $y, $size, $font, $colour );
	}

	public function rect( float $x, float $y, float $w, float $h, string $colour ): void {
		$this->content .= sprintf(
			"%s %.2F %.2F %.2F %.2F re f\n",
			self::fill( $colour ),
			$x,
			self::HEIGHT - $y - $h,
			$w,
			$h
		);
	}

	public function line( float $x1, float $y1, float $x2, float $y2, string $colour, float $weight = 0.5 ): void {
		$this->content .= sprintf(
			"%s %.2F w %.2F %.2F m %.2F %.2F l S\n",
			self::stroke( $colour ),
			$weight,
			$x1,
			self::HEIGHT - $y1,
			$x2,
			self::HEIGHT - $y2
		);
	}

	/**
	 * Place the logo, scaled to fit inside the given box without distortion.
	 *
	 * @param string $jpeg Raw JPEG bytes.
	 */
	public function logo( string $jpeg, float $x, float $y, float $max_w, float $max_h ): void {
		$size = self::jpeg_size( $jpeg );

		if ( null === $size ) {
			return;
		}

		[ $w, $h ] = $size;

		$scale = min( $max_w / $w, $max_h / $h, 1.0 );
		$draw_w = $w * $scale;
		$draw_h = $h * $scale;

		$this->image = array( $jpeg, $w, $h );

		$this->content .= sprintf(
			"q %.2F 0 0 %.2F %.2F %.2F cm /Im1 Do Q\n",
			$draw_w,
			$draw_h,
			$x,
			self::HEIGHT - $y - $draw_h
		);
	}

	/**
	 * Break text to a width and draw it, returning the y below the last line.
	 */
	public function paragraph(
		string $text,
		float $x,
		float $y,
		float $width,
		float $size = 10,
		float $leading = 13,
		string $font = self::REGULAR,
		string $colour = '#333333'
	): float {
		foreach ( self::wrap( $text, $width, $size ) as $line ) {
			$this->text( $line, $x, $y, $size, $font, $colour );
			$y += $leading;
		}

		return $y;
	}

	/* ── Measurement ─────────────────────────────────────────────────── */

	public static function width( string $text, float $size, string $font = self::REGULAR ): float {
		if ( '' === $text ) {
			return 0.0;
		}

		$bold  = self::BOLD === $font;
		$table = $bold ? self::BOLD_WIDTHS : self::WIDTHS;
		$other = $bold ? self::BOLD_FALLBACK_WIDTH : self::FALLBACK_WIDTH;
		$total = 0;

		foreach ( str_split( self::encode( $text ) ) as $char ) {
			$total += $table[ ord( $char ) ] ?? $other;
		}

		return $total / 1000 * $size;
	}

	/**
	 * @return string[]
	 */
	public static function wrap( string $text, float $width, float $size ): array {
		$lines = array();

		foreach ( preg_split( '/\R/', $text ) ?: array() as $paragraph ) {
			$line = '';

			foreach ( preg_split( '/\s+/', trim( $paragraph ) ) ?: array() as $word ) {
				if ( '' === $word ) {
					continue;
				}

				$candidate = '' === $line ? $word : $line . ' ' . $word;

				if ( self::width( $candidate, $size ) > $width && '' !== $line ) {
					$lines[] = $line;
					$line    = $word;
					continue;
				}

				$line = $candidate;
			}

			$lines[] = $line;
		}

		return $lines;
	}

	/* ── Output ──────────────────────────────────────────────────────── */

	public function render(): string {
		$objects = array();

		// 1 catalog, 2 pages, 3 page, 4 content, 5-7 fonts, 8 image.
		$objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
		$objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";

		$resources = '/Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >>';

		if ( null !== $this->image ) {
			$resources .= ' /XObject << /Im1 8 0 R >>';
		}

		$objects[3] = sprintf(
			'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2F %.2F] /Resources << %s >> /Contents 4 0 R >>',
			self::WIDTH,
			self::HEIGHT,
			$resources
		);

		$objects[4] = sprintf(
			"<< /Length %d >>\nstream\n%s\nendstream",
			strlen( $this->content ),
			$this->content
		);

		foreach ( array( 5 => 'Helvetica', 6 => 'Helvetica-Bold', 7 => 'Helvetica-Oblique' ) as $id => $base ) {
			$objects[ $id ] = sprintf(
				'<< /Type /Font /Subtype /Type1 /BaseFont /%s /Encoding /WinAnsiEncoding >>',
				$base
			);
		}

		if ( null !== $this->image ) {
			[ $data, $w, $h ] = $this->image;

			$objects[8] = sprintf(
				"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB"
					. " /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
				$w,
				$h,
				strlen( $data ),
				$data
			);
		}

		$pdf     = "%PDF-1.4\n";
		$offsets = array();

		foreach ( $objects as $id => $body ) {
			$offsets[ $id ] = strlen( $pdf );
			$pdf           .= "$id 0 obj\n$body\nendobj\n";
		}

		$start = strlen( $pdf );
		$count = count( $objects ) + 1;

		$pdf .= "xref\n0 $count\n0000000000 65535 f \n";

		for ( $id = 1; $id < $count; $id++ ) {
			$pdf .= sprintf( "%010d 00000 n \n", $offsets[ $id ] ?? 0 );
		}

		$pdf .= sprintf(
			"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF",
			$count,
			$start
		);

		return $pdf;
	}

	/* ── Internals ───────────────────────────────────────────────────── */

	/** UTF-8 in, WinAnsi out — the encoding the built-in fonts are declared with. */
	private static function encode( string $text ): string {
		$converted = @iconv( 'UTF-8', 'Windows-1252//TRANSLIT', $text );

		return false === $converted ? $text : $converted;
	}

	private static function escape( string $text ): string {
		return strtr(
			self::encode( $text ),
			array(
				'\\' => '\\\\',
				'('  => '\\(',
				')'  => '\\)',
				"\r" => '',
			)
		);
	}

	/** `#rrggbb` as a non-stroking colour operator. */
	private static function fill( string $hex ): string {
		[ $r, $g, $b ] = self::rgb( $hex );

		return sprintf( '%.3F %.3F %.3F rg', $r, $g, $b );
	}

	private static function stroke( string $hex ): string {
		[ $r, $g, $b ] = self::rgb( $hex );

		return sprintf( '%.3F %.3F %.3F RG', $r, $g, $b );
	}

	/**
	 * @return array{float, float, float}
	 */
	private static function rgb( string $hex ): array {
		$hex = ltrim( $hex, '#' );

		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}

		if ( 6 !== strlen( $hex ) || ! ctype_xdigit( $hex ) ) {
			return array( 0.0, 0.0, 0.0 );
		}

		return array(
			hexdec( substr( $hex, 0, 2 ) ) / 255,
			hexdec( substr( $hex, 2, 2 ) ) / 255,
			hexdec( substr( $hex, 4, 2 ) ) / 255,
		);
	}

	/**
	 * Pixel size of a JPEG, read from its frame header.
	 *
	 * @return array{int, int}|null
	 */
	private static function jpeg_size( string $jpeg ): ?array {
		$length = strlen( $jpeg );
		$offset = 2;

		while ( $offset < $length - 9 ) {
			if ( "\xFF" !== $jpeg[ $offset ] ) {
				$offset++;
				continue;
			}

			$marker = ord( $jpeg[ $offset + 1 ] );

			// SOF0-SOF3 and SOF5-SOF15 carry the dimensions; DHT/DAC/RST do not.
			if ( $marker >= 0xC0 && $marker <= 0xCF && 0xC4 !== $marker && 0xC8 !== $marker && 0xCC !== $marker ) {
				$size = unpack( 'nheight/nwidth', substr( $jpeg, $offset + 5, 4 ) );

				return $size ? array( (int) $size['width'], (int) $size['height'] ) : null;
			}

			$block = unpack( 'n', substr( $jpeg, $offset + 2, 2 ) );

			if ( ! $block ) {
				return null;
			}

			$offset += 2 + $block[1];
		}

		return null;
	}
}
