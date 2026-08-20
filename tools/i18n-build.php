<?php
/**
 * Compile the German catalogue.
 *
 * Reads the extracted strings and languages/de_DE.map.php, then writes:
 *
 *   languages/booking-suite-de_DE.po    the reviewable catalogue
 *   languages/booking-suite-de_DE.mo    what PHP loads
 *   languages/booking-suite-de_DE-*.json  what the JavaScript bundles load
 *
 * Every translation is checked before it is written. A German string that lost
 * a %s, gained a %d, or mangled a {{token}} is not a cosmetic problem — it is a
 * PHP warning, a wrong number, or an email that ships a literal placeholder to
 * a guest. Those fail the build rather than shipping.
 *
 * Usage:  php tools/i18n-extract.php && php tools/i18n-build.php
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

const DOMAIN = 'booking-suite';
const LOCALE = 'de_DE';
const PLURALS = 'nplurals=2; plural=(n != 1);';

/**
 * Which JavaScript sources feed which registered script handle.
 *
 * The JSON files are per handle, so a string only reaches the browser if it is
 * listed under the bundle that uses it.
 */
const BUNDLES = array(
	'booking-suite-admin' => array(
		'source' => 'frontend/admin/app/src/',
		'src'    => 'wp-content/plugins/booking_suite/frontend/admin/app/build/index.js',
	),
	'booking-suite-site'  => array(
		'source' => 'frontend/site/app/src/',
		'src'    => 'wp-content/plugins/booking_suite/frontend/site/app/build/index.js',
	),
);

$root      = dirname( __DIR__ );
$languages = $root . '/languages';

$entries = json_decode( (string) file_get_contents( $languages . '/' . DOMAIN . '.strings.json' ), true );

if ( ! is_array( $entries ) ) {
	fwrite( STDERR, "Run tools/i18n-extract.php first.\n" );
	exit( 1 );
}

$map = require $languages . '/' . LOCALE . '.map.php';

$problems   = array();
$missing    = array();
$translated = array();

foreach ( $entries as $entry ) {
	$single = $entry['single'];

	if ( ! array_key_exists( $single, $map ) ) {
		$missing[] = $single;
		continue;
	}

	$value = $map[ $single ];

	$forms = is_array( $value ) ? array_values( $value ) : array( $value );

	// A plural source needs both forms; a singular source needs exactly one.
	$expected = isset( $entry['plural'] ) ? 2 : 1;

	if ( count( $forms ) !== $expected ) {
		$problems[] = sprintf(
			'"%s": expected %d form(s), got %d',
			short( $single ),
			$expected,
			count( $forms )
		);

		continue;
	}

	$sources = isset( $entry['plural'] ) ? array( $single, $entry['plural'] ) : array( $single );

	foreach ( $forms as $index => $form ) {
		if ( '' === trim( $form ) ) {
			$problems[] = sprintf( '"%s": empty translation', short( $single ) );
			continue;
		}

		$source = $sources[ $index ] ?? $sources[ 0 ];

		foreach ( array( 'placeholders', 'tokens' ) as $check ) {
			$want = 'placeholders' === $check ? placeholders( $source ) : tokens( $source );
			$got  = 'placeholders' === $check ? placeholders( $form ) : tokens( $form );

			if ( $want !== $got ) {
				$problems[] = sprintf(
					'"%s": %s differ — source [%s], German [%s]',
					short( $source ),
					$check,
					implode( ', ', $want ),
					implode( ', ', $got )
				);
			}
		}
	}

	$translated[] = $entry + array( 'forms' => $forms );
}

if ( $problems ) {
	fwrite( STDERR, "Refusing to build — " . count( $problems ) . " problem(s):\n" );

	foreach ( $problems as $problem ) {
		fwrite( STDERR, '  - ' . $problem . "\n" );
	}

	exit( 1 );
}

file_put_contents( $languages . '/' . DOMAIN . '-' . LOCALE . '.po', build_po( $translated ) );
file_put_contents( $languages . '/' . DOMAIN . '-' . LOCALE . '.mo', build_mo( $translated ) );

