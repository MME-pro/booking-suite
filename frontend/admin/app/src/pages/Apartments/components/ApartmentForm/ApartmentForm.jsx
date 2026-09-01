/**
 * ApartmentForm — every writable column of `mmebk_rooms`, in a dialog.
 *
 * Built on the shadcn/ui Form (react-hook-form + zod). Values are kept in the
 * same shapes the REST layer already received — numbers stay strings — so the
 * saved payload is unchanged from the previous hand-rolled version; the schema
 * adds the validation that used to be left to the server.
 *
 * ImageUpload is deliberately still the existing component: it wraps wp.media,
 * which has no shadcn equivalent.
 */

import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, HelpCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

import { ImageUpload } from '../../../../components';
import { settings } from '../../../../settings';
import { dialogMediaProps } from '../../../../lib/media';
import { apartmentService } from '../../../../services';
import ExportLinks from './ExportLinks';
import {
	MAX_CAPACITY,
	MAX_LENGTH_191,
	MAX_LENGTH_URL,
	MIN_CAPACITY,
	cleaningOptions,
	emptyApartment,
} from '../../data/apartment.schema';
import './ApartmentForm.css';

const DESCRIPTION_MODES = [
	{ value: 'text', label: __( 'Text', 'booking-suite' ) },
	{ value: 'html', label: __( 'HTML', 'booking-suite' ) },
];

/**
 * A whole number held as a string, within the column's range.
 *
 * @param {Object} range
 * @param {number} range.min     Lowest accepted value.
 * @param {number} [range.max]   Highest accepted value, if the column caps it.
 * @param {string} range.message Shown when the value falls outside the range.
 * @return {import('zod').ZodString} The guarded string schema.
 */
const numericString = ( { min, max, message } ) =>
	z.string().refine( ( value ) => {
		const parsed = Number( value );

		return (
			'' !== value &&
			Number.isFinite( parsed ) &&
			parsed >= min &&
			( undefined === max || parsed <= max )
		);
	}, message );

/**
 * One calendar subscription: an apartment, a portal, and the .ics it publishes.
 *
 * The last-sync fields are carried through the form untouched. They are not
 * editable and are never sent back — the row shows them so an operator can see
 * at a glance which subscription is the one that has stopped working.
 */
const feedSchema = z.object( {
	id: z.coerce.number().optional(),
	source: z.string().min( 1 ),
	url: z
		.string()
		.min( 1, __( 'Paste the calendar link.', 'booking-suite' ) )
		.refine(
			( value ) => /^(https?|webcal):\/\/\S+$/i.test( value.trim() ),
			__(
				'That should be a link starting with https:// or webcal://',
				'booking-suite'
			)
		),
	name: z.string().max( MAX_LENGTH_191 ).optional(),
	active: z.boolean(),
	lastSyncAt: z.string().optional(),
	lastStatus: z.string().optional(),
	lastMessage: z.string().optional(),
	lastEventCount: z.coerce.number().optional(),
} );

const schema = z.object( {
	name: z
		.string()
		.min( 1, __( 'Give the apartment a name.', 'booking-suite' ) )
		.max( MAX_LENGTH_191 ),
	colour: z
		.string()
		.regex(
			/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
			__( 'Pick a colour.', 'booking-suite' )
		),
	active: z.boolean(),
	capacity: numericString( {
		min: MIN_CAPACITY,
		max: MAX_CAPACITY,
		message: __( 'Enter how many guests fit.', 'booking-suite' ),
	} ),
	cleaningMin: z.string(),
	holidayHesse: z.boolean(),
	weekdayRate: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	weekendRate: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	surchargeHour: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	surchargeGuest: numericString( {
		min: 0,
		message: __( 'Enter a rate of 0 or more.', 'booking-suite' ),
	} ),
	icalFeeds: z.array( feedSchema ),
	internalShortLink: z.string().max( MAX_LENGTH_191 ).optional(),
	bookingShortLink: z.string().max( MAX_LENGTH_191 ).optional(),
	description: z.string().optional(),
	images: z.any(),
} );

