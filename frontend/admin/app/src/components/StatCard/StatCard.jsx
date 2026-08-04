/**
 * StatCard — the KPI tile used across the admin.
 *
 * One definition so the Dashboard, Bookings and Apartments screens stay
 * visually identical: tinted icon square top-left, badge top-right, then the
 * value, its title and a supporting line.
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
			<CardContent className="p-5">
				<div className="flex items-start justify-between gap-3">
					{ Icon && (
						<span
							className={ `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
								STAT_TONES[ tone ] ?? STAT_TONES.brand
							}` }
						>
							<Icon className="h-5 w-5" />
						</span>
					) }
					{ badge && (
						<Badge variant="secondary" className="font-medium">
							{ badge }
						</Badge>
					) }
				</div>

				<div className="mt-4 flex flex-col gap-0.5">
					<span className="truncate text-3xl font-semibold tracking-tight text-card-foreground">
						{ value }
					</span>
					<span className="text-sm font-medium text-card-foreground">
						{ title }
					</span>
					{ unit && (
						<span className="text-xs text-muted-foreground">
							{ unit }
						</span>
					) }
				</div>
			</CardContent>
		</Card>
	);
}
