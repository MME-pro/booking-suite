/**
 * SystemStatus — is the plumbing sound?
 *
 * A quiet strip at the foot of the dashboard rather than a card competing with
 * the day's numbers. Nobody opens the dashboard to read this; they need it to
 * be visible the day something breaks, and invisible every other day. So it
 * says nothing at all while everything is fine beyond two small ticks.
 */

import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { AlertTriangle, CheckCircle2, Database, Mail } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { systemService } from '../../../../services';

export default function SystemStatus() {
	const [ status, setStatus ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );

	useEffect( () => {
		const controller = new AbortController();

		systemService
			.get( controller.signal )
			.then( setStatus )
			.catch( () => {
				// Reported as unknown below rather than as a false green.
			} )
			.finally( () => setLoading( false ) );

		return () => controller.abort();
	}, [] );

	if ( isLoading ) {
		return <Skeleton className="h-10 w-full" />;
	}

	const database = status?.database ?? {};
	const email = status?.email ?? {};

	const databaseDetail = () => {
		if ( ! status ) {
			return __( 'Could not check', 'booking-suite' );
		}

		if ( database.missing?.length ) {
			return sprintf(
				/* translators: %d: number of missing database tables. */
				__( '%d tables missing', 'booking-suite' ),
				database.missing.length
			);
		}

		if ( database.schemaVersion !== database.expectedVersion ) {
			return sprintf(
				/* translators: 1: stored schema version, 2: expected version. */
				__( 'Schema v%1$d, expected v%2$d', 'booking-suite' ),
				database.schemaVersion ?? 0,
				database.expectedVersion ?? 0
			);
		}

		return sprintf(
			/* translators: %d: number of database tables. */
			__( '%d tables, up to date', 'booking-suite' ),
			database.tables ?? 0
		);
	};

	const emailDetail = () => {
		if ( ! status ) {
			return __( 'Could not check', 'booking-suite' );
		}

		if ( ! email.enabled ) {
			return __( 'All templates off', 'booking-suite' );
		}

		const counts = sprintf(
			/* translators: 1: enabled templates, 2: total templates. */
			__( '%1$d of %2$d templates on', 'booking-suite' ),
			email.enabled ?? 0,
			email.total ?? 0
		);

		/*
		 * Worth flagging: on most live hosts the stock PHP mailer is silently
		 * dropped, and nothing else in the admin would say so.
		 */
		return email.smtp
			? counts
			: `${ counts } · ${ __( 'no SMTP plugin', 'booking-suite' ) }`;
	};

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-2.5">
			<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				{ __( 'System', 'booking-suite' ) }
			</span>

			<StatusItem
				icon={ Database }
				label={ __( 'Database', 'booking-suite' ) }
				detail={ databaseDetail() }
				ok={ Boolean( status && database.ok ) }
				unknown={ ! status }
			/>

			<StatusItem
				icon={ Mail }
				label={ __( 'Email', 'booking-suite' ) }
				detail={ emailDetail() }
				/*
				 * Amber without SMTP, not green: templates being switched on is
				 * not the same as mail arriving.
				 */
				ok={ Boolean( status && email.ok && email.smtp ) }
				unknown={ ! status }
			/>

			{ status?.plugin?.version && (
				<span className="ml-auto text-xs text-muted-foreground">
					{ sprintf(
						/* translators: %s: plugin version. */
						__( 'Booking Suite %s', 'booking-suite' ),
						status.plugin.version
					) }
				</span>
			) }
		</div>
	);
}

function StatusItem( { icon: Icon, label, detail, ok, unknown } ) {
	return (
		<span className="flex items-center gap-2 text-xs">
			<Icon className="h-3.5 w-3.5 text-muted-foreground" />
			<span className="font-medium text-card-foreground">{ label }</span>
			<span className="text-muted-foreground">{ detail }</span>
			{ ok ? (
				<CheckCircle2 className="h-3.5 w-3.5 text-success" />
			) : (
				<AlertTriangle
					className={ cn(
						'h-3.5 w-3.5',
						unknown ? 'text-muted-foreground' : 'text-warning'
					) }
				/>
			) }
		</span>
	);
}
