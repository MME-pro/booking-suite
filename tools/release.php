<?php
/**
 * Publish a GitHub release carrying the built plugin zip.
 *
 * The asset is the point. GitHub attaches a source archive to every release
 * automatically, but the admin app's compiled bundle is gitignored, so that
 * archive installs a plugin with a working guest site and a blank admin
 * screen. Updater.php therefore ignores source archives and looks only for an
 * attached `booking_suite-*.zip`, which is what this script uploads.
 *
 * Authentication is the credential git already uses for this repository, read
 * through `git credential fill`. Nothing new to store, and nothing printed.
 *
 * Usage:  php tools/release.php <zip-path> [--notes="..."] [--dry-run]
 */

declare( strict_types=1 );

const REPOSITORY = 'MME-pro/booking-suite';

$root = dirname( __DIR__ );
$args = array_slice( $argv, 1 );
$zip  = '';
$notes = '';
$dry   = false;

foreach ( $args as $arg ) {
	if ( '--dry-run' === $arg ) {
		$dry = true;
	} elseif ( str_starts_with( $arg, '--notes=' ) ) {
		$notes = substr( $arg, 8 );
	} else {
		$zip = $arg;
	}
}

if ( '' === $zip || ! is_file( $zip ) ) {
	fwrite( STDERR, "Usage: php tools/release.php <zip-path> [--notes=\"...\"] [--dry-run]\n" );
	exit( 1 );
}

// The tag is the plugin header's version, not a number passed in: the header
// is what WordPress compares on update, so anything else could publish a
// release that no site would ever install.
$header = (string) file_get_contents( $root . '/booking_suite.php' );

if ( ! preg_match( '/^\s*\*\s*Version:\s*(.+)$/m', $header, $match ) ) {
	fwrite( STDERR, "No Version header found.\n" );
	exit( 1 );
}

$version = trim( $match[1] );
$tag     = 'v' . $version;

/**
 * The token git already holds for github.com.
 *
 * @return string The token, or '' if the helper has nothing.
 */
function credential(): string {
	$descriptors = array(
		0 => array( 'pipe', 'r' ),
		1 => array( 'pipe', 'w' ),
		2 => array( 'pipe', 'w' ),
	);

	$process = proc_open( 'git credential fill', $descriptors, $pipes );

	if ( ! is_resource( $process ) ) {
		return '';
	}

	fwrite( $pipes[0], "protocol=https\nhost=github.com\n\n" );
	fclose( $pipes[0] );

	$out = (string) stream_get_contents( $pipes[1] );

	fclose( $pipes[1] );
	fclose( $pipes[2] );
	proc_close( $process );

	foreach ( preg_split( '/\r\n|\n/', $out ) as $line ) {
		if ( str_starts_with( $line, 'password=' ) ) {
			return substr( $line, 9 );
		}
	}

	return '';
}

/**
 * A certificate authority bundle for curl, or '' to use whatever curl has.
 *
 * Local by Flywheel's CLI has no php.ini and so no curl.cainfo, which makes
 * every HTTPS request fail verification. WordPress ships the bundle its own
 * HTTP layer trusts three directories above the plugin, so that is what gets
 * used — never a disabled CURLOPT_SSL_VERIFYPEER, which would make the token
 * in these requests interceptable.
 *
 * @return string A readable path, or ''.
 */
function ca_bundle(): string {
	$candidates = array(
		getenv( 'CURL_CA_BUNDLE' ) ?: '',
		dirname( __DIR__, 4 ) . '/wp-includes/certificates/ca-bundle.crt',
		ini_get( 'curl.cainfo' ) ?: '',
	);

	foreach ( $candidates as $path ) {
		if ( '' !== $path && is_readable( $path ) ) {
			return $path;
		}
	}

	return '';
}
/**
 * One GitHub API call.
 *
 * @param string $method HTTP verb.
 * @param string $url    Absolute URL.
 * @param string $token  Bearer token.
 * @param mixed  $body   Array to send as JSON, or a raw string for uploads.
 * @param string $type   Content-Type when $body is raw.
 * @return array{status: int, body: mixed}
 */