foreach ( BUNDLES as $handle => $bundle ) {
	$subset = array_values(
		array_filter(
			$translated,
			static function ( array $entry ) use ( $bundle ): bool {
				foreach ( $entry['refs'] as $ref ) {
					if ( str_starts_with( $ref, $bundle['source'] ) ) {
						return true;
					}
				}

				return false;
			}
		)
	);

	$json = build_json( $subset );

	/*
	 * Two filenames for the same data. WordPress looks for the handle-based
	 * name first, and falls back to one keyed by an md5 of the script's URL
	 * path — writing both means the translations load whichever route the
	 * running WordPress version takes.
	 */
	$base = $languages . '/' . DOMAIN . '-' . LOCALE . '-';

	file_put_contents( $base . $handle . '.json', $json );
	file_put_contents( $base . md5( $bundle['src'] ) . '.json', $json );

	printf( "%s: %d strings\n", $handle, count( $subset ) );
}

printf(
	"\n%d translated, %d untranslated (left in English).\n",
	count( $translated ),
	count( $missing )
);

/*
 * The list is removed when nothing is missing, rather than left behind. A file
 * that is only ever written and never cleared outlives the work it describes:
 * the next person reads a stale list, believes there are strings to translate,
 * and goes looking for entries that were added several builds ago.
 */
if ( $missing ) {
	file_put_contents( $languages . '/untranslated.txt', implode( "\n", $missing ) . "\n" );
	echo "Untranslated strings listed in languages/untranslated.txt\n";
} elseif ( is_file( $languages . '/untranslated.txt' ) ) {
	unlink( $languages . '/untranslated.txt' );
}

/** A string short enough for an error message. */
function short( string $value ): string {
	$flat = preg_replace( '/\s+/', ' ', $value );

	return mb_strlen( (string) $flat ) > 60
		? mb_substr( (string) $flat, 0, 57 ) . '…'
		: (string) $flat;
}

/**
 * The printf placeholders in a string, sorted so order may differ but the set
 * may not — German word order legitimately moves %1$s before %2$s.
 *
 * @return string[]
 */
function placeholders( string $value ): array {
	preg_match_all( '/%(?:\d+\$)?[+-]?[\d.]*[bcdeEfFgGosuxX%]/', $value, $matches );

	$found = array_filter( $matches[0], static fn( string $token ): bool => '%%' !== $token );

	sort( $found );

	return array_values( $found );
}

/**
 * The {{token}} names in a string — the email-template placeholders.
 *
 * @return string[]
 */
function tokens( string $value ): array {
	preg_match_all( '/\{\{[a-z0-9_]+\}\}/i', $value, $matches );

	$found = $matches[0];

	sort( $found );

	return array_values( $found );
}

/**
 * @param array<int, array<string, mixed>> $entries
 */
function build_po( array $entries ): string {
	$out = '# German translation for the Booking Suite plugin.' . "\n"
		. '# Generated by tools/i18n-build.php from languages/' . LOCALE . '.map.php — do not edit by hand.' . "\n"
		. 'msgid ""' . "\n"
		. 'msgstr ""' . "\n"
		. '"Project-Id-Version: Booking Suite\n"' . "\n"
		. '"MIME-Version: 1.0\n"' . "\n"
		. '"Content-Type: text/plain; charset=UTF-8\n"' . "\n"
		. '"Content-Transfer-Encoding: 8bit\n"' . "\n"
		. '"Language: de_DE\n"' . "\n"
		. '"Plural-Forms: ' . PLURALS . '\n"' . "\n"
		. '"X-Domain: ' . DOMAIN . '\n"' . "\n";

	foreach ( $entries as $entry ) {
		$out .= "\n";

		foreach ( array_keys( $entry['comments'] ?? array() ) as $comment ) {
			$out .= '#. ' . $comment . "\n";
		}

		$refs = array_unique( $entry['refs'] );
		sort( $refs );

		foreach ( array_chunk( $refs, 4 ) as $chunk ) {
			$out .= '#: ' . implode( ' ', $chunk ) . "\n";
		}

		if ( isset( $entry['context'] ) ) {
			$out .= 'msgctxt ' . po_quote( $entry['context'] ) . "\n";
		}

		$out .= 'msgid ' . po_quote( $entry['single'] ) . "\n";

		if ( isset( $entry['plural'] ) ) {
			$out .= 'msgid_plural ' . po_quote( $entry['plural'] ) . "\n";
			$out .= 'msgstr[0] ' . po_quote( $entry['forms'][0] ) . "\n";
			$out .= 'msgstr[1] ' . po_quote( $entry['forms'][1] ) . "\n";
		} else {
			$out .= 'msgstr ' . po_quote( $entry['forms'][0] ) . "\n";
		}
	}

	return $out;
}

