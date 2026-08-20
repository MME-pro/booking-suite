/**
 * TemplateList — the left pane: every email, and which one is open.
 *
 * The screen used to stack a full editor per template, which meant scrolling
 * past a rich text editor and an iframe to reach the second one. Only one email
 * is ever being worked on, so the others belong here as names — enough to tell
 * them apart and to see at a glance which are switched on, and nothing more.
 *
 * An unsaved dot rather than a word: it has to survive at the width this pane
 * gets on a laptop, and a dot beside a name is read faster than a badge that
 * pushes the name into an ellipsis.
 */

import { __ } from '@wordpress/i18n';
import { Mail, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Matches EmailTemplatesRepository::AUDIENCE_*. */
export const AUDIENCES = [
	{
		value: 'guest',
		label: __( 'Guest emails', 'booking-suite' ),
		Icon: Mail,
	},
	{
		value: 'admin',
		label: __( 'Owner emails', 'booking-suite' ),
		Icon: ShieldCheck,
	},
];

export default function TemplateList( {
	templates,
	selectedKey,
	onSelect,
	drafts = {},
	audience,
	onAudienceChange,
	counts = {},
} ) {
	return (
		<div className="flex flex-col gap-3">
			{ /*
			 * Guest and owner emails are separated because they are different
			 * kinds of writing, not because there are a lot of them. A guest
			 * email is the property's voice; an owner email is an internal
			 * notice that carries a phone number and a link into wp-admin.
			 * Editing them in one list invites the wrong tone — or worse, the
			 * wrong detail — in the wrong place.
			 */ }
			<Tabs value={ audience } onValueChange={ onAudienceChange }>
				<TabsList className="grid h-auto w-full grid-cols-2 gap-1">
					{ AUDIENCES.map( ( { value, label, Icon } ) => (
						<TabsTrigger
							key={ value }
							value={ value }
							className="min-w-0 gap-1.5"
						>
							<Icon
								aria-hidden="true"
								className="h-3.5 w-3.5 shrink-0"
							/>
							<span className="truncate">{ label }</span>
							<Badge
								variant="secondary"
								className="px-1.5 py-0 text-[11px] font-normal tabular-nums"
							>
								{ counts[ value ] ?? 0 }
							</Badge>
						</TabsTrigger>
					) ) }
				</TabsList>
			</Tabs>

			<nav
				aria-label={ __( 'Email templates', 'booking-suite' ) }
				className="flex flex-col gap-1.5"
			>
				{ templates.map( ( template ) => {
					const isSelected = template.key === selectedKey;
					const isDirty = Boolean( drafts[ template.key ] );

					// The draft wins so the switch reads as the operator left it,
					// not as it was last saved.
					const enabled =
						drafts[ template.key ]?.enabled ?? template.enabled;

					return (
						<button
							key={ template.key }
							type="button"
							onClick={ () => onSelect( template.key ) }
							aria-current={ isSelected ? 'true' : undefined }
							className={ cn(
								'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
								isSelected
									? 'border-primary bg-primary/5'
									: 'bg-card hover:bg-muted/50'
							) }
						>
							<Mail
								aria-hidden="true"
								className={ cn(
									'mt-0.5 h-4 w-4 shrink-0',
									isSelected
										? 'text-primary'
										: 'text-muted-foreground'
								) }
							/>

							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="flex items-center gap-1.5">
									<span className="truncate text-sm font-medium text-card-foreground">
										{ template.label }
									</span>

									{ isDirty && (
										<span
											title={ __(
												'Unsaved changes',
												'booking-suite'
											) }
											className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
										/>
									) }
								</span>

								<span className="line-clamp-2 text-xs text-muted-foreground">
									{ template.description }
								</span>

								<span className="mt-1 flex flex-wrap items-center gap-1">
									<Badge
										variant="secondary"
										className={ cn(
											'font-normal',
											enabled
												? 'bg-success/10 text-success hover:bg-success/10'
												: 'bg-muted text-muted-foreground hover:bg-muted'
										) }
									>
										{ enabled
											? __( 'On', 'booking-suite' )
											: __( 'Off', 'booking-suite' ) }
									</Badge>

									{ template.isCustom && (
										<Badge
											variant="secondary"
											className="font-normal"
										>
											{ __( 'Edited', 'booking-suite' ) }
										</Badge>
									) }
								</span>
							</span>
						</button>
					);
				} ) }
			</nav>
		</div>
	);
}
