/**
 * Inline icons.
 *
 * Kept as components rather than an icon font so colour and size follow the
 * surrounding text, and so the set can be swapped wholesale with the design
 * language. Paths are from the 24x24 Material grid.
 */

const Svg = ( { children, ...props } ) => (
	<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" { ...props }>
		{ children }
	</svg>
);

// Isometric cube standing in for the Booking Suite mark.
export const BrandMark = ( props ) => (
	<Svg { ...props }>
		<path d="M12 2.1 3.6 6.6v10.8L12 21.9l8.4-4.5V6.6L12 2.1zm0 2.27 6.2 3.32L12 11l-6.2-3.31L12 4.37zM5.4 9.35 11.1 12.4v6.63L5.4 16V9.35zm7.5 9.68V12.4l5.7-3.05V16l-5.7 3.03z" />
	</Svg>
);

export const PlusIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M11 5h2v14h-2z" />
		<path d="M5 11h14v2H5z" />
	</Svg>
);

export const SearchIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M10.5 3a7.5 7.5 0 0 1 5.92 12.1l4.24 4.25-1.41 1.41-4.25-4.24A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
	</Svg>
);

export const CloseIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.89 18.3 9.18 12 2.89 5.71 4.3 4.29l6.29 6.3 6.3-6.3z" />
	</Svg>
);

export const UsersIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16 6a2.75 2.75 0 1 1 0 5.5A2.75 2.75 0 0 1 16 6zm0 1.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM9 12.5c2.9 0 5.25 1.46 5.25 3.25V19h-10.5v-3.25C3.75 13.96 6.1 12.5 9 12.5zm0 1.5c-2.2 0-3.75 1-3.75 1.75v1.75h7.5v-1.75C12.75 15 11.2 14 9 14zm7-1.5c2.24 0 4.25 1.05 4.25 2.62V19h-4.5v-3.25c0-.78-.3-1.47-.8-2.03.34-.14.7-.22 1.05-.22z" />
	</Svg>
);

export const LinkIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M10.6 13.4a3.5 3.5 0 0 1 0-4.95l2.83-2.83a3.5 3.5 0 0 1 4.95 4.95l-1.24 1.24-1.06-1.06 1.24-1.24a2 2 0 1 0-2.83-2.83l-2.83 2.83a2 2 0 0 0 0 2.83zM13.4 10.6a3.5 3.5 0 0 1 0 4.95l-2.83 2.83a3.5 3.5 0 0 1-4.95-4.95l1.24-1.24 1.06 1.06-1.24 1.24a2 2 0 1 0 2.83 2.83l2.83-2.83a2 2 0 0 0 0-2.83z" />
	</Svg>
);

export const TextIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M4 4h16v1.5H4zm0 4.5h16V10H4zm0 4.5h11v1.5H4zm0 4.5h11V19H4z" />
	</Svg>
);

export const ChevronDownIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 15.06 5.47 8.53l1.41-1.41L12 12.24l5.12-5.12 1.41 1.41z" />
	</Svg>
);

export const CloudUploadIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 8.5 8.2 12.3l1.06 1.06 1.99-1.99V18h1.5v-6.63l1.99 1.99 1.06-1.06z" />
		<path d="M6.75 18.5a4.75 4.75 0 0 1-.72-9.44 6.25 6.25 0 0 1 11.94.94 4.25 4.25 0 0 1-.72 8.44v-1.5a2.75 2.75 0 0 0 0-5.5h-.65l-.1-.64a4.75 4.75 0 0 0-9.27-.53l-.14.57-.58.07a3.25 3.25 0 0 0 .24 6.09z" />
	</Svg>
);

export const HelpIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 1.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm-.06 2.6a2.9 2.9 0 0 0-2.9 2.72h1.5a1.4 1.4 0 1 1 1.66 1.44c-.7.14-1.2.77-1.2 1.5v1.24h1.5v-1.1a2.9 2.9 0 0 0-.56-5.8zM11.25 15.5h1.5V17h-1.5z" />
	</Svg>
);

export const ApartmentIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M4 3h10a1 1 0 0 1 1 1v6h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h8V5H5zm10 7v7h3v-7h-3zM6.5 7h2v2h-2V7zm3.5 0h2v2h-2V7zM6.5 11h2v2h-2v-2zm3.5 0h2v2h-2v-2zM6.5 15h2v2h-2v-2zm3.5 0h2v2h-2v-2z" />
	</Svg>
);

export const SparklesIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2zm6 13.5l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2 1.2-2.8z" />
	</Svg>
);

export const ClockIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z" />
	</Svg>
);

export const CheckCircleIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.59L6.41 12l1.42-1.41L11 13.17l6.59-6.59L19 8l-8 8.59z" />
	</Svg>
);

export const TrendingUpIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" />
	</Svg>
);

export const EditIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
	</Svg>
);

export const TrashIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
	</Svg>
);

export const EyeIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
	</Svg>
);

export const ReceiptIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2l-1.5 1.5L6 2l-1.5 1.5L3 2v20z" />
	</Svg>
);

export const CalendarIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
	</Svg>
);

export const RefreshIcon = ( props ) => (
	<Svg { ...props }>
		<path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
	</Svg>
);
