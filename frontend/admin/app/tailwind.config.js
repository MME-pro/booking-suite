/**
 * Tailwind configuration.
 *
 * Two settings carry the whole integration and should not be changed casually:
 *
 * 1. `important` — every utility is emitted as `#booking-suite-admin-root .p-4`,
 *    raising it to (1,1,0) so it outranks the WordPress admin stylesheet
 *    without resorting to a global `!important`. It also confines utilities to
 *    the app, which is why Radix portals must be mounted inside the root (see
 *    src/lib/portal.js) rather than on document.body.
 *
 * 2. `corePlugins.preflight: false` — Preflight is a global element reset and
 *    would strip the styling off the surrounding wp-admin chrome. A scoped
 *    stand-in lives in src/styles/tailwind.css.
 *
 * Colours are not shadcn's stock slate palette: they are wired to the existing
 * Booking Suite design tokens so the shadcn components inherit the sapphire
 * hospitality theme instead of looking like an off-the-shelf template.
 */

/** The mount point printed by frontend/admin/Menu.php::render_root(). */
const APP_ROOT = '#booking-suite-admin-root';

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: [ 'class' ],
	important: APP_ROOT,
	content: [ './src/**/*.{js,jsx,ts,tsx}' ],
	corePlugins: {
		preflight: false,
	},
	theme: {
		extend: {
			fontFamily: {
				sans: [ 'var(--bks-font-family)' ],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground':
						'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground':
						'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			boxShadow: {
				brand: 'var(--bks-shadow-brand)',
				elevated: 'var(--bks-shadow-lg)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [ require( 'tailwindcss-animate' ) ],
};
