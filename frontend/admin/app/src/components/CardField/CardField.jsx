/**
 * CardField — one labelled value inside a record card.
 *
 * The card layouts that stand in for tables on narrow screens all need the same
 * thing: a small muted label with its value under it, sized so two sit side by
 * side on a phone. Defining it once keeps Bookings and Customers looking like
 * the same product, and means the next screen that grows a card view inherits
 * the treatment instead of approximating it.
 *
 * The label sits above its value rather than beside it. Side-by-side pairs need
 * a predictable label column, and "Lifetime value" next to a formatted amount
 * on a 360px screen leaves the number about nine characters.
 */

/**
 * @param {Object} props
 * @param {string} props.title       The field label.
 * @param {*}      props.children    The value.
 * @param {string} [props.className] Extra classes, e.g. `text-right`.
 * @return {JSX.Element} The field.
 */
export default function CardField( { title, children, className = '' } ) {
	return (
		<div className={ `flex min-w-0 flex-col gap-0.5 ${ className }` }>
			<span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
				{ title }
			</span>
			<div className="min-w-0 text-sm leading-snug text-card-foreground">
				{ children }
			</div>
		</div>
	);
}