function po_quote( string $value ): string {
	$escaped = str_replace(
		array( '\\', '"', "\n", "\t", "\r" ),
		array( '\\\\', '\\"', '\\n', '\\t', '' ),
		$value
	);

	return '"' . $escaped . '"';
}

/**
 * Write a binary .mo.
 *
 * The format is a header, two tables of (length, offset) pairs, and the string
 * data. The hash table is optional and omitted — gettext readers, WordPress
 * included, fall back to a binary search over the sorted original table, which
 * is why the entries are sorted by their key below.
 *
 * @param array<int, array<string, mixed>> $entries
 */
function build_mo( array $entries ): string {
	$pairs = array(
		// The metadata header lives in the entry with an empty msgid.
		'' => "Project-Id-Version: Booking Suite\nMIME-Version: 1.0\n"
			. "Content-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n"
			. 'Language: ' . LOCALE . "\nPlural-Forms: " . PLURALS . "\n",
	);

	foreach ( $entries as $entry ) {
		$key = $entry['single'];

		if ( isset( $entry['context'] ) ) {
			$key = $entry['context'] . "\4" . $key;
		}

		if ( isset( $entry['plural'] ) ) {
			$key  .= "\0" . $entry['plural'];
			$value = $entry['forms'][0] . "\0" . $entry['forms'][1];
		} else {
			$value = $entry['forms'][0];
		}

		$pairs[ $key ] = $value;
	}

	// Sorted by byte value: what a binary-search reader requires.
	ksort( $pairs, SORT_STRING );

	$count   = count( $pairs );
	$originals    = array();
	$translations = array();

	// 7 unsigned longs of header, then two tables of 2 longs per entry.
	$offset = 28 + ( $count * 8 * 2 );

	foreach ( array_keys( $pairs ) as $key ) {
		$originals[] = array( strlen( $key ), $offset );
		$offset     += strlen( $key ) + 1;
	}

	foreach ( $pairs as $value ) {
		$translations[] = array( strlen( $value ), $offset );
		$offset        += strlen( $value ) + 1;
	}

	$mo = pack(
		'V7',
		0x950412de, // Magic, little-endian.
		0,          // Revision.
		$count,
		28,                        // Originals table.
		28 + ( $count * 8 ),       // Translations table.
		0,                         // Hash table size: none.
		28 + ( $count * 8 * 2 )    // Hash table offset.
	);

	foreach ( array_merge( $originals, $translations ) as $pair ) {
		$mo .= pack( 'VV', $pair[0], $pair[1] );
	}

	// NUL after each string, as the offsets above assume.
	foreach ( array_keys( $pairs ) as $key ) {
		$mo .= $key . "\0";
	}

	foreach ( $pairs as $value ) {
		$mo .= $value . "\0";
	}

	return $mo;
}

/**
 * The JED format @wordpress/i18n reads.
 *
 * The inner key is always "messages" regardless of the text domain — that is
 * what the runtime looks for, and using the domain name here yields a file that
 * loads without error and translates nothing.
 *
 * @param array<int, array<string, mixed>> $entries
 */
function build_json( array $entries ): string {
	$messages = array(
		'' => array(
			'domain'       => 'messages',
			'lang'         => LOCALE,
			'plural-forms' => PLURALS,
		),
	);

	foreach ( $entries as $entry ) {
		$key = isset( $entry['context'] )
			? $entry['context'] . "\4" . $entry['single']
			: $entry['single'];

		$messages[ $key ] = array_values( $entry['forms'] );
	}

	return (string) json_encode(
		array(
			'translation-revision-date' => gmdate( 'Y-m-d H:i:sO' ),
			'generator'                 => 'booking-suite/tools/i18n-build.php',
			'domain'                    => 'messages',
			'locale_data'               => array( 'messages' => $messages ),
		),
		JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
	);
}
