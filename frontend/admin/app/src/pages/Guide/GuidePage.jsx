/**
 * GuidePage — the developer guide.
 *
 * Two references: the shortcodes with their attributes, and every REST route
 * the plugin registers. The endpoint list is introspected on the server from
 * the routes that actually exist, so it cannot drift from the code.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AlertCircle,
	Check,
	Code2,
	Copy,
	Search,
	Terminal,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { guideService } from '../../services';

/** Colour by verb, so a destructive route is obvious in a long list. */
const METHOD_CLASSES = {
	GET: 'bg-primary/10 text-primary hover:bg-primary/10',
	POST: 'bg-success/10 text-success hover:bg-success/10',
	PUT: 'bg-warning/10 text-warning hover:bg-warning/10',
	PATCH: 'bg-warning/10 text-warning hover:bg-warning/10',
	DELETE: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
};

export default function GuidePage() {
	const [ shortcodes, setShortcodes ] = useState( [] );
	const [ endpoints, setEndpoints ] = useState( [] );
	const [ restBase, setRestBase ] = useState( '' );
	const [ isLoading, setLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	const [ search, setSearch ] = useState( '' );

	const load = useCallback( async ( signal ) => {
		setLoading( true );

		try {
			const payload = await guideService.get( signal );

			setShortcodes( payload.shortcodes );
			setEndpoints( payload.endpoints );
			setRestBase( payload.restBase );
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

	const visibleEndpoints = useMemo( () => {
		const term = search.trim().toLowerCase();

		if ( ! term ) {
			return endpoints;
		}

		return endpoints.filter(
			( endpoint ) =>
				endpoint.path.toLowerCase().includes( term ) ||
				endpoint.methods.some( ( method ) =>
					method.toLowerCase().includes( term )
				)
		);
	}, [ endpoints, search ] );

	if ( isLoading ) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-72" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="flex max-w-5xl flex-col gap-4">
			{ error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>
						{ __( 'Could not load the guide', 'booking-suite' ) }
					</AlertTitle>
					<AlertDescription>{ error }</AlertDescription>
				</Alert>
			) }

			<Tabs defaultValue="shortcodes">
				<TabsList>
					<TabsTrigger value="shortcodes" className="gap-2">
						<Code2 className="h-4 w-4" />
						{ __( 'Shortcodes', 'booking-suite' ) }
					</TabsTrigger>
					<TabsTrigger value="api" className="gap-2">
						<Terminal className="h-4 w-4" />
						{ __( 'API endpoints', 'booking-suite' ) }
					</TabsTrigger>
				</TabsList>

				<TabsContent value="shortcodes" className="flex flex-col gap-4">
					{ shortcodes.map( ( shortcode ) => (
						<ShortcodeCard
							key={ shortcode.tag }
							shortcode={ shortcode }
						/>
					) ) }
				</TabsContent>

				<TabsContent value="api" className="flex flex-col gap-4">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								{ __( 'Base URL', 'booking-suite' ) }
							</CardTitle>
							<CardDescription>
								{ __(
									'Every path below hangs off this. Admin routes need a logged-in user with manage_options and the wp_rest nonce; public ones do not.',
									'booking-suite'
								) }
							</CardDescription>
						</CardHeader>
						<CardContent>
							<CodeLine value={ restBase } />
						</CardContent>
					</Card>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="relative">
							<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								value={ search }
								onChange={ ( event ) =>
									setSearch( event.target.value )
								}
								aria-label={ __(
									'Search endpoints',
									'booking-suite'
								) }
								placeholder={ __(
									'Filter by path or method…',
									'booking-suite'
								) }
								className="w-full pl-8 sm:w-80"
							/>
						</div>

						<span className="text-xs text-muted-foreground">
							{ sprintf(
								/* translators: %d: number of endpoints. */
								__( '%d endpoints', 'booking-suite' ),
								visibleEndpoints.length
							) }
						</span>
					</div>

					<Card className="overflow-hidden">
						<div className="w-full overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead className="w-[120px]">
											{ __( 'Method', 'booking-suite' ) }
										</TableHead>
										<TableHead>
											{ __( 'Path', 'booking-suite' ) }
										</TableHead>
										<TableHead className="w-[110px]">
											{ __( 'Access', 'booking-suite' ) }
										</TableHead>
										<TableHead>
											{ __(
												'Parameters',
												'booking-suite'
											) }
										</TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									{ visibleEndpoints.map(
										( endpoint, index ) => (
											<TableRow
												key={ `${ endpoint.path }-${ index }` }
												className="hover:bg-transparent"
											>
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{ endpoint.methods.map(
															( method ) => (
																<Badge
																	key={
																		method
																	}
																	variant="secondary"
																	className={
																		METHOD_CLASSES[
																			method
																		] ?? ''
																	}
																>
																	{ method }
																</Badge>
															)
														) }
													</div>
												</TableCell>

												<TableCell className="font-mono text-xs">
													{ endpoint.path }
												</TableCell>

												<TableCell>
													<Badge
														variant="secondary"
														className={
															endpoint.public
																? 'bg-warning/10 text-warning hover:bg-warning/10'
																: 'bg-muted text-muted-foreground hover:bg-muted'
														}
													>
														{ endpoint.public
															? __(
																	'Public',
																	'booking-suite'
															  )
															: __(
																	'Admin',
																	'booking-suite'
															  ) }
													</Badge>
												</TableCell>

												<TableCell>
													{ ! endpoint.args
														.length && (
														<span className="text-xs text-muted-foreground">
															—
														</span>
													) }

													<div className="flex flex-wrap gap-1.5">
														{ endpoint.args.map(
															( arg ) => (
																<span
																	key={
																		arg.name
																	}
																	title={
																		arg.enum
																			.length
																			? arg.enum.join(
																					' | '
																			  )
																			: arg.type
																	}
																	className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
																>
																	{ arg.name }
																	{ arg.required &&
																		'*' }
																</span>
															)
														) }
													</div>
												</TableCell>
											</TableRow>
										)
									) }
								</TableBody>
							</Table>
						</div>
					</Card>

					<p className="px-1 text-xs text-muted-foreground">
						{ __(
							'A star marks a required parameter. Hover any parameter for its type, or its allowed values where it has a fixed set.',
							'booking-suite'
						) }
					</p>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ShortcodeCard( { shortcode } ) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">{ shortcode.title }</CardTitle>
				<CardDescription>{ shortcode.description }</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<CodeLine value={ `[${ shortcode.tag }]` } />

				<div>
					<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{ __( 'Attributes', 'booking-suite' ) }
					</span>

					<div className="mt-2 w-full overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="w-[130px]">
										{ __( 'Name', 'booking-suite' ) }
									</TableHead>
									<TableHead className="w-[150px]">
										{ __( 'Default', 'booking-suite' ) }
									</TableHead>
									<TableHead>
										{ __( 'Notes', 'booking-suite' ) }
									</TableHead>
								</TableRow>
							</TableHeader>

							<TableBody>
								{ shortcode.attributes.map( ( attribute ) => (
									<TableRow
										key={ attribute.name }
										className="hover:bg-transparent"
									>
										<TableCell className="font-mono text-xs">
											{ attribute.name }
										</TableCell>
										<TableCell className="font-mono text-xs text-muted-foreground">
											{ attribute.default || '—' }
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{ attribute.description }
											{ attribute.options?.length > 0 && (
												<span className="mt-1 flex flex-wrap gap-1">
													{ attribute.options.map(
														( option ) => (
															<span
																key={ option }
																className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-card-foreground"
															>
																{ option }
															</span>
														)
													) }
												</span>
											) }
										</TableCell>
									</TableRow>
								) ) }
							</TableBody>
						</Table>
					</div>
				</div>

				<Separator />

				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{ __( 'Example', 'booking-suite' ) }
					</span>
					<CodeLine value={ shortcode.example } />
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * A copyable line of code.
 *
 * @param {Object} props
 * @param {string} props.value The text to show and copy.
 */
function CodeLine( { value } ) {
	const [ copied, setCopied ] = useState( false );

	const copy = async () => {
		try {
			await window.navigator.clipboard.writeText( value );
			setCopied( true );
			window.setTimeout( () => setCopied( false ), 1500 );
		} catch ( error ) {
			// Clipboard access can be refused; the text stays selectable.
		}
	};

	return (
		<div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
			<code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-card-foreground">
				{ value }
			</code>
			<Button
				size="icon"
				variant="ghost"
				className="h-7 w-7 shrink-0"
				onClick={ copy }
				title={ __( 'Copy', 'booking-suite' ) }
			>
				{ copied ? (
					<Check className="h-3.5 w-3.5 text-success" />
				) : (
					<Copy className="h-3.5 w-3.5" />
				) }
				<span className="sr-only">
					{ __( 'Copy to clipboard', 'booking-suite' ) }
				</span>
			</Button>
		</div>
	);
}
