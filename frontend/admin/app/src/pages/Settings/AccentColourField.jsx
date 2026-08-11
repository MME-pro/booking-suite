/**
 * AccentColourField — the brand colour the guest booking flow is drawn in.
 *
 * Three ways in, because owners arrive with different things in hand: a swatch
 * for someone who just wants a decent colour, the native picker for someone
 * choosing by eye, and a hex box for someone who has the brand value written
 * down. All three write the same value.
 *
 * The preview matters more than it looks. The server derives hover, pressed and
 * tint shades from this one colour, so what a light or unusual choice actually
 * does to a button is not obvious from the swatch alone — showing the real
 * control is quicker than explaining the arithmetic.
 */

import { __ } from '@wordpress/i18n';
import { Check } from 'lucide-react';

import { Input } from '@/components/ui/input';

/** Matches the server's validation exactly; anything else is refused there. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Expand #abc so the preview and the native picker agree with the stored value.
 *
 * @param {string} value A 3- or 6-digit hex colour.
 * @return {string} The 6-digit form, or the default when unparseable.
 */
const full = ( value ) => {
	const hex = String( value || '' ).trim();

	if ( ! HEX.test( hex ) ) {
		return '#2563eb';
	}

	return 4 === hex.length
		? `#${ hex[ 1 ] }${ hex[ 1 ] }${ hex[ 2 ] }${ hex[ 2 ] }${ hex[ 3 ] }${ hex[ 3 ] }`
		: hex.toLowerCase();
};

/**
 * @param {Object}   props
 * @param {string}   props.value    The chosen hex colour.
 * @param {Function} props.onChange Called with the new hex.
 * @param {string[]} props.presets  Swatches offered as shortcuts.
 */
export default function AccentColourField( { value, onChange, presets = [] } ) {
	const colour = full( value );

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				{ /*
				 * The native picker, wearing the current colour. Its own swatch
				 * is hidden so the control reads as one tile rather than a
				 * browser widget inside a box.
				 */ }
				{ /*
				 * A span, not a label: the input fills the tile, so a click
				 * anywhere on it opens the picker and there is no text for a
				 * label to carry. The input names itself instead.
				 */ }
				<span
					className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg border shadow-sm"
					style={ { backgroundColor: colour } }
				>
					<input
						type="color"
						value={ colour }
						onChange={ ( event ) => onChange( event.target.value ) }
						className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
						aria-label={ __( 'Pick a colour', 'booking-suite' ) }
					/>
				</span>

				<Input
					value={ value ?? '' }
					onChange={ ( event ) => onChange( event.target.value ) }
					spellCheck={ false }
					className="w-32 font-mono uppercase"
					aria-label={ __( 'Accent colour hex', 'booking-suite' ) }
					placeholder="#2563EB"
				/>

				<div className="flex flex-wrap items-center gap-1.5">
					{ presets.map( ( preset ) => {
						const isCurrent = full( preset ) === colour;

						return (
							<button
								key={ preset }
								type="button"
								onClick={ () => onChange( preset ) }
								style={ { backgroundColor: preset } }
								className="flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								aria-label={ preset }
								aria-pressed={ isCurrent }
							>
								{ isCurrent && (
									<Check className="h-4 w-4 text-white drop-shadow" />
								) }
							</button>
						);
					} ) }
				</div>
			</div>

			{ /* What the guest will actually see, in the colour chosen. */ }
			<div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
				<span
					className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold text-white"
					style={ { backgroundColor: colour } }
				>
					{ __( 'Book now', 'booking-suite' ) }
				</span>

				<span
					className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
					style={ { borderColor: colour, color: colour } }
				>
					{ /* A sample slot; the plugin shows times in 24-hour form
					     everywhere, so there is nothing here to translate. */ }
					10:00
				</span>

				<span
					className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
					style={ { backgroundColor: colour } }
				>
					1
				</span>

				<span className="text-xs text-muted-foreground">
					{ __(
						'Buttons, selected times and focus rings on the booking flow.',
						'booking-suite'
					) }
				</span>
			</div>
		</div>
	);
}
