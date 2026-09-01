/**
 * The icon set.
 *
 * Inline SVG rather than an icon font or a package: the guest bundle is loaded
 * on a marketing page where weight is felt, and eight paths cost less than any
 * dependency that would draw them. Every icon inherits `currentColor` and sizes
 * from the `size` prop, so an icon never needs its own colour rule.
 *
 * All are decorative by default — they sit beside a text label — so they carry
 * aria-hidden. Pass a `title` when an icon is the only thing conveying meaning.
 */

/**
 * Shared frame. Stroke-based at a 1.6 weight, which reads crisply at 16-20px
 * without the muddiness a 2 weight gives at small sizes.
 *
 * @param {Object} props
 * @param {number} props.size     Width and height in pixels.
 * @param {string} [props.title]  Accessible name; omit for decorative icons.
 * @param {Object} props.children The paths.
 */
function Glyph( { size = 18, title, children, ...rest } ) {
	return (
		<svg
			width={ size }
			height={ size }
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden={ title ? undefined : 'true' }
			role={ title ? 'img' : undefined }
			focusable="false"
			{ ...rest }
		>
			{ title && <title>{ title }</title> }
			{ children }
		</svg>
	);
}

export const UsersIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
		<circle cx="10" cy="7.5" r="3.5" />
		<path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
	</Glyph>
);

export const HomeIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
		<path d="M9.5 20.5v-6h5v6" />
	</Glyph>
);

export const UserIcon = ( props ) => (
	<Glyph { ...props }>
		<circle cx="12" cy="8" r="4" />
		<path d="M5 20.5v-1a4.5 4.5 0 0 1 4.5-4.5h5a4.5 4.5 0 0 1 4.5 4.5v1" />
	</Glyph>
);

export const MailIcon = ( props ) => (
	<Glyph { ...props }>
		<rect x="3" y="5.5" width="18" height="13" rx="2.5" />
		<path d="m3.8 7.5 7.3 5.2a1.5 1.5 0 0 0 1.8 0l7.3-5.2" />
	</Glyph>
);

export const PhoneIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M7.5 3.5h-2A2.5 2.5 0 0 0 3 6.2C3.5 13.7 10.3 20.5 17.8 21a2.5 2.5 0 0 0 2.7-2.5v-2l-4.3-1.4-1.9 2.3a13.6 13.6 0 0 1-5.7-5.7l2.3-1.9Z" />
	</Glyph>
);

export const CalendarIcon = ( props ) => (
	<Glyph { ...props }>
		<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
		<path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
	</Glyph>
);

export const ClockIcon = ( props ) => (
	<Glyph { ...props }>
		<circle cx="12" cy="12" r="8.5" />
		<path d="M12 7v5.2l3.2 2" />
	</Glyph>
);

export const MoonIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
	</Glyph>
);

export const SearchIcon = ( props ) => (
	<Glyph { ...props }>
		<circle cx="10.5" cy="10.5" r="6.5" />
		<path d="m20 20-4.9-4.9" />
	</Glyph>
);

export const ChevronDownIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="m6 9.5 6 6 6-6" />
	</Glyph>
);

export const ChevronLeftIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="m14.5 6-6 6 6 6" />
	</Glyph>
);

export const ChevronRightIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="m9.5 6 6 6-6 6" />
	</Glyph>
);

export const PlusIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M12 5.5v13M5.5 12h13" />
	</Glyph>
);

export const MinusIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M5.5 12h13" />
	</Glyph>
);

export const ImageIcon = ( props ) => (
	<Glyph { ...props }>
		<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
		<circle cx="9" cy="10" r="1.6" />
		<path d="m4 17 4.5-4.5 3 3 3-2.5L20 17" />
	</Glyph>
);

export const MapPinIcon = ( props ) => (
	<Glyph { ...props }>
		<path d="M19 10.5c0 5-7 10.5-7 10.5s-7-5.5-7-10.5a7 7 0 1 1 14 0Z" />
		<circle cx="12" cy="10.3" r="2.6" />
	</Glyph>
);
