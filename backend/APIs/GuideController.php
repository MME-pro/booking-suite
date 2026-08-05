<?php
/**
 * REST route behind the developer guide.
 *
 * GET /booking-suite/v1/guide
 *
 * The endpoint list is read back from the REST server rather than written out
 * by hand, so it cannot fall out of step with the routes that actually exist —
 * add a controller and it appears here on its own. Shortcode attributes are
 * declared inside shortcode_atts() calls and cannot be introspected, so those
 * come from Shortcodes::documentation().
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Frontend\Site\Shortcodes;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class GuideController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'guide';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	public static function register(): void {
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
	}

	public static function register_routes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( self::class, 'index' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	public static function index(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'shortcodes' => Shortcodes::documentation(),
				'endpoints'  => self::endpoints(),
				'restBase'   => esc_url_raw( rest_url( self::NAMESPACE . '/' ) ),
			),
			200
		);
	}

	/**
	 * Every route this plugin registers, with its methods and arguments.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function endpoints(): array {
		$routes    = rest_get_server()->get_routes();
		$namespace = '/' . self::NAMESPACE;
		$endpoints = array();

		foreach ( $routes as $route => $handlers ) {
			if ( ! str_starts_with( $route, $namespace ) ) {
				continue;
			}

			// The namespace index itself is not an endpoint anyone calls.
			if ( $route === $namespace ) {
				continue;
			}

			foreach ( $handlers as $handler ) {
				$methods = array_keys(
					array_filter( (array) ( $handler['methods'] ?? array() ) )
				);

				if ( ! $methods ) {
					continue;
				}

				$endpoints[] = array(
					'route'   => $route,
					// Trimmed of the namespace, which the page shows once.
					'path'    => substr( $route, strlen( $namespace ) ),
					'methods' => $methods,
					'public'  => self::is_public( $handler ),
					'args'    => self::args( (array) ( $handler['args'] ?? array() ) ),
				);
			}
		}

		usort(
			$endpoints,
			static fn( array $a, array $b ): int => strcmp( $a['path'], $b['path'] )
		);

		return $endpoints;
	}

	/**
	 * Whether the route is open to guests.
	 *
	 * The public endpoints are the ones the booking modal calls before anyone
	 * has logged in, and they all use __return_true.
	 *
	 * @param array<string, mixed> $handler
	 */
	private static function is_public( array $handler ): bool {
		return '__return_true' === ( $handler['permission_callback'] ?? null );
	}

	/**
	 * @param array<string, array<string, mixed>> $args
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function args( array $args ): array {
		$documented = array();

		foreach ( $args as $name => $definition ) {
			$type = $definition['type'] ?? '';

			$documented[] = array(
				'name'     => (string) $name,
				'type'     => is_array( $type ) ? implode( '|', $type ) : (string) $type,
				'required' => ! empty( $definition['required'] ),
				'enum'     => array_map( 'strval', (array) ( $definition['enum'] ?? array() ) ),
				'default'  => isset( $definition['default'] )
					? (string) $definition['default']
					: '',
			);
		}

		usort(
			$documented,
			static fn( array $a, array $b ): int => strcmp( $a['name'], $b['name'] )
		);

		return $documented;
	}
}
