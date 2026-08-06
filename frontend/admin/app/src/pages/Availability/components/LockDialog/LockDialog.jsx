/**
 * LockDialog — takes apartments off the board for a window.
 *
 * One component serves both buttons. A Master Lock is the same form without
 * the apartment picker: it writes a single lock with no apartment, which is
 * how the schema says "the whole property", so it is one thing to release
 * later rather than one row per apartment that could drift apart.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Lock, ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { blockService } from '../../../../services';
import { formatDateTime } from '../../../Bookings/data/format';

const schema = z
	.object( {
		apartmentIds: z.array( z.number() ),
		fromDate: z
			.string()
			.min( 1, __( 'Pick a start date.', 'booking-suite' ) ),
		fromTime: z.string().min( 1 ),
		toDate: z.string().min( 1, __( 'Pick an end date.', 'booking-suite' ) ),
		toTime: z.string().min( 1 ),
		reason: z.string().optional(),
	} )
	.superRefine( ( values, ctx ) => {
		if (
			`${ values.toDate } ${ values.toTime }` <=
			`${ values.fromDate } ${ values.fromTime }`
		) {
			ctx.addIssue( {
				code: z.ZodIssueCode.custom,
				path: [ 'toDate' ],
				message: __(
					'The lock must end after it starts.',
					'booking-suite'
				),
			} );
		}
	} );

const today = () => new Date().toISOString().slice( 0, 10 );

export default function LockDialog( {
	master = false,
	scope = 'apartment',
	apartments,
	onClose,
	onSaved,
} ) {
	const isExtra = 'extra' === scope;
	const [ error, setError ] = useState( null );

	/** Bookings already inside the window, reported after saving. */
	const [ affected, setAffected ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: {
			apartmentIds: [],
			fromDate: today(),
			fromTime: '00:00',
			toDate: today(),
			toTime: '23:59',
			reason: '',
		},
	} );

	const isSaving = form.formState.isSubmitting;
	const chosen = form.watch( 'apartmentIds' );

	const save = async ( values ) => {
		setError( null );

		if ( ! master && ! values.apartmentIds.length ) {
			form.setError( 'apartmentIds', {
				message: __(
					'Choose at least one apartment.',
					'booking-suite'
				),
			} );

			return;
		}

		try {
			const result = await blockService.create( {
				master,
				scope,
				// The server reads whichever list matches the scope.
				apartmentIds: isExtra ? [] : values.apartmentIds,
				extraIds: isExtra ? values.apartmentIds : [],
				startsAt: `${ values.fromDate } ${ values.fromTime }`,
				endsAt: `${ values.toDate } ${ values.toTime }`,
				reason: values.reason,
			} );

			/*
			 * If bookings already sit inside the window, say so before closing:
			 * the lock stops new bookings but leaves those alone, and finding
			 * that out later would be worse.
			 */
			if ( result.affected.length ) {
				setAffected( result.affected );
				onSaved( result.blocks, { keepOpen: true } );

				return;
			}

			onSaved( result.blocks );
		} catch ( cause ) {
			setError( cause.message );
		}
	};

	const toggleApartment = ( id, checked ) => {
		const next = checked
			? [ ...chosen, id ]
			: chosen.filter( ( value ) => value !== id );

		form.setValue( 'apartmentIds', next, { shouldValidate: true } );
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
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{ master ? (
							<ShieldAlert className="h-4 w-4 text-destructive" />
						) : (
							<Lock className="h-4 w-4 text-muted-foreground" />
						) }
						{ master && __( 'Master Lock', 'booking-suite' ) }
						{ ! master &&
							( isExtra
								? __( 'Lock Extra', 'booking-suite' )
								: __( 'Lock Apartment', 'booking-suite' ) ) }
					</DialogTitle>
					<DialogDescription>
						{ master &&
							isExtra &&
							__(
								'Takes every extra off the board for the window. Extras added later are not covered.',
								'booking-suite'
							) }
						{ master &&
							! isExtra &&
							__(
								'Closes every apartment for the window, including any added later.',
								'booking-suite'
							) }
						{ ! master &&
							isExtra &&
							__(
								'Takes the extras you choose off the board for the window.',
								'booking-suite'
							) }
						{ ! master &&
							! isExtra &&
							__(
								'Closes the apartments you choose for the window.',
								'booking-suite'
							) }
					</DialogDescription>
				</DialogHeader>

				{ affected && (
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>
							{ __( 'Lock saved', 'booking-suite' ) }
						</AlertTitle>
						<AlertDescription className="flex flex-col gap-2">
							<span>
								{ __(
									'These bookings already sit inside it. The lock stops new bookings; it has not touched them.',
									'booking-suite'
								) }
							</span>
							<ul className="flex flex-col gap-1 text-xs">
								{ affected.map( ( booking ) => (
									<li key={ booking.id }>
										<strong>
											{ booking.reference ||
												`#${ booking.id }` }
										</strong>{ ' ' }
										· { booking.apartmentName } ·{ ' ' }
										{ formatDateTime( booking.startsAt ) }
									</li>
								) ) }
							</ul>
						</AlertDescription>
					</Alert>
				) }

				{ ! affected && (
					<Form { ...form }>
						<form
							id="bks-lock-form"
							onSubmit={ form.handleSubmit( save ) }
							className="flex flex-col gap-5"
						>
							{ error && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										{ error }
									</AlertDescription>
								</Alert>
							) }

							{ ! master && (
								<FormField
									control={ form.control }
									name="apartmentIds"
									render={ () => (
										<FormItem>
											<FormLabel>
												{ isExtra
													? __(
															'Extras',
															'booking-suite'
													  )
													: __(
															'Apartments',
															'booking-suite'
													  ) }
											</FormLabel>
											<div className="flex flex-col gap-2 rounded-lg border p-3">
												{ apartments.map(
													( apartment ) => (
														<div
															key={ apartment.id }
															className="flex items-center gap-2.5 text-sm"
														>
															<Checkbox
																id={ `bks-lock-${ apartment.id }` }
																checked={ chosen.includes(
																	apartment.id
																) }
																onCheckedChange={ (
																	checked
																) =>
																	toggleApartment(
																		apartment.id,
																		checked
																	)
																}
															/>
															<span
																aria-hidden="true"
																className="h-3 w-3 rounded-sm"
																style={ {
																	background:
																		apartment.colour,
																} }
															/>
															<Label
																htmlFor={ `bks-lock-${ apartment.id }` }
																className="font-normal"
															>
																{
																	apartment.name
																}
															</Label>
														</div>
													)
												) }

												{ ! apartments.length && (
													<span className="text-sm text-muted-foreground">
														{ isExtra
															? __(
																	'No extras yet.',
																	'booking-suite'
															  )
															: __(
																	'No apartments yet.',
																	'booking-suite'
															  ) }
													</span>
												) }
											</div>
											<FormMessage />
										</FormItem>
									) }
								/>
							) }

							<div className="grid grid-cols-2 gap-3">
								<DateTimeField
									form={ form }
									dateName="fromDate"
									timeName="fromTime"
									label={ __( 'From', 'booking-suite' ) }
								/>
								<DateTimeField
									form={ form }
									dateName="toDate"
									timeName="toTime"
									label={ __( 'To', 'booking-suite' ) }
								/>
							</div>

							<FormField
								control={ form.control }
								name="reason"
								render={ ( { field } ) => (
									<FormItem>
										<FormLabel>
											{ __( 'Reason', 'booking-suite' ) }
										</FormLabel>
										<FormControl>
											<Textarea rows={ 3 } { ...field } />
										</FormControl>
										<FormDescription>
											{ __(
												'Kept for your own reference — maintenance, a private stay, a deep clean.',
												'booking-suite'
											) }
										</FormDescription>
										<FormMessage />
									</FormItem>
								) }
							/>
						</form>
					</Form>
				) }

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={ onClose }
						disabled={ isSaving }
					>
						{ affected
							? __( 'Done', 'booking-suite' )
							: __( 'Cancel', 'booking-suite' ) }
					</Button>

					{ ! affected && (
						<Button
							type="submit"
							form="bks-lock-form"
							variant={ master ? 'destructive' : 'default' }
							disabled={ isSaving }
						>
							{ isSaving
								? __( 'Locking…', 'booking-suite' )
								: __( 'Lock', 'booking-suite' ) }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DateTimeField( { form, dateName, timeName, label } ) {
	return (
		<FormField
			control={ form.control }
			name={ dateName }
			render={ ( { field } ) => (
				<FormItem>
					<FormLabel>{ label }</FormLabel>
					<FormControl>
						<Input type="date" { ...field } />
					</FormControl>
					<FormField
						control={ form.control }
						name={ timeName }
						render={ ( { field: timeField } ) => (
							<FormControl>
								<Input
									type="time"
									className="mt-2"
									{ ...timeField }
								/>
							</FormControl>
						) }
					/>
					<FormMessage />
				</FormItem>
			) }
		/>
	);
}
