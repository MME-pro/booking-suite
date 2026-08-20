/**
 * EmailTemplatesPage — the emails a guest receives.
 *
 * Each one is tied to a moment in the booking: the request arriving, the owner
 * approving it, and the payment landing. Switching a template off stops that
 * email without touching the rest.
 *
 * Two panes. The screen used to stack a complete editor per template, so
 * reaching the third meant scrolling past two rich text editors and two
 * preview iframes — and every one of them was mounted and fetching whether it
 * was being looked at or not. Only one email is ever being written, so the
 * others are names in the left pane and the right pane belongs to the one that
 * is open.
 *
 * Below `lg` the panes stack, list above editor. With only a handful of
 * templates the list is short enough to leave on screen, which keeps the choice
 * visible rather than hiding it behind a back button.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { emailTemplateService } from '../../services';
import { PlaceholderHelp } from './components/PlaceholderHelp';
import { TemplateEditor } from './components/TemplateEditor';
import { TemplateList } from './components/TemplateList';

export default function EmailTemplatesPage() {
	const [ templates, setTemplates ] = useState( [] );
	const [ placeholders, setPlaceholders ] = useState( {} );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ notice, setNotice ] = useState( null );

	/** Unsaved edits, keyed by template. */
	const [ drafts, setDrafts ] = useState( {} );
	const [ busyKey, setBusyKey ] = useState( null );

	/** Which template the right pane is showing; null until the list loads. */
	const [ selectedKey, setSelectedKey ] = useState( null );

	/** Guest emails or owner emails. */
	const [ audience, setAudience ] = useState( 'guest' );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await emailTemplateService.list( signal );

			setTemplates( payload.templates );
			setPlaceholders( payload.placeholders );
			setDrafts( {} );
			setError( null );
		} catch ( cause ) {
			if ( 'AbortError' !== cause.name ) {
				setError( cause.message );
			}
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		const controller = new AbortController();

		load( controller.signal );

		return () => controller.abort();
	}, [ load ] );

	/** How many templates each audience holds, for the tab badges. */
	const counts = useMemo(
		() =>
			templates.reduce( ( carry, item ) => {
				carry[ item.audience ] = ( carry[ item.audience ] ?? 0 ) + 1;

				return carry;
			}, {} ),
		[ templates ]
	);

	const visible = useMemo(
		() => templates.filter( ( item ) => item.audience === audience ),
		[ templates, audience ]
	);

	/*
	 * Falls back to the first template of the open audience rather than showing
	 * an empty pane — on first load, when the tab changes, and again if the
	 * selected key ever stops existing.
	 */
	const selected = useMemo(
		() =>
			visible.find( ( item ) => item.key === selectedKey ) ??
			visible[ 0 ] ??
			null,
		[ visible, selectedKey ]
	);

	const edit = ( key, changes ) =>
		setDrafts( ( current ) => ( {
			...current,
			[ key ]: { ...( current[ key ] ?? {} ), ...changes },
		} ) );

	const applyResult = ( saved ) => {
		setTemplates( ( current ) =>
			current.map( ( item ) => ( item.key === saved.key ? saved : item ) )
		);

		setDrafts( ( current ) => {
			const next = { ...current };

			delete next[ saved.key ];

			return next;
		} );
	};

	const run = async ( key, work, message ) => {
		setBusyKey( key );
		setNotice( null );

		try {
			const result = await work();

			if ( result?.key ) {
				applyResult( result );
			}

			setError( null );
			setNotice( message );
		} catch ( cause ) {
			setError( cause.message );
		} finally {
			setBusyKey( null );
		}
	};

	if ( isLoading ) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
				<div className="flex flex-col gap-1.5">
					{ [ 0, 1, 2 ].map( ( key ) => (
						<Skeleton key={ key } className="h-20 w-full" />
					) ) }
				</div>
				<Skeleton className="h-[32rem] w-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Something went wrong', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			{ notice && (
				<Alert className="border-success/30 bg-success/5 text-success [&>svg]:text-success">
					<CheckCircle2 className="h-4 w-4" />
					<AlertDescription>{ notice }</AlertDescription>
				</Alert>
			) }

			{ /*
			 * Above both panes, because it applies to every template rather
			 * than to whichever one is open. It folds away, and remembers
			 * having been folded, so it costs a row once the tokens are known.
			 */ }
			<PlaceholderHelp placeholders={ placeholders } />

			{ /*
			 * 30/70. Written as 3fr and 7fr rather than percentages so the gap
			 * comes out of the columns instead of pushing the pair past 100%,
			 * and wrapped in minmax(0,…) so a long template name shrinks its
			 * column rather than holding it open.
			 */ }
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] lg:items-start">
				{ /*
				 * Sticky on a tall screen so the list stays reachable while the
				 * editor scrolls. `top-8` clears the WordPress admin bar.
				 */ }
				<div className="lg:sticky lg:top-8">
					<TemplateList
						templates={ visible }
						selectedKey={ selected?.key ?? null }
						onSelect={ setSelectedKey }
						drafts={ drafts }
						audience={ audience }
						counts={ counts }
						onAudienceChange={ ( next ) => {
							setAudience( next );
							// Let the new tab pick its own first template
							// rather than showing an empty pane.
							setSelectedKey( null );
						} }
					/>
				</div>

				{ selected && (
					<TemplateEditor
						key={ selected.key }
						template={ selected }
						value={ drafts[ selected.key ] ?? selected }
						isDirty={ Boolean( drafts[ selected.key ] ) }
						isBusy={ busyKey === selected.key }
						onEdit={ ( changes ) => edit( selected.key, changes ) }
						onSave={ () => {
							const value = drafts[ selected.key ] ?? selected;

							run(
								selected.key,
								() =>
									emailTemplateService.save( selected.key, {
										subject: value.subject,
										body: value.body,
										enabled: value.enabled,
									} ),
								__( 'Template saved.', 'booking-suite' )
							);
						} }
						onReset={ () =>
							run(
								selected.key,
								() =>
									emailTemplateService.reset( selected.key ),
								__(
									'Template restored to the original text.',
									'booking-suite'
								)
							)
						}
						onTest={ ( email ) =>
							run(
								selected.key,
								() =>
									emailTemplateService.test(
										selected.key,
										email
									),
								__( 'Test email sent.', 'booking-suite' )
							)
						}
					/>
				) }
			</div>
		</div>
	);
}
