<?php
/**
 * Calendar import from the command line.
 *
 * The same reader the admin screen uses, driven from a terminal — useful for
 * trying a portal export before letting it near the live calendar, and for
 * undoing one afterwards.
 *
 *   php tools/ical-import.php apartments
 *   php tools/ical-import.php preview <apartment-id> <file.ics|url>
 *   php tools/ical-import.php apply   <apartment-id> <file.ics|url> [--remove-missing] [--all-dates]
 *   php tools/ical-import.php locks   [apartment-id]
 *   php tools/ical-import.php feeds
 *   php tools/ical-import.php sync    [feed-id]
 *   php tools/ical-import.php rollback [source] [--yes]
 *
 * `preview` writes nothing and prints exactly what `apply` would do — it is the
 * same code path with the dry-run flag set. `rollback` removes locks that came
 * from an import and only those: a lock made by hand in the Availability screen
 * carries the source 'manual' and is never touched.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

require_once __DIR__ . '/bootstrap.php';

use BookingSuite\Backend\Installer;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\BlocksRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use BookingSuite\Backend\Schemas\BlocksTable;
use BookingSuite\Backend\Support\IcalImporter;

if ( 'cli' !== PHP_SAPI ) {
	exit( 'This tool runs on the command line only.' . PHP_EOL );
}

/*
 * The admin upgrade runs on admin_init, which never fires here. Without this
 * the first CLI import would fail on a missing column.
 */
Installer::maybe_upgrade();

$argv    = $_SERVER['argv'];
$command = $argv[1] ?? 'help';
$flags   = array_values( array_filter( $argv, static fn( string $a ): bool => str_starts_with( $a, '--' ) ) );
$args    = array_values(
	array_filter(
		array_slice( $argv, 2 ),
		static fn( string $a ): bool => ! str_starts_with( $a, '--' )
	)
);

$has = static fn( string $flag ): bool => in_array( '--' . $flag, $flags, true );

$line = static function ( string $text = '' ): void {
	echo $text . PHP_EOL;
};

$rule = static function () use ( $line ): void {
	$line( str_repeat( '-', 78 ) );
};

switch ( $command ) {
	case 'apartments':
		$line( 'ID    Apartment' );
		$rule();

		foreach ( ApartmentsRepository::all() as $apartment ) {
			$line( str_pad( (string) $apartment['id'], 6 ) . $apartment['name'] );
		}

		break;

	case 'preview':
	case 'apply':
		$apartment_id = (int) ( $args[0] ?? 0 );
		$target       = (string) ( $args[1] ?? '' );

		if ( ! $apartment_id || '' === $target ) {
			$line( 'Usage: php tools/ical-import.php ' . $command . ' <apartment-id> <file.ics|url>' );
			exit( 1 );
		}

		$content = bks_read_calendar( $target );

		if ( null === $content ) {
			$line( 'Could not read: ' . $target );
			exit( 1 );
		}

		$report = IcalImporter::import(
			$apartment_id,
			$content,
			array(
				'removeMissing' => $has( 'remove-missing' ),
				// Past dates are skipped by default; a portal export routinely
				// carries a year of history nobody needs blocked.
				'skipPast'      => ! $has( 'all-dates' ),
				'dryRun'        => 'preview' === $command,
			)
		);

		if ( is_wp_error( $report ) ) {
			$line( 'Error: ' . $report->get_error_message() );
			exit( 1 );
		}

		bks_print_report( $report );
		break;

	case 'locks':
		$only = isset( $args[0] ) ? (int) $args[0] : 0;

		$locks = array_filter(
			BlocksRepository::all_imported(),
			static fn( array $lock ): bool => ! $only || $only === $lock['apartmentId']
		);

		$line( sprintf( '%d imported lock(s).', count( $locks ) ) );
		$rule();
		$line(
			str_pad( 'ID', 7 ) . str_pad( 'APARTMENT', 22 ) . str_pad( 'SOURCE', 12 )
			. str_pad( 'FROM', 12 ) . str_pad( 'TO', 12 ) . 'REASON'
		);
		$rule();

		foreach ( $locks as $lock ) {
			$line(
				str_pad( (string) $lock['id'], 7 )
				. str_pad( substr( $lock['apartmentName'], 0, 20 ), 22 )
				. str_pad( $lock['source'], 12 )
				. str_pad( substr( $lock['startsAt'], 0, 10 ), 12 )
				. str_pad( substr( $lock['endsAt'], 0, 10 ), 12 )
				. $lock['reason']
			);
		}

		break;

	case 'feeds':
		$feeds = IcalFeedsRepository::all();

		$line( sprintf( '%d subscription(s).', count( $feeds ) ) );
		$rule();

		foreach ( $feeds as $feed ) {
			$line(
				sprintf(
					'#%d  %s → %s  [%s]%s',
					$feed['id'],
					$feed['name'],
					$feed['apartmentName'],
					$feed['source'],
					$feed['active'] ? '' : '  (off)'
				)
			);
			$line( '     ' . $feed['url'] );
			$line(
				'     last: ' . ( $feed['lastSyncAt'] ?: 'never' )
				. ' ' . $feed['lastStatus'] . ' ' . $feed['lastMessage']
			);
		}

		break;

	case 'sync':
		if ( isset( $args[0] ) ) {
			$report = IcalImporter::sync_feed( (int) $args[0] );

			if ( is_wp_error( $report ) ) {
				$line( 'Error: ' . $report->get_error_message() );
				exit( 1 );
			}

			bks_print_report( $report );
			break;
		}

		foreach ( IcalImporter::sync_all() as $result ) {
			$line(
				sprintf(
					'#%d %s — %s',
					$result['feedId'],
					$result['name'],
					$result['ok']
						? sprintf(
							'%d added, %d changed, %d released',
							$result['counts']['added'],
							$result['counts']['updated'],
							$result['counts']['removed']
						)
						: 'FAILED: ' . $result['message']
				)
			);
		}

		break;

	case 'rollback':
		$source = (string) ( $args[0] ?? '' );
		$table  = BlocksTable::table();

		$where  = "source <> 'manual' AND external_uid <> ''";
		$params = array();

		if ( '' !== $source ) {
			$where   .= ' AND source = %s';
			$params[] = $source;
		}

		$sql = "SELECT COUNT(*) FROM $table WHERE $where";

		$count = (int) ( $params
			? $wpdb->get_var( $wpdb->prepare( $sql, ...$params ) )
			: $wpdb->get_var( $sql ) );

		if ( ! $count ) {
			$line( 'Nothing to roll back.' );
			break;
		}

		if ( ! $has( 'yes' ) ) {
			$line( sprintf( '%d imported lock(s) would be removed. Re-run with --yes.', $count ) );
			break;
		}

		$sql = "DELETE FROM $table WHERE $where";

		$removed = (int) ( $params
			? $wpdb->query( $wpdb->prepare( $sql, ...$params ) )
			: $wpdb->query( $sql ) );

		$line( sprintf( 'Removed %d imported lock(s).', $removed ) );
		break;

	default:
		$line( 'Commands: apartments | preview | apply | locks | feeds | sync | rollback' );
		$line( 'See the docblock at the top of this file for the arguments.' );
}

