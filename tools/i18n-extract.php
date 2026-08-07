<?php
/**
 * Build languages/booking-suite.pot from the source.
 *
 * Written rather than delegated to `wp i18n make-pot` because WP-CLI is not
 * installed in this environment. The output follows the same conventions, so
 * swapping back to WP-CLI later changes nothing about the catalogue.
 *
 * PHP is read through the tokeniser rather than by regex: a translator comment,
 * an apostrophe inside a string, or a concatenated argument all defeat a
 * pattern match, and a string missed here is a string that silently stays
 * English. JavaScript has no tokeniser to hand, so it is matched — but only for
 * the small set of call shapes this codebase actually uses.
 *
 * Usage:  php tools/i18n-extract.php
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

const DOMAIN = 'booking-suite';

/** Function name => which arguments carry text, 1-indexed. */
const FUNCTIONS = array(
	'__'            => array( 'single' => 1 ),
	'_e'            => array( 'single' => 1 ),
	'esc_html__'    => array( 'single' => 1 ),
	'esc_html_e'    => array( 'single' => 1 ),
	'esc_attr__'    => array( 'single' => 1 ),
	'esc_attr_e'    => array( 'single' => 1 ),
	'_x'            => array( 'single' => 1, 'context' => 2 ),
	'_ex'           => array( 'single' => 1, 'context' => 2 ),
	'esc_html_x'    => array( 'single' => 1, 'context' => 2 ),
	'esc_attr_x'    => array( 'single' => 1, 'context' => 2 ),
	'_n'            => array( 'single' => 1, 'plural' => 2 ),
	'_nx'           => array( 'single' => 1, 'plural' => 2, 'context' => 4 ),
	'_n_noop'       => array( 'single' => 1, 'plural' => 2 ),
);

$root = dirname( __DIR__ );

$entries = array();

foreach ( source_files( $root ) as $file ) {
	$relative = str_replace( '\\', '/', substr( $file, strlen( $root ) + 1 ) );

	$found = 'php' === strtolower( pathinfo( $file, PATHINFO_EXTENSION ) )
		? from_php( $file )
		: from_js( $file );

	foreach ( $found as $entry ) {
		$key = ( $entry['context'] ?? '' ) . "\4" . $entry['single'] . "\4" . ( $entry['plural'] ?? '' );

		if ( ! isset( $entries[ $key ] ) ) {
			$entries[ $key ] = $entry + array( 'refs' => array(), 'comments' => array() );
		}

		$entries[ $key ]['refs'][] = $relative . ':' . $entry['line'];

		if ( ! empty( $entry['comment'] ) ) {
			$entries[ $key ]['comments'][ $entry['comment'] ] = true;
		}
	}
}

ksort( $entries );

$languages = $root . '/languages';

if ( ! is_dir( $languages ) ) {
	mkdir( $languages, 0755, true );
}

file_put_contents( $languages . '/' . DOMAIN . '.pot', build_pot( $entries ) );

// A plain list alongside the catalogue, for reviewing coverage at a glance.
file_put_contents(
	$languages . '/' . DOMAIN . '.strings.json',
	json_encode( array_values( $entries ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES )
);

printf( "%d unique strings written to languages/%s.pot\n", count( $entries ), DOMAIN );

/**
 * Every file worth scanning: plugin PHP, and the two app sources — but never
 * build output or node_modules, which would flood the catalogue with strings
 * from dependencies.
 *
 * @return string[]
 */
function source_files( string $root ): array {
	$files = array();

	$directories = array(
		$root . '/backend',
		$root . '/src',
		$root . '/frontend/site',
		$root . '/frontend/admin',
	);

	foreach ( $directories as $directory ) {
		if ( ! is_dir( $directory ) ) {
			continue;
		}

		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $directory, FilesystemIterator::SKIP_DOTS )
		);

		foreach ( $iterator as $file ) {
			$path = str_replace( '\\', '/', $file->getPathname() );

			if ( preg_match( '#/(node_modules|build|vendor|\.cache)/#', $path ) ) {
				continue;
			}

			if ( preg_match( '/\.(php|jsx?|tsx?)$/i', $path ) ) {
				$files[] = $path;
			}
		}
	}

	$files[] = $root . '/booking_suite.php';

	sort( $files );

	return $files;
}

/**
 * Extract from PHP using the tokeniser.
 *
 * @return array<int, array<string, mixed>>
 */