/**
 * A stored apartment into form values.
 *
 * capacity and cleaningMin come back from the REST layer as numbers, while the
 * form (and the schema) works in strings — the inputs produce strings, and
 * apartmentService.toPayload() parses them back on the way out. Coercing here
 * keeps editing an existing apartment from failing validation on type alone.
 *
 * @param {Object} apartment The apartment as returned by apartmentService.
 * @return {Object} Form values.
 */
const fromApartment = ( apartment ) => ( {
	...emptyApartment(),
	...apartment,
	capacity: String( apartment.capacity ?? '' ),
	cleaningMin: String( apartment.cleaningMin ?? '' ),
	icalFeeds: subscriptionRows( apartment.icalFeeds ),
} );

/**
 * The portals an apartment syncs with, in the order they are shown.
 *
 * Fixed rather than a list the operator builds: both rows are always on the
 * screen, whether or not they have a link yet, so the section reads as "here
 * is where the Airbnb link goes" rather than as an empty list with an Add
 * button and a portal to pick out of nine.
 */
const PORTALS = [ 'airbnb', 'booking' ];

/**
 * Exactly one form row per portal, carrying its saved subscription if it has
 * one. Clearing a row's link unsubscribes that portal; the row itself stays.
 *
 * @param {Array} [feeds] The apartment's saved subscriptions.
 * @return {Array} One row per entry in PORTALS, in that order.
 */
function subscriptionRows( feeds ) {
	const saved = new Map(
		( feeds ?? [] ).map( ( feed ) => [ feed.source, feed ] )
	);

	return PORTALS.map( ( source ) => {
		const feed = saved.get( source );

		return {
			id: feed?.id ?? 0,
			source,
			url: feed?.url ?? '',
			/*
			 * Neither of these is on the screen any more. The name is kept
			 * because other screens read it; a subscription always syncs, so
			 * `active` is not a choice the form offers — one that should not
			 * sync is one whose link should be cleared.
			 */
			name: feed?.name ?? '',
			active: true,
			lastSyncAt: feed?.lastSyncAt ?? null,
			lastStatus: feed?.lastStatus ?? '',
			lastMessage: feed?.lastMessage ?? '',
			lastEventCount: feed?.lastEventCount ?? 0,
		};
	} );
}

