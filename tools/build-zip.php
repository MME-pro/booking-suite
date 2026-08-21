<?php
/**
 * Package the plugin for upload to a live site.
 *
 * Written rather than done with a shell tool for two reasons, both learned the
 * hard way:
 *
 *   · PowerShell's Compress-Archive writes backslash separators into the
 *     archive. Windows unpacks it, Linux does not — the plugin arrives as a
 *     handful of files with backslashes in their names and nothing works.
 *   · Every file must sit under a top-level directory named exactly
 *     `booking_suite`. WordPress installs a differently named folder as a
 *     *second* copy of the plugin, and activating it fatals on the duplicate
 *     class and constant declarations.
 *
 * Usage:  php tools/build-zip.php [output-directory]
 */

declare( strict_types=1 );

/** The folder name inside the archive. Not negotiable; see above. */
const FOLDER = 'booking_suite';

/**
 * Paths never shipped: build inputs, dependencies, and version control.
 *
 * Matched against the path relative to the plugin root, so `node_modules`
 * catches it at any depth.
 */
const SKIP_DIRS = array(
	'.git',
	'.github',
	'node_modules',
	'vendor/bin',
	'.wordpress-org',
);

/** Files never shipped, matched on basename. */
const SKIP_FILES = array(
	'.gitignore',
	'.gitattributes',
	'.eslintrc',
	'.eslintrc.js',
	'.prettierrc',
	'.prettierrc.js',
	'.editorconfig',
	'.DS_Store',
	'Thumbs.db',
	'package-lock.json',
	'untranslated.txt',
	'booking-suite.strings.json',
);

/** Extensions never shipped. */
const SKIP_EXT = array( 'map', 'log', 'zip' );

$root = dirname( __DIR__ );
$out  = rtrim( $argv[1] ?? $root, "/\\" );

if ( ! class_exists( 'ZipArchive' ) ) {
	fwrite( STDERR, "ext-zip is not loaded; run with an ini that enables it.\n" );
	exit( 1 );
}

// The version in the plugin header is what WordPress compares on update, so
// the archive is named after it rather than after the date.
$header = (string) file_get_contents( $root . '/' . FOLDER . '.php' );

if ( ! preg_match( '/^\s*\*\s*Version:\s*(.+)$/m', $header, $match ) ) {
	fwrite( STDERR, "No Version header found in " . FOLDER . ".php\n" );
	exit( 1 );
}

$version = trim( $match[1] );

/**
 * Should this path be left out of the archive?
 *
 * @param string $relative Path relative to the plugin root, forward slashes.
 * @param bool   $is_dir   Whether it is a directory.
 * @return bool True to skip.
 */
function is_skipped( string $relative, bool $is_dir ): bool {
	foreach ( SKIP_DIRS as $dir ) {
		if ( $relative === $dir || str_starts_with( $relative, $dir . '/' ) || str_contains( $relative, '/' . $dir . '/' ) || str_ends_with( $relative, '/' . $dir ) ) {
			return true;
		}
	}

	if ( $is_dir ) {
		return false;
	}

	if ( in_array( basename( $relative ), SKIP_FILES, true ) ) {
		return true;
	}

	return in_array( strtolower( pathinfo( $relative, PATHINFO_EXTENSION ) ), SKIP_EXT, true );
}

$target = $out . '/' . FOLDER . '-' . $version . '.zip';

if ( file_exists( $target ) && ! unlink( $target ) ) {
	fwrite( STDERR, "Could not replace $target\n" );
	exit( 1 );
}

$zip = new ZipArchive();

if ( true !== $zip->open( $target, ZipArchive::CREATE ) ) {
	fwrite( STDERR, "Could not create $target\n" );
	exit( 1 );
}

$files = new RecursiveIteratorIterator(
	new RecursiveCallbackFilterIterator(
		new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ),
		static function ( SplFileInfo $file ) use ( $root ): bool {
			$relative = str_replace( '\\', '/', substr( $file->getPathname(), strlen( $root ) + 1 ) );

			return ! is_skipped( $relative, $file->isDir() );
		}
	),
	RecursiveIteratorIterator::LEAVES_ONLY
);

$count = 0;
$bytes = 0;

foreach ( $files as $file ) {
	if ( ! $file->isFile() ) {
		continue;
	}

	$relative = str_replace( '\\', '/', substr( $file->getPathname(), strlen( $root ) + 1 ) );

	// Forward slashes, always: addFile() would otherwise store whatever the
	// platform's separator is, which is the bug this script exists to avoid.
	$zip->addFile( $file->getPathname(), FOLDER . '/' . $relative );

	++$count;
	$bytes += $file->getSize();
}

$zip->close();

printf(
	"%s\n  %d files, %.1f MB uncompressed, %.1f MB zipped\n",
	$target,
	$count,
	$bytes / 1048576,
	filesize( $target ) / 1048576
);
