/**
 * PostCSS configuration.
 *
 * IMPORTANT: wp-scripts checks for a project PostCSS config (hasPostCSSConfig)
 * and, when one exists, hands postcss-loader NO options of its own. That means
 * this file fully REPLACES the @wordpress/postcss-plugins-preset pipeline, so
 * postcss-import, autoprefixer and the production cssnano pass are repeated
 * here by hand. Removing any of them silently drops behaviour the build used
 * to get for free.
 *
 * Order matters: imports are inlined first, Tailwind then expands its
 * directives, and autoprefixer runs last over the finished declarations.
 */

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	plugins: [
		require( 'postcss-import' )(),
		require( 'tailwindcss' )(),
		require( 'autoprefixer' )( {
			grid: true,
			overrideBrowserslist: require( '@wordpress/browserslist-config' ),
		} ),
		...( isProduction
			? [
					require( 'cssnano' )( {
						preset: [
							'default',
							{ discardComments: { removeAll: true } },
						],
					} ),
			  ]
			: [] ),
	],
};