export default function ApartmentForm( {
	apartment = null,
	onClose,
	onSaved,
} ) {
	const isEdit = null !== apartment;

	const [ descriptionMode, setDescriptionMode ] = useState( 'text' );
	const [ error, setError ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: isEdit ? fromApartment( apartment ) : emptyApartment(),
	} );

	const isSaving = form.formState.isSubmitting;

	const handleSave = async ( values ) => {
		setError( null );

		try {
			const saved = isEdit
				? await apartmentService.update( apartment.id, values )
				: await apartmentService.create( values );

			onSaved( saved );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	return (
		<Dialog
			open
			onOpenChange={ ( next ) => {
				if ( ! next && ! isSaving ) {
					onClose();
				}
			} }
		>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
				{ ...dialogMediaProps }
			>
				<DialogHeader>
					<DialogTitle>
						{ isEdit
							? __( 'Edit Apartment', 'booking-suite' )
							: __( 'Add Apartment', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Set up the apartment guests will see and book.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<Form { ...form }>
					<form
						id="bks-apartment-form"
						onSubmit={ form.handleSubmit( handleSave ) }
						className="flex flex-col gap-6"
					>
						{ error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{ error }</AlertDescription>
							</Alert>
						) }

						{ /* name, images, colour, active */ }
						<Section
							title={ __( 'Details', 'booking-suite' ) }
							description={ __(
								'How this apartment is identified across the calendar and the website.',
								'booking-suite'
							) }
						>
							<div className="flex flex-col gap-4 sm:flex-row">
								<FormField
									control={ form.control }
									name="images"
									render={ ( { field } ) => (
										<FormItem className="shrink-0">
											<ImageUpload
												images={ field.value }
												onChange={ field.onChange }
											/>
										</FormItem>
									) }
								/>

								<div className="flex min-w-0 flex-1 flex-col gap-4">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
										<FormField
											control={ form.control }
											name="name"
											render={ ( { field } ) => (
												<FormItem>
													<FormLabel>
														{ __(
															'Name',
															'booking-suite'
														) }{ ' ' }
														<Required />
													</FormLabel>
													<FormControl>
														<Input
															maxLength={
																MAX_LENGTH_191
															}
															placeholder={ __(
																'e.g. Studio Rheinblick',
																'booking-suite'
															) }
															{ ...field }
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											) }
										/>

										<FormField
											control={ form.control }
											name="colour"
											render={ ( { field } ) => (
												<FormItem>
													<FormLabel>
														{ __(
															'Color',
															'booking-suite'
														) }{ ' ' }
														<Required />
													</FormLabel>
													<FormControl>
														<Input
															type="color"
															className="h-9 w-16 cursor-pointer p-1"
															{ ...field }
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											) }
										/>
									</div>

									<FormField
										control={ form.control }
										name="active"
										render={ ( { field } ) => (
											<FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
												<div className="space-y-0.5">
													<FormLabel>
														{ __(
															'Active',
															'booking-suite'
														) }
													</FormLabel>
													<FormDescription>
														{ __(
															'Inactive apartments stay in the list but cannot be booked.',
															'booking-suite'
														) }
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={ field.value }
														onCheckedChange={
															field.onChange
														}
													/>
												</FormControl>
											</FormItem>
										) }
									/>
								</div>
							</div>
						</Section>

						<Separator />

						{ /* capacity, cleaning_min, holiday_hesse */ }
						<Section
							title={ __(
								'Capacity & turnaround',
								'booking-suite'
							) }
							description={ __(
								'How many guests fit, and how long the apartment is blocked between stays.',
								'booking-suite'
							) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<FormField
									control={ form.control }
									name="capacity"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel>
												{ __(
													'Guests',
													'booking-suite'
												) }{ ' ' }
												<Required />
											</FormLabel>
											<FormControl>
												<Input
													type="number"
													inputMode="numeric"
													min={ MIN_CAPACITY }
													max={ MAX_CAPACITY }
													{ ...field }
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									) }
								/>

								<FormField
									control={ form.control }
									name="cleaningMin"
									render={ ( { field } ) => (
										<FormItem>
											<FormLabel className="flex items-center gap-1.5">
												{ __(
													'Cleaning time',
													'booking-suite'
												) }{ ' ' }
												<Required />
												<Hint
													text={ __(
														'Turnaround blocked after each stay.',
														'booking-suite'
													) }
												/>
											</FormLabel>
											<Select
												value={ String( field.value ) }
												onValueChange={ field.onChange }
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{ cleaningOptions().map(
														( option ) => (
															<SelectItem
																key={
																	option.value
																}
																value={
																	option.value
																}
															>
																{ option.label }
															</SelectItem>
														)
													) }
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									) }
								/>
							</div>

							<FormField
								control={ form.control }
								name="holidayHesse"
								render={ ( { field } ) => (
									<FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
										<FormControl>
											<Checkbox
												checked={ field.value }
												onCheckedChange={
													field.onChange
												}
											/>
										</FormControl>
										<div className="space-y-0.5 leading-none">
											<FormLabel>
												{ __(
													'Follow Hesse public holidays',
													'booking-suite'
												) }
											</FormLabel>
											<FormDescription>
												{ __(
													'Hesse public holidays are treated as blocked days for this apartment.',
													'booking-suite'
												) }
											</FormDescription>
										</div>
									</FormItem>
								) }
							/>
						</Section>

						<Separator />

						{ /* weekday_rate, weekend_rate */ }
						<Section title={ __( 'Rates', 'booking-suite' ) }>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<RateField
									form={ form }
									name="weekdayRate"
									label={ __(
										'Weekday rate (Sun–Thu)',
										'booking-suite'
									) }
								/>
								<RateField
									form={ form }
									name="weekendRate"
									label={ __(
										'Weekend rate (Fri/Sat)',
										'booking-suite'
									) }
								/>
							</div>
						</Section>

						<Separator />

						{ /* surcharge_hour, surcharge_guest */ }
						<Section
							title={ __( 'Surcharges', 'booking-suite' ) }
							description={ __(
								'What this apartment adds beyond the base rate. Both were once one figure for the whole site, which made a studio and a villa charge the same for a fifth guest.',
								'booking-suite'
							) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<RateField
									form={ form }
									name="surchargeHour"
									label={ __(
										'Per extra hour',
										'booking-suite'
									) }
									description={ __(
										'Charged for each hour beyond the base the rate covers.',
										'booking-suite'
									) }
								/>
								<RateField
									form={ form }
									name="surchargeGuest"
									label={ __(
										'Per extra guest',
										'booking-suite'
									) }
									description={ __(
										'Charged for each guest beyond the party size the rate covers.',
										'booking-suite'
									) }
								/>
							</div>
						</Section>

						<Separator />

						{ /* internal_short_link, booking_short_link */ }
						<Section
							title={ __( 'Short links', 'booking-suite' ) }
							description={ __(
								'Optional shortcuts to this apartment. Each must be unique across all apartments.',
								'booking-suite'
							) }
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<LinkField
									form={ form }
									name="internalShortLink"
									label={ __(
										'Internal short link',
										'booking-suite'
									) }
									placeholder="studio-rheinblick"
								/>
								<LinkField
									form={ form }
									name="bookingShortLink"
									label={ __(
										'Booking short link',
										'booking-suite'
									) }
									placeholder="book-rheinblick"
								/>
							</div>
						</Section>

						<Separator />

						{ /* The apartment's two ends of the channel manager. */ }
						<Section
							title={ __( 'Calendar sync', 'booking-suite' ) }
							description={ __(
								'Keep this apartment in step with Airbnb, Booking.com and anywhere else it is listed. Subscribe to as many calendars as it has portals, and publish one of its own.',
								'booking-suite'
							) }
						>
							<SubscriptionList form={ form } />

							<ExportLinks
								apartment={ apartment }
								form={ form }
							/>
						</Section>

						<Separator />

						{ /* description */ }
						<Section
							title={ __( 'Description', 'booking-suite' ) }
							description={ __(
								'Shown to guests on the website.',
								'booking-suite'
							) }
						>
							<Tabs
								value={ descriptionMode }
								onValueChange={ setDescriptionMode }
							>
								<TabsList>
									{ DESCRIPTION_MODES.map(
										( { value, label } ) => (
											<TabsTrigger
												key={ value }
												value={ value }
											>
												{ label }
											</TabsTrigger>
										)
									) }
								</TabsList>
							</Tabs>

							<FormField
								control={ form.control }
								name="description"
								render={ ( { field } ) => (
									<FormItem>
										<FormControl>
											<Textarea
												rows={ 8 }
												className={
													'html' === descriptionMode
														? 'font-mono text-xs'
														: ''
												}
												placeholder={
													'html' === descriptionMode
														? '<p>Describe the apartment…</p>'
														: __(
																'Describe the apartment…',
																'booking-suite'
														  )
												}
												{ ...field }
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								) }
							/>
						</Section>
					</form>
				</Form>

				<DialogFooter className="items-center gap-3 sm:justify-between">
					<span className="text-xs text-muted-foreground">
						{ __(
							'Fields marked * are required.',
							'booking-suite'
						) }
					</span>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={ onClose }
							disabled={ isSaving }
						>
							{ __( 'Close', 'booking-suite' ) }
						</Button>
						<Button
							type="submit"
							form="bks-apartment-form"
							disabled={ isSaving }
						>
							{ isSaving
								? __( 'Saving…', 'booking-suite' )
								: __( 'Save Apartment', 'booking-suite' ) }
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Every calendar this apartment reads, as rows you can add to and take away.
 *
 * The whole list is part of the apartment's form values, so a subscription is
 * added, amended and removed by saving the apartment — the same Save, the same
 * Cancel. Reaching for the feed endpoints directly as each row changed would be
 * fewer moving parts, but it would also mean a row added and then abandoned
 * with Cancel had already been created, and a new apartment could not carry any
 * rows at all: there is nothing to attach them to until it exists.
 *
 * The server owns the reconciliation. This sends the list it wants to end up
 * with, and ApartmentsController works out which rows are new, changed or gone.
 *
 * @param {Object} props
 * @param {Object} props.form The parent react-hook-form instance.
 */
/**
 * The operator-facing name of a portal.
 *
 * @param {string} source A portal key.
 * @return {string} Its label.
 */
function portalLabel( source ) {
	const match = ( settings.icalSources ?? [] ).find(
		( entry ) => entry.value === source
	);

	return match?.label ?? source;
}

/**
 * The shape of the link this portal hands out.
 *
 * A worked example beats a description of one: the portals' own URLs are
 * distinctive enough that seeing the right shape is how you know you have
 * copied the right thing out of the extranet.
 *
 * @param {string} source A portal key.
 * @return {string} A URL-shaped hint.
 */
function portalPlaceholder( source ) {
	return (
		{
			airbnb: 'https://www.airbnb.com/calendar/ical/12345.ics?s=…',
			booking: 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=…',
		}[ source ] ?? 'https://…/calendar.ics'
	);
}

/**
 * Where in this portal's own admin the link is found.
 *
 * Each row belongs to one portal, so it names that portal's route and nothing
 * else — someone filling in the Airbnb row should not have to read past
 * Booking.com's instructions to find their own.
 *
 * @param {string} source A portal key.
 * @return {string} A route through that portal's extranet.
 */
function portalHint( source ) {
	return (
		{
			airbnb: __(
				'Airbnb: Calendar → Availability → Connect calendars.',
				'booking-suite'
			),
			booking: __(
				'Booking.com: Rates & Availability → Sync calendars.',
				'booking-suite'
			),
		}[ source ] ??
		__( 'Paste the calendar link this portal gave you.', 'booking-suite' )
	);
}

function SubscriptionList( { form } ) {
	/*
	 * `keyName` is not cosmetic. useFieldArray writes React's key into `id` by
	 * default, and `id` here is the subscription's own database id — the thing
	 * that decides whether a row is updated or inserted. Letting the two share
	 * a name would hand the server a render key and have it create duplicates.
	 */
	const { fields } = useFieldArray( {
		control: form.control,
		name: 'icalFeeds',
		keyName: 'fieldKey',
	} );

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium leading-none">
					{ __( 'Subscriptions (import)', 'booking-suite' ) }
				</span>
				<p className="text-xs text-muted-foreground">
					{ __(
						'Dates these portals have sold are blocked here, read automatically on a schedule.',
						'booking-suite'
					) }
				</p>
			</div>

			{ fields.map( ( field, index ) => (
				<div
					key={ field.fieldKey }
					className="flex flex-col gap-3 rounded-lg border p-3"
				>
					{ /*
					 * The id travels as a hidden input rather than being left
					 * to the field array's default values, so what the server
					 * receives is exactly what is on screen — a saved row keeps
					 * its id and is updated, a new one has none and is created.
					 */ }
					<input
						type="hidden"
						{ ...form.register( `icalFeeds.${ index }.id` ) }
					/>

					<input
						type="hidden"
						{ ...form.register( `icalFeeds.${ index }.source` ) }
					/>

					<span className="text-sm font-medium text-card-foreground">
						{ portalLabel( field.source ) }
					</span>

					<FormField
						control={ form.control }
						name={ `icalFeeds.${ index }.url` }
						render={ ( { field: urlField } ) => (
							<FormItem>
								<FormLabel>
									{ __( 'Calendar link', 'booking-suite' ) }
								</FormLabel>
								<FormControl>
									<Input
										{ ...urlField }
										type="url"
										inputMode="url"
										maxLength={ MAX_LENGTH_URL }
										autoComplete="off"
										spellCheck="false"
										placeholder={ portalPlaceholder(
											field.source
										) }
										className="font-mono text-xs"
									/>
								</FormControl>
								<FormDescription>
									{ portalHint( field.source ) }
								</FormDescription>
								<FormMessage />
							</FormItem>
						) }
					/>

					<SyncStatus feed={ field } />
				</div>
			) ) }
		</div>
	);
}

/**
 * How the last pull went, for a subscription that has had one.
 *
 * A subscription that has quietly stopped working looks exactly like one that
 * is fine — the link is still there, the dates simply stop arriving. This is
 * the only thing on the row that says which is which, so the failure carries
 * the portal's own message rather than a tidied-up version of it.
 *
 * @param {Object} props
 * @param {Object} props.feed The row as it was loaded.
 */
function SyncStatus( { feed } ) {
	if ( ! feed.lastSyncAt ) {
		return (
			<p className="text-xs text-muted-foreground">
				{ feed.id
					? __( 'Not read yet.', 'booking-suite' )
					: __(
							'Saved with the apartment, then read on the next scheduled sync.',
							'booking-suite'
					  ) }
			</p>
		);
	}

	const failed = 'error' === feed.lastStatus;

	return (
		<p
			className={ `text-xs ${
				failed ? 'text-destructive' : 'text-muted-foreground'
			}` }
		>
			{ failed
				? sprintf(
						/* translators: %s: the reason the last read failed. */
						__( 'Last read failed: %s', 'booking-suite' ),
						feed.lastMessage ||
							__( 'no reason given', 'booking-suite' )
				  )
				: sprintf(
						/* translators: 1: number of dated entries read, 2: when it was read. */
						__( 'Last read %1$d entries on %2$s', 'booking-suite' ),
						feed.lastEventCount ?? 0,
						feed.lastSyncAt
				  ) }
		</p>
	);
}

/**
 * The address portals read this apartment's booked dates at.
 *
 * Not a form field. The link is minted by its own endpoint, because creating
 * it puts a live public URL into the world and that is a decision of its own
 * rather than a side effect of saving a rate — and because an apartment that
 * does not exist yet has nothing to publish.
 *
 * @param {Object} props
 * @param {Object} [props.apartment] The stored apartment, or null when adding.
 */

function Section( { title, description = null, children } ) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{ title }
				</h3>
				{ description && (
					<p className="text-xs text-muted-foreground">
						{ description }
					</p>
				) }
			</div>
			{ children }
		</section>
	);
}

const Required = () => (
	<span className="text-destructive" aria-hidden="true">
		*
	</span>
);

function Hint( { text } ) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="text-muted-foreground"
						aria-label={ text }
					>
						<HelpCircle className="h-3.5 w-3.5" />
					</button>
				</TooltipTrigger>
				<TooltipContent>{ text }</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// `description` is optional: the two base rates need no explaining.
function RateField( { form, name, label, description } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ label }</FormLabel>
					<FormControl>
						<Input
							type="number"
							min="0"
							step="0.01"
							inputMode="decimal"
							{ ...field }
						/>
					</FormControl>
					{ description && (
						<FormDescription>{ description }</FormDescription>
					) }
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}

function LinkField( { form, name, label, placeholder } ) {
	return (
		<FormField
			control={ form.control }
			name={ name }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ label }</FormLabel>
					<FormControl>
						<Input
							maxLength={ MAX_LENGTH_191 }
							placeholder={ placeholder }
							{ ...field }
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}
