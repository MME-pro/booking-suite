/**
 * StatCard — the KPI tile used across the admin.
 *
 * One definition so the Dashboard, Bookings and Apartments screens stay
 * visually identical: tinted icon square top-left, badge top-right, then the
 * value, its title and a supporting line.
 *
 * On a phone that arrangement is wrong. Three or four tiles stacked one per row
 * at their full height push the actual content — the list somebody came to the
 * screen for — most of a viewport down, and a KPI is context rather than the
 * thing being worked on. So below `sm` the tile turns on its side: the icon
 * moves beside the number instead of above it, and the badge and supporting
 * line drop out. Both are restatements — the badge summarises the value, the
 * line explains what it counts — and neither earns its height when the value
 * and title are right there. Nothing that is only available here is lost.
 *
 * Built on shadcn/ui Card + Badge.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/** Accent presets, taken from the design tokens rather than raw hexes. */
export const STAT_TONES = {
	brand: 'bg-primary/10 text-primary',
	success: 'bg-success/10 text-success',
	warning: 'bg-warning/10 text-warning',
	accent: 'bg-accent text-accent-foreground',
	muted: 'bg-muted text-muted-foreground',
};

export default function StatCard( {
	title,
	value,
	unit = null,
	icon: Icon,
	tone = 'brand',
	badge = null,
} ) {
	return (
		<Card className="shadow-sm transition-shadow hover:shadow-md">
			<CardContent className="p-3 sm:p-5">
				{ /*
				 * One element, two arrangements: a row on a phone, the original
				 * stack from `sm` up. Same markup either way, so the two cannot
				 * drift apart the way a duplicated mobile tile would.
				 */ }
				<div className="flex items-center gap-3 sm:block">
					<div className="flex shrink-0 items-start justify-between gap-3 sm:w-full">
						{ Icon && (
							<span
								className={ `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
									STAT_TONES[ tone ] ?? STAT_TONES.brand
								}` }
							>
								<Icon className="h-4 w-4 sm:h-5 sm:w-5" />
							</span>
						) }
						{ badge && (
							<Badge
								variant="secondary"
								className="hidden font-medium sm:inline-flex"
							>
								{ badge }
							</Badge>
						) }
					</div>

					<div className="flex min-w-0 flex-col gap-0.5 sm:mt-4">
						<span className="truncate text-xl font-semibold tracking-tight text-card-foreground sm:text-3xl">
							{ value }
						</span>
						<span className="truncate text-xs font-medium text-card-foreground sm:text-sm">
							{ title }
						</span>
						{ unit && (
							<span className="hidden text-xs text-muted-foreground sm:block">
								{ unit }
							</span>
						) }
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
