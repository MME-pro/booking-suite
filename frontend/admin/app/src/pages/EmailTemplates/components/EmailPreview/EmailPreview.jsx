/**
 * EmailPreview — the email as the guest will receive it.
 *
 * The HTML is rendered by the server, by the same code that sends the mail, so
 * the preview cannot drift away from the real thing the way a second
 * implementation in the browser would.
 *
 * It is shown in an iframe rather than dropped into the page: an email carries
 * its own <html>, <body> and styling, and letting that loose in the admin would
 * have it inherit — and fight with — the admin's own CSS.
 */

import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { emailTemplateService } from '../../../../services';

/** Long enough that a keystroke does not cost a request. */
const DEBOUNCE_MS = 500;

/**
 * @param {Object} props
 * @param {string} props.templateKey Which template is being edited.
 * @param {string} props.subject     The subject as currently edited.
 * @param {string} props.body        The body as currently edited.
 */
export default function EmailPreview( { templateKey, subject, body } ) {
	const [ html, setHtml ] = useState( '' );
	const [ error, setError ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );

	useEffect( () => {
		const controller = new AbortController();

		// Typing should not fire a request per character.
		const timer = setTimeout( () => {
			setLoading( true );

			emailTemplateService
				.preview( templateKey, { subject, body }, controller.signal )
				.then( ( payload ) => {
					setHtml( payload?.html ?? '' );
					setError( null );
				} )
				.catch( ( cause ) => {
					if ( 'AbortError' !== cause.name ) {
						setError( cause.message );
					}
				} )
				.finally( () => {
					if ( ! controller.signal.aborted ) {
						setLoading( false );
					}
				} );
		}, DEBOUNCE_MS );

		return () => {
			clearTimeout( timer );
			controller.abort();
		};
	}, [ templateKey, subject, body ] );

	if ( error ) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>{ error }</AlertDescription>
			</Alert>
		);
	}

	if ( isLoading && ! html ) {
		return (
			<div className="flex flex-col gap-3 rounded-lg border p-4">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		);
	}

	return (
		<div className="relative overflow-hidden rounded-lg border bg-muted/30">
			{ isLoading && (
				<div className="absolute right-3 top-3 z-10">
					<Loader2
						className="h-4 w-4 animate-spin text-muted-foreground"
						aria-hidden="true"
					/>
				</div>
			) }

			{ /*
			 * Sandboxed with no allow-scripts: the preview only ever has to
			 * lay text out, and nothing in it should be able to run.
			 */ }
			<iframe
				title={ __( 'Email preview', 'booking-suite' ) }
				srcDoc={ html }
				sandbox=""
				className="h-[32rem] w-full border-0 bg-white"
			/>
		</div>
	);
}
