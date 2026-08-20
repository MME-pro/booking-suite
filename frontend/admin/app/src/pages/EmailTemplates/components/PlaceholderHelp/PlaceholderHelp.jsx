/**
 * PlaceholderHelp — the tokens a template can carry, foldable.
 *
 * It sits at the top of the screen because it applies to every template rather
 * than to the one that happens to be open, and it folds because it is reference
 * material: needed while learning what is available, in the way once that is
 * known.
 *
 * It takes the same white surface and border as the editor pane beside it, so
 * the two read as parts of one screen rather than as a panel and a loose note.
 * The shadow is the one thing not carried over: a shadow lifts a card off the
 * page, which suits something you act on and not a reference panel that should
 * sit flat.
 *
 * The choice is remembered. Somebody who folds this away has said they know the
 * list, and re-opening it on every page load would make them say it again each
 * time. It opens on a first visit, so nothing is hidden from somebody who has
 * not met it yet.
 */

import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { ChevronDown } from 'lucide-react';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/** Where the open/closed choice is kept. */
const STORAGE_KEY = 'bksPlaceholdersOpen';

/**
 * The remembered choice, defaulting to open.
 *
 * Wrapped because storage throws rather than returning null in a browser with
 * cookies blocked, and a help panel is not worth breaking a screen over.
 *
 * @return {boolean} Whether the panel should start open.
 */
function readPreference() {
	try {
		const stored = window.localStorage?.getItem( STORAGE_KEY );

		return null === stored ? true : 'true' === stored;
	} catch ( cause ) {
		return true;
	}
}

export default function PlaceholderHelp( { placeholders } ) {
	const entries = Object.entries( placeholders );
	const [ isOpen, setOpen ] = useState( readPreference );

	useEffect( () => {
		try {
			window.localStorage?.setItem( STORAGE_KEY, String( isOpen ) );
		} catch ( cause ) {
			// Nothing to do; the panel simply forgets between visits.
		}
	}, [ isOpen ] );

	if ( ! entries.length ) {
		return null;
	}

	/*
	 * `rounded-xl border bg-card` is what shadcn's Card carries, minus the
	 * shadow — matched by hand rather than by using <Card>, because reaching
	 * for the component would bring the shadow back with it and need
	 * overriding again.
	 */
	return (
		<Collapsible
			open={ isOpen }
			onOpenChange={ setOpen }
			className="overflow-hidden rounded-xl border bg-card"
		>
			{ /*
			 * The whole row is the trigger. A chevron alone is a small target on
			 * a phone, and there is nothing else in this row that a press could
			 * reasonably mean.
			 *
			 * The focus ring stays — that is not decoration, it is how somebody
			 * on a keyboard knows where they are.
			 */ }
			<CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="flex flex-wrap items-baseline gap-x-2">
						<span className="text-base font-semibold text-card-foreground">
							{ __( 'Placeholders', 'booking-suite' ) }
						</span>
						<span className="text-xs tabular-nums text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of placeholders available. */
								_n(
									'%d available',
									'%d available',
									entries.length,
									'booking-suite'
								),
								entries.length
							) }
						</span>
					</span>

					{ /*
					 * The description stays visible when folded: it is what tells
					 * somebody who has never opened this what the row is for.
					 */ }
					<span className="text-sm text-muted-foreground">
						{ __(
							'Drop any of these into a subject or message and the booking fills them in. Anything unrecognised is left alone.',
							'booking-suite'
						) }
					</span>
				</span>

				<ChevronDown
					aria-hidden="true"
					className={ cn(
						'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
						isOpen && 'rotate-180'
					) }
				/>
			</CollapsibleTrigger>

			<CollapsibleContent>
				{ /*
				 * A rule between the header and the tokens, matching the one
				 * the editor pane puts under its own header.
				 *
				 * The tokens themselves keep a tint, which is not decoration:
				 * it is what separates {{guest_name}} from the sentence
				 * explaining it at a glance.
				 */ }
				<dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t px-4 pb-4 pt-3 sm:grid-cols-2 xl:grid-cols-3">
					{ entries.map( ( [ token, description ] ) => (
						<div
							key={ token }
							className="flex min-w-0 flex-col gap-0.5"
						>
							<dt className="w-fit rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-card-foreground">
								{ token }
							</dt>
							<dd className="text-xs text-muted-foreground">
								{ description }
							</dd>
						</div>
					) ) }
				</dl>
			</CollapsibleContent>
		</Collapsible>
	);
}