function from_php( string $file ): array {
	$tokens = token_get_all( (string) file_get_contents( $file ) );
	$found  = array();
	$count  = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		$token = $tokens[ $i ];

		if ( ! is_array( $token ) || T_STRING !== $token[0] ) {
			continue;
		}

		$spec = FUNCTIONS[ $token[1] ] ?? null;

		if ( null === $spec ) {
			continue;
		}

		// A method or property of the same name is not a translation call.
		$previous = previous_significant( $tokens, $i );

		if ( in_array( $previous, array( '->', '::', 'function' ), true ) ) {
			continue;
		}

		$open = next_significant_index( $tokens, $i );

		if ( null === $open || '(' !== $tokens[ $open ] ) {
			continue;
		}

		$arguments = read_arguments( $tokens, $open );

		if ( null === $arguments ) {
			continue;
		}

		$entry = assemble( $spec, $arguments, $token[2] );

		if ( null !== $entry ) {
			$entry['comment'] = translator_comment( $tokens, $i );
			$found[]          = $entry;
		}
	}

	return $found;
}

/**
 * The nearest preceding /* translators: ... *\/ comment, if any.
 */
function translator_comment( array $tokens, int $index ): string {
	for ( $i = $index - 1; $i >= 0 && $i > $index - 12; $i-- ) {
		$token = $tokens[ $i ];

		if ( is_array( $token ) && in_array( $token[0], array( T_COMMENT, T_DOC_COMMENT ), true ) ) {
			if ( preg_match( '/translators:/i', $token[1] ) ) {
				$text = preg_replace( '#^/\*+|\*+/$|^//#', '', trim( $token[1] ) );

				return trim( preg_replace( '/\s+/', ' ', (string) $text ) );
			}
		}
	}

	return '';
}