/**
 * Read a calendar from a path or a URL.
 */
function bks_read_calendar( string $target ): ?string {
	if ( preg_match( '#^(https?|webcal)://#i', $target ) ) {
		$content = IcalImporter::fetch( $target );

		return is_wp_error( $content ) ? null : $content;
	}

	if ( ! is_readable( $target ) ) {
		return null;
	}

	$content = file_get_contents( $target );

	return false === $content ? null : $content;
}

/**
 * @param array<string, mixed> $report
 */
function bks_print_report( array $report ): void {
	$counts = $report['counts'];

	echo PHP_EOL;
	echo ( $report['dryRun'] ? 'PREVIEW — nothing written' : 'IMPORTED' ) . PHP_EOL;
	echo str_repeat( '=', 78 ) . PHP_EOL;
	echo 'Apartment : ' . $report['apartmentName'] . ' (#' . $report['apartmentId'] . ')' . PHP_EOL;
	echo 'Portal    : ' . $report['sourceLabel'] . ' [' . $report['source'] . ']' . PHP_EOL;
	echo 'Producer  : ' . $report['producer'] . PHP_EOL;
	echo sprintf(
		'Result    : %d event(s) — %d new, %d changed, %d unchanged, %d skipped',
		$counts['total'],
		$counts['added'],
		$counts['updated'],
		$counts['unchanged'],
		$counts['skipped']
	) . PHP_EOL;
	echo sprintf(
		'Orphans   : %d lock(s) no longer in this calendar, %d removed',
		$counts['orphans'],
		$counts['removed']
	) . PHP_EOL;
	echo str_repeat( '-', 78 ) . PHP_EOL;
	echo str_pad( 'ACTION', 11 ) . str_pad( 'FROM', 12 ) . str_pad( 'TO', 12 )
		. str_pad( 'N', 4 ) . 'SUMMARY / NOTE' . PHP_EOL;
	echo str_repeat( '-', 78 ) . PHP_EOL;

	foreach ( $report['events'] as $event ) {
		echo str_pad( strtoupper( $event['action'] ), 11 )
			. str_pad( substr( $event['startsAt'], 0, 10 ), 12 )
			. str_pad( substr( $event['endsAt'], 0, 10 ), 12 )
			. str_pad( (string) $event['nights'], 4 )
			. trim( $event['summary'] . ( $event['note'] ? '  (' . $event['note'] . ')' : '' ) )
			. PHP_EOL;
	}

	if ( $report['orphans'] ) {
		echo str_repeat( '-', 78 ) . PHP_EOL;
		echo 'No longer in the calendar:' . PHP_EOL;

		foreach ( $report['orphans'] as $orphan ) {
			echo '  #' . $orphan['id'] . '  ' . substr( $orphan['startsAt'], 0, 10 )
				. ' → ' . substr( $orphan['endsAt'], 0, 10 ) . '  ' . $orphan['reason'] . PHP_EOL;
		}
	}

	if ( $report['conflicts'] ) {
		echo str_repeat( '-', 78 ) . PHP_EOL;
		echo 'CLASH — already booked on this site for those dates:' . PHP_EOL;

		foreach ( $report['conflicts'] as $booking ) {
			echo '  ' . $booking['reference'] . '  ' . substr( $booking['startsAt'], 0, 10 )
				. ' → ' . substr( $booking['endsAt'], 0, 10 ) . '  ' . $booking['status'] . PHP_EOL;
		}
	}

	echo PHP_EOL;
}