function api( string $method, string $url, string $token, $body = null, string $type = 'application/json' ): array {
	$headers = array(
		'Accept: application/vnd.github+json',
		'Authorization: Bearer ' . $token,
		'User-Agent: booking-suite-release',
		'X-GitHub-Api-Version: 2022-11-28',
	);

	$payload = null;

	if ( null !== $body ) {
		$payload   = is_string( $body ) ? $body : (string) json_encode( $body );
		$headers[] = 'Content-Type: ' . $type;
		$headers[] = 'Content-Length: ' . strlen( $payload );
	}

	$curl = curl_init( $url );

	$options = array(
		CURLOPT_CUSTOMREQUEST  => $method,
		CURLOPT_HTTPHEADER     => $headers,
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_FOLLOWLOCATION => true,
		CURLOPT_TIMEOUT        => 300,
	);

	$bundle = ca_bundle();

	if ( '' !== $bundle ) {
		$options[ CURLOPT_CAINFO ] = $bundle;
	}

	curl_setopt_array( $curl, $options );

	if ( null !== $payload ) {
		curl_setopt( $curl, CURLOPT_POSTFIELDS, $payload );
	}

	$response = (string) curl_exec( $curl );
	$status   = (int) curl_getinfo( $curl, CURLINFO_HTTP_CODE );

	curl_close( $curl );

	return array(
		'status' => $status,
		'body'   => json_decode( $response, true ),
	);
}

$token = credential();

if ( '' === $token ) {
	fwrite( STDERR, "No GitHub credential available from git.\n" );
	exit( 1 );
}

printf( "release %s\n  asset: %s (%.1f MB)\n", $tag, basename( $zip ), filesize( $zip ) / 1048576 );

if ( $dry ) {
	$check = api( 'GET', 'https://api.github.com/repos/' . REPOSITORY, $token );

	printf(
		"  dry run — repo reachable: HTTP %d, push access: %s\n",
		$check['status'],
		! empty( $check['body']['permissions']['push'] ) ? 'yes' : 'NO'
	);

	exit( 0 );
}

// An existing release for this tag is replaced rather than duplicated: two
// releases on one tag is a state GitHub allows and nothing can read sensibly.
$existing = api( 'GET', 'https://api.github.com/repos/' . REPOSITORY . '/releases/tags/' . $tag, $token );

if ( 200 === $existing['status'] ) {
	$id = (int) $existing['body']['id'];

	printf( "  replacing the existing release for %s\n", $tag );

	foreach ( $existing['body']['assets'] ?? array() as $asset ) {
		api( 'DELETE', 'https://api.github.com/repos/' . REPOSITORY . '/releases/assets/' . (int) $asset['id'], $token );
	}
} else {
	$created = api(
		'POST',
		'https://api.github.com/repos/' . REPOSITORY . '/releases',
		$token,
		array(
			'tag_name' => $tag,
			'name'     => $tag,
			'body'     => '' !== $notes ? $notes : 'Booking Suite ' . $version,
			'draft'    => false,
			// A prerelease is skipped by the updater, so releases made here
			// are always full ones.
			'prerelease' => false,
		)
	);

	if ( 201 !== $created['status'] ) {
		fwrite( STDERR, sprintf( "Could not create the release: HTTP %d %s\n", $created['status'], (string) ( $created['body']['message'] ?? '' ) ) );
		exit( 1 );
	}

	$id = (int) $created['body']['id'];

	printf( "  created release %d\n", $id );
}

$upload = api(
	'POST',
	'https://uploads.github.com/repos/' . REPOSITORY . '/releases/' . $id . '/assets?name=' . rawurlencode( basename( $zip ) ),
	$token,
	(string) file_get_contents( $zip ),
	'application/zip'
);

if ( 201 !== $upload['status'] ) {
	fwrite( STDERR, sprintf( "Could not upload the asset: HTTP %d %s\n", $upload['status'], (string) ( $upload['body']['message'] ?? '' ) ) );
	exit( 1 );
}

printf(
	"  uploaded %s\n  %s\n",
	(string) $upload['body']['name'],
	(string) ( $upload['body']['browser_download_url'] ?? '' )
);
