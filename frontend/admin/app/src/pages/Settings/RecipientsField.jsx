/**
 * RecipientsField — the addresses the daily summary goes to.
 *
 * One box and a plus, rather than a textarea. A textarea asks the owner to know
 * that the separator is a newline and gives no sign that an address was
 * accepted; here each address becomes a chip the moment it is added, which is
 * both the confirmation and the way to take it off again.
 *
 * The value on the wire is still one newline-separated string, because that is
 * what the endpoint stores and what an existing installation already holds.
 * This component is a way of editing that string, not a change to it.
 */

import { forwardRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Deliberately loose, and the same shape the server's is_email() accepts in
 * practice. Refusing an unusual but valid address is worse than letting a typo
 * through — a typo bounces visibly, a refusal just looks broken.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The stored string as a list.
 *
 * Split on the same separators the repository splits on, so an address typed
 * into the old textarea with commas survives the change of control.
 *
 * @param {string} value The stored value.
 * @return {string[]} One address per entry, blanks dropped.
 */
const parse = ( value ) =>
	String( value ?? '' )
		.split( /[,;\r\n]+/ )
		.map( ( address ) => address.trim() )
		.filter( Boolean );

/**
 * @param {Object}   props
 * @param {string}   props.value    The stored, newline-separated addresses.
 * @param {Function} props.onChange Called with the new stored value.
 * @param {Object}   ref            Forwarded to the box that is typed into.
 */
const RecipientsField = forwardRef( function RecipientsField(
	{ value, onChange, ...rest },
	ref
) {
	const [ draft, setDraft ] = useState( '' );
	const [ error, setError ] = useState( '' );

	const addresses = parse( value );

	const commit = ( next ) => onChange( next.join( '\n' ) );

	const add = () => {
		const address = draft.trim();

		if ( '' === address ) {
			return;
		}

		if ( ! EMAIL.test( address ) ) {
			setError( __( 'That does not look like an email address.', 'booking-suite' ) );

			return;
		}

		// Case-insensitively, because two spellings of one mailbox would send
		// the same person the summary twice.
		if (
			addresses.some(
				( existing ) =>
					existing.toLowerCase() === address.toLowerCase()
			)
		) {
			setError( __( 'That address is already on the list.', 'booking-suite' ) );

			return;
		}

		commit( [ ...addresses, address ] );
		setDraft( '' );
		setError( '' );
	};

	const remove = ( address ) =>
		commit( addresses.filter( ( existing ) => existing !== address ) );

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-start gap-2">
				<Input
					{ ...rest }
					ref={ ref }
					type="email"
					value={ draft }
					onChange={ ( event ) => {
						setDraft( event.target.value );
						setError( '' );
					} }
					/*
					 * Enter adds the address instead of submitting the form.
					 * Without this, typing one and pressing Enter saves the
					 * settings while throwing the address away.
					 */
					onKeyDown={ ( event ) => {
						if ( 'Enter' === event.key ) {
							event.preventDefault();
							add();
						}
					} }
					placeholder={ __( 'name@example.com', 'booking-suite' ) }
					aria-invalid={ Boolean( error ) }
					spellCheck={ false }
				/>

				<Button
					type="button"
					variant="outline"
					size="icon"
					className="shrink-0"
					onClick={ add }
					disabled={ '' === draft.trim() }
					aria-label={ __( 'Add address', 'booking-suite' ) }
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			{ error && (
				<p className="text-sm font-medium text-destructive">{ error }</p>
			) }

			{ addresses.length > 0 && (
				<ul className="flex flex-wrap gap-2">
					{ addresses.map( ( address ) => (
						<li
							key={ address }
							className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm"
						>
							<span className="break-all">{ address }</span>
							<button
								type="button"
								onClick={ () => remove( address ) }
								className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/*
								 * The address belongs in the label, not just
								 * beside it: a screen reader hearing "Remove"
								 * eight times in a row is told nothing.
								 */
								aria-label={ sprintf(
									/* translators: %s: an email address. */
									__( 'Remove %s', 'booking-suite' ),
									address
								) }
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
} );

export default RecipientsField;
