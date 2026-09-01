/**
 * ExtraForm — add or amend an extra.
 *
 * Same shape as the booking form: a shadcn Dialog around a shadcn Form
 * (react-hook-form + zod).
 *
 * Stock is the one field that needs explaining. The column is NULL-able, and
 * NULL means "unlimited" — so the switch is what decides whether a quantity is
 * sent at all, and turning it off sends null rather than 0.
 */

import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, ImageIcon } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';

import { dialogMediaProps, openMediaLibrary } from '../../../../lib/media';
import { extraService } from '../../../../services';

const MAX_LENGTH_191 = 191;

/**
 * A number held as a string, at or above `min`.
 *
 * @param {number} min     Lowest accepted value.
 * @param {string} message Shown when the value falls below it.
 * @return {import('zod').ZodString} The guarded string schema.
 */
const numericString = ( min, message ) =>
	z.string().refine( ( value ) => {
		const parsed = Number( String( value ).replace( ',', '.' ) );

		return '' !== value && Number.isFinite( parsed ) && parsed >= min;
	}, message );

const schema = z
	.object( {
		name: z
			.string()
			.min( 1, __( 'Enter a name.', 'booking-suite' ) )
			.max( MAX_LENGTH_191 ),
		description: z.string().optional(),
		price: numericString(
			0,
			__( 'Enter a price of 0 or more.', 'booking-suite' )
		),
		manageStock: z.boolean(),
		stock: z.string().optional(),
		imageUrl: z.string().optional(),
		sortOrder: z.string().optional(),
		active: z.boolean(),
	} )
	.superRefine( ( values, ctx ) => {
		// The quantity only has to make sense when stock is being managed.
		if ( ! values.manageStock ) {
			return;
		}

		const parsed = Number( values.stock );

		if (
			'' === values.stock ||
			! Number.isFinite( parsed ) ||
			parsed < 0
		) {
			ctx.addIssue( {
				code: z.ZodIssueCode.custom,
				path: [ 'stock' ],
				message: __( 'Enter the available quantity.', 'booking-suite' ),
			} );
		}
	} );

const blank = () => ( {
	name: '',
	description: '',
	price: '',
	manageStock: false,
	stock: '0',
	imageUrl: '',
	sortOrder: '0',
	active: true,
} );

/**
 * A stored extra into form values.
 *
 * @param {Object} extra The extra as returned by extraService.
 * @return {Object} Form values.
 */
const fromExtra = ( extra ) => ( {
	name: extra.name ?? '',
	description: extra.description ?? '',
	price: String( extra.price ?? '' ),
	// A null stock is what "unlimited" looks like coming back from the API.
	manageStock: null !== extra.stock,
	stock: null === extra.stock ? '0' : String( extra.stock ),
	imageUrl: extra.imageUrl ?? '',
	sortOrder: String( extra.sortOrder ?? 0 ),
	active: Boolean( extra.active ),
} );