function previous_significant( array $tokens, int $index ): string {
	for ( $i = $index - 1; $i >= 0; $i-- ) {
		$token = $tokens[ $i ];

		if ( is_array( $token ) ) {
			if ( in_array( $token[0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
				continue;
			}

			return $token[1];
		}

		return $token;
	}

	return '';
}

function next_significant_index( array $tokens, int $index ): ?int {
	$count = count( $tokens );

	for ( $i = $index + 1; $i < $count; $i++ ) {
		$token = $tokens[ $i ];

		if ( is_array( $token ) && in_array( $token[0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
			continue;
		}

		return $i;
	}

	return null;
}

/**
 * Read the argument list at `$open`, returning each argument as either a
 * literal string or null when it is an expression.
 *
 * @return array<int, string|null>|null Null when the list never closes.
 */
function read_arguments( array $tokens, int $open ): ?array {
	$depth     = 0;
	$count     = count( $tokens );
	$arguments = array();
	$current   = array();

	for ( $i = $open; $i < $count; $i++ ) {
		$token = $tokens[ $i ];

		if ( ! is_array( $token ) ) {
			if ( '(' === $token ) {
				$depth++;

				if ( 1 === $depth ) {
					continue;
				}
			} elseif ( ')' === $token ) {
				$depth--;

				if ( 0 === $depth ) {
					$arguments[] = literal( $current );

					return $arguments;
				}
			} elseif ( ',' === $token && 1 === $depth ) {
				$arguments[] = literal( $current );
				$current     = array();

				continue;
			}
		}

		if ( $depth >= 1 ) {
			$current[] = $token;
		}
	}

	return null;
}

/**
 * One argument's tokens => its literal string value, or null.
 *
 * Adjacent string literals joined with `.` are folded, which is how long
 * messages are written in this codebase.
 */
function literal( array $tokens ): ?string {
	$parts = array();

	foreach ( $tokens as $token ) {
		if ( is_array( $token ) ) {
			if ( in_array( $token[0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
				continue;
			}

			if ( T_CONSTANT_ENCAPSED_STRING === $token[0] ) {
				$parts[] = unquote( $token[1] );
				continue;
			}

			return null;
		}

		if ( '.' === $token ) {
			continue;
		}

		return null;
	}

	return $parts ? implode( '', $parts ) : null;
}

/** A quoted PHP literal => its value. */
function unquote( string $raw ): string {
	$quote = $raw[0];
	$body  = substr( $raw, 1, -1 );

	if ( "'" === $quote ) {
		return str_replace( array( "\\'", '\\\\' ), array( "'", '\\' ), $body );
	}

	return stripcslashes( $body );
}

/**
 * Turn an argument list into a catalogue entry, if the domain matches.
 *
 * @return array<string, mixed>|null
 */
function assemble( array $spec, array $arguments, int $line ): ?array {
	$single = $arguments[ $spec['single'] - 1 ] ?? null;

	if ( ! is_string( $single ) || '' === $single ) {
		return null;
	}

	// The domain is the last argument of every one of these functions.
	if ( ! in_array( DOMAIN, array_filter( $arguments, 'is_string' ), true ) ) {
		return null;
	}

	$entry = array(
		'single' => $single,
		'line'   => $line,
	);

	if ( isset( $spec['plural'] ) ) {
		$plural = $arguments[ $spec['plural'] - 1 ] ?? null;

		if ( ! is_string( $plural ) ) {
			return null;
		}

		$entry['plural'] = $plural;
	}

	if ( isset( $spec['context'] ) ) {
		$context = $arguments[ $spec['context'] - 1 ] ?? null;

		if ( is_string( $context ) ) {
			$entry['context'] = $context;
		}
	}

	return $entry;
}

/**
 * Extract from JavaScript.
 *
 * Only the call shapes this codebase uses: a literal first argument, optional
 * literal plural, and the domain somewhere in the list. Anything built from a
 * variable is skipped — it could not be extracted statically anyway.
 *
 * @return array<int, array<string, mixed>>
 */
function from_js( string $file ): array {
	$source = (string) file_get_contents( $file );
	$found  = array();

	$string = "(?:'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\")";

	// _n( single, plural, count, domain )
	$plural = '/\b_n\(\s*' . $string . '\s*,\s*' . $string . '\s*,/s';

	if ( preg_match_all( $plural, $source, $matches, PREG_OFFSET_CAPTURE | PREG_SET_ORDER ) ) {
		foreach ( $matches as $match ) {
			$found[] = array(
				'single'  => js_unquote( $match[1][0] ?? '', $match[2][0] ?? '' ),
				'plural'  => js_unquote( $match[3][0] ?? '', $match[4][0] ?? '' ),
				'line'    => line_at( $source, $match[0][1] ),
				'comment' => js_comment( $source, $match[0][1] ),
			);
		}
	}

	// __( text, domain ) — the domain is required, which keeps this from
	// matching every other single-argument call named __.
	$single = '/(?<![\w$.])__\(\s*' . $string . "\s*,\s*'" . preg_quote( DOMAIN, '/' ) . "'\s*\)/s";

	if ( preg_match_all( $single, $source, $matches, PREG_OFFSET_CAPTURE | PREG_SET_ORDER ) ) {
		foreach ( $matches as $match ) {
			$found[] = array(
				'single'  => js_unquote( $match[1][0] ?? '', $match[2][0] ?? '' ),
				'line'    => line_at( $source, $match[0][1] ),
				'comment' => js_comment( $source, $match[0][1] ),
			);
		}
	}

	// _x( text, context, domain )
	$context = '/(?<![\w$.])_x\(\s*' . $string . '\s*,\s*' . $string . '\s*,/s';

	if ( preg_match_all( $context, $source, $matches, PREG_OFFSET_CAPTURE | PREG_SET_ORDER ) ) {
		foreach ( $matches as $match ) {
			$found[] = array(
				'single'  => js_unquote( $match[1][0] ?? '', $match[2][0] ?? '' ),
				'context' => js_unquote( $match[3][0] ?? '', $match[4][0] ?? '' ),
				'line'    => line_at( $source, $match[0][1] ),
				'comment' => js_comment( $source, $match[0][1] ),
			);
		}
	}

	return array_values(
		array_filter( $found, static fn( array $entry ): bool => '' !== $entry['single'] )
	);
}

function js_unquote( string $single, string $double ): string {
	$raw = '' !== $single ? $single : $double;

	return stripcslashes( $raw );
}

function js_comment( string $source, int $offset ): string {
	$before = substr( $source, max( 0, $offset - 400 ), min( 400, $offset ) );

	if ( preg_match_all( '#/\*\s*(translators:.*?)\*/#is', $before, $matches ) ) {
		return trim( preg_replace( '/\s+/', ' ', end( $matches[1] ) ) );
	}

	return '';
}

function line_at( string $source, int $offset ): int {
	return substr_count( substr( $source, 0, $offset ), "\n" ) + 1;
}

/**
 * @param array<string, array<string, mixed>> $entries
 */
function build_pot( array $entries ): string {
	$header = <<<POT
# Copyright (C) Booking Suite
# This file is distributed under the same licence as the Booking Suite plugin.
msgid ""
msgstr ""
"Project-Id-Version: Booking Suite\\n"
"Report-Msgid-Bugs-To: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Language-Team: \\n"
"X-Domain: booking-suite\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

POT;

	$out = $header;

	foreach ( $entries as $entry ) {
		$out .= "\n";

		foreach ( array_keys( $entry['comments'] ) as $comment ) {
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
			$out .= "msgstr[0] \"\"\n";
			$out .= "msgstr[1] \"\"\n";
		} else {
			$out .= "msgstr \"\"\n";
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
