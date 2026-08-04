/**
 * Webpack configuration.
 *
 * Extends the wp-scripts default rather than replacing it — the default is
 * mutated in place because it exposes some fields through getters that a
 * spread would flatten or drop.
 *
 * The only addition is the `@` alias, which shadcn/ui components rely on for
 * their `@/lib/utils` and `@/components/ui/*` imports.
 */

const path = require( 'path' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

defaultConfig.resolve.alias = {
	...defaultConfig.resolve.alias,
	'@': path.resolve( __dirname, 'src' ),
};

module.exports = defaultConfig;