export default function ExtraForm( { extra = null, onClose, onSaved } ) {
	const isEdit = null !== extra;

	const [ error, setError ] = useState( null );

	const form = useForm( {
		resolver: zodResolver( schema ),
		defaultValues: isEdit ? fromExtra( extra ) : blank(),
	} );

	const isSaving = form.formState.isSubmitting;
	const manageStock = form.watch( 'manageStock' );
	const imageUrl = form.watch( 'imageUrl' );

	/** Opens the WordPress media library; see lib/media.js for why via there. */
	const pickImage = () =>
		openMediaLibrary( {
			title: __( 'Choose an image', 'booking-suite' ),
			button: __( 'Use this image', 'booking-suite' ),
			onSelect: ( [ attachment ] ) => {
				if ( attachment?.url ) {
					form.setValue( 'imageUrl', attachment.url, {
						shouldDirty: true,
					} );
				}
			},
		} );

	const save = async ( values ) => {
		setError( null );

		const payload = {
			name: values.name,
			description: values.description,
			price: values.price,
			// Switching stock management off restores "unlimited".
			stock: values.manageStock ? values.stock : null,
			imageUrl: values.imageUrl,
			sortOrder: values.sortOrder,
			active: values.active,
		};

		try {
			const saved = isEdit
				? await extraService.update( extra.id, payload )
				: await extraService.create( payload );

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
				className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
				{ ...dialogMediaProps }
			>
				<DialogHeader>
					<DialogTitle>
						{ isEdit
							? __( 'Edit Extra', 'booking-suite' )
							: __( 'Add New Extra', 'booking-suite' ) }
					</DialogTitle>
					<DialogDescription>
						{ __(
							'Extras are offered to guests during booking.',
							'booking-suite'
						) }
					</DialogDescription>
				</DialogHeader>

				<Form { ...form }>
					<form
						id="bks-extra-form"
						onSubmit={ form.handleSubmit( save ) }
						className="flex flex-col gap-5"
					>
						{ error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{ error }</AlertDescription>
							</Alert>
						) }

						<FormField
							control={ form.control }
							name="name"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Name', 'booking-suite' ) }{ ' ' }
										<Required />
									</FormLabel>
									<FormControl>
										<Input
											maxLength={ MAX_LENGTH_191 }
											{ ...field }
										/>
									</FormControl>
									<FormDescription>
										{ __(
											'Enter the name of the extra item.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="description"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Description', 'booking-suite' ) }
									</FormLabel>
									<FormControl>
										<Textarea rows={ 3 } { ...field } />
									</FormControl>
									<FormDescription>
										{ __(
											'Optional description of the extra item.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="price"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Price', 'booking-suite' ) }{ ' ' }
										<Required />
									</FormLabel>
									<FormControl>
										<Input
											type="number"
											min="0"
											step="0.01"
											inputMode="decimal"
											{ ...field }
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="manageStock"
							render={ ( { field } ) => (
								<FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
									<FormControl>
										<Checkbox
											checked={ field.value }
											onCheckedChange={ field.onChange }
										/>
									</FormControl>
									<div className="space-y-0.5 leading-none">
										<FormLabel>
											{ __(
												'Enable stock management for this extra',
												'booking-suite'
											) }
										</FormLabel>
										<FormDescription>
											{ __(
												'When enabled, you can set a limited quantity. When disabled, unlimited quantity is available.',
												'booking-suite'
											) }
										</FormDescription>
									</div>
								</FormItem>
							) }
						/>

						{ manageStock && (
							<FormField
								control={ form.control }
								name="stock"
								render={ ( { field } ) => (
									<FormItem>
										<FormLabel>
											{ __(
												'Stock Quantity',
												'booking-suite'
											) }{ ' ' }
											<Required />
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												min="0"
												inputMode="numeric"
												{ ...field }
											/>
										</FormControl>
										<FormDescription>
											{ __(
												'Total available quantity for this extra (e.g. 3 for 3 projectors).',
												'booking-suite'
											) }
										</FormDescription>
										<FormMessage />
									</FormItem>
								) }
							/>
						) }

						<FormField
							control={ form.control }
							name="imageUrl"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Image URL', 'booking-suite' ) }
									</FormLabel>
									<FormControl>
										<Input type="url" { ...field } />
									</FormControl>

									<div className="flex flex-wrap items-center gap-2 pt-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={ pickImage }
										>
											<ImageIcon className="h-4 w-4" />
											{ __(
												'Upload Image',
												'booking-suite'
											) }
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={ ! imageUrl }
											onClick={ () =>
												form.setValue( 'imageUrl', '', {
													shouldDirty: true,
												} )
											}
										>
											{ __(
												'Clear Image',
												'booking-suite'
											) }
										</Button>

										{ imageUrl && (
											<img
												src={ imageUrl }
												alt=""
												className="ml-auto h-12 w-12 rounded-md border object-cover"
											/>
										) }
									</div>

									<FormDescription>
										{ __(
											'Optional image for this extra item.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="sortOrder"
							render={ ( { field } ) => (
								<FormItem>
									<FormLabel>
										{ __( 'Sort Order', 'booking-suite' ) }
									</FormLabel>
									<FormControl>
										<Input
											type="number"
											inputMode="numeric"
											{ ...field }
										/>
									</FormControl>
									<FormDescription>
										{ __(
											'Lower numbers appear first. Leave 0 for automatic ordering.',
											'booking-suite'
										) }
									</FormDescription>
									<FormMessage />
								</FormItem>
							) }
						/>

						<FormField
							control={ form.control }
							name="active"
							render={ ( { field } ) => (
								<FormItem className="flex flex-row items-start gap-3">
									<FormControl>
										<Checkbox
											checked={ field.value }
											onCheckedChange={ field.onChange }
										/>
									</FormControl>
									<FormLabel className="leading-none">
										{ __(
											'Active (visible to customers)',
											'booking-suite'
										) }
									</FormLabel>
								</FormItem>
							) }
						/>
					</form>
				</Form>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={ onClose }
						disabled={ isSaving }
					>
						{ __( 'Cancel', 'booking-suite' ) }
					</Button>
					<Button
						type="submit"
						form="bks-extra-form"
						disabled={ isSaving }
					>
						{ isSaving && __( 'Saving…', 'booking-suite' ) }
						{ ! isSaving &&
							( isEdit
								? __( 'Save Extra', 'booking-suite' )
								: __( 'Add Extra', 'booking-suite' ) ) }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const Required = () => (
	<span className="text-destructive" aria-hidden="true">
		*
	</span>
);
