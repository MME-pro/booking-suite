import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Marker class stamped onto every shadcn/ui element.
 *
 * Preflight is disabled (see tailwind.config.js) because it is a global reset
 * and would strip the surrounding wp-admin chrome. The replacement reset in
 * src/styles/tailwind.css therefore needs a way to target shadcn's markup and
 * nothing else — and the existing CSS-module components need a way to opt OUT
 * of it. Every shadcn component routes its classes through cn(), so adding the
 * marker here covers the whole library, including components added later.
 */
export const UI_MARKER = 'bs-ui';

/**
 * Merges class names, letting later Tailwind utilities override earlier ones of
 * the same kind, and tags the element as shadcn/ui markup.
 *
 * @param {...any} inputs Class values, in clsx's accepted shapes.
 * @return {string} The merged class string.
 */
export function cn( ...inputs ) {
	return `${ twMerge( clsx( inputs ) ) } ${ UI_MARKER }`.trim();
}
