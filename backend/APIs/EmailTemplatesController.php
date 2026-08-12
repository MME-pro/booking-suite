<?php
/**
 * REST routes for the guest email templates.
 *
 * GET  /booking-suite/v1/email-templates              list, with placeholders
 * PUT  /booking-suite/v1/email-templates/<key>        save subject/body/enabled
 * POST /booking-suite/v1/email-templates/<key>/reset  back to the shipped text
 * POST /booking-suite/v1/email-templates/<key>/test   send it to one address
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\BookingsRepository;
use BookingSuite\Backend\Repositories\EmailTemplatesRepository;
use BookingSuite\Backend\Support\BookingEmails;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class EmailTemplatesController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'email-templates';

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

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<key>[a-z_]+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'subject' => array(
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'sanitize_text_field',
						),
						'body'    => array(
							'type'              => 'string',
							'required'          => false,
							/*
							 * Bodies are HTML. sanitize_textarea_field would
							 * strip every tag, so an author's markup would be
							 * silently destroyed on save. wp_kses_post allows
							 * what a post allows — formatting, links, lists,
							 * tables and images — and refuses <script> and the
							 * event attributes that make an email dangerous.
							 * Only an administrator can reach this route.
							 */
							'sanitize_callback' => 'wp_kses_post',
						),
						'enabled' => array(
							'type'     => 'boolean',
							'required' => false,
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<key>[a-z_]+)/reset',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'reset' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
			)
		);

		/*
		 * Preview is rendered by the same code that sends, so what the editor
		 * shows is the email itself rather than the screen's impression of it.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<key>[a-z_]+)/preview',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'preview' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						// Unsaved, so the author can see a change before keeping it.
						'subject' => array(
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'sanitize_text_field',
						),
						'body'    => array(
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'wp_kses_post',
						),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/(?P<key>[a-z_]+)/test',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( self::class, 'test' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'email' => array(
							'type'              => 'string',
							'required'          => true,
							'sanitize_callback' => 'sanitize_email',
						),
					),
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
				'templates'    => array_values( EmailTemplatesRepository::all() ),
				'placeholders' => EmailTemplatesRepository::placeholders(),
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update( WP_REST_Request $request ) {
		$data = array();

		foreach ( array( 'subject', 'body', 'enabled' ) as $field ) {
			if ( null !== $request->get_param( $field ) ) {
				$data[ $field ] = $request->get_param( $field );
			}
		}

		$template = EmailTemplatesRepository::save(
			(string) $request['key'],
			$data
		);

		if ( null === $template ) {
			return self::not_found();
		}

		return new WP_REST_Response( $template, 200 );
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function reset( WP_REST_Request $request ) {
		$template = EmailTemplatesRepository::reset( (string) $request['key'] );

		if ( null === $template ) {
			return self::not_found();
		}

		return new WP_REST_Response( $template, 200 );
	}

	/**
	 * The finished email for a template, as HTML, without sending it.
	 *
	 * Takes the subject and body from the request rather than from storage, so
	 * an author can see an edit before deciding to keep it.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function preview( WP_REST_Request $request ) {
		$key      = (string) $request['key'];
		$template = EmailTemplatesRepository::find( $key );

		if ( null === $template ) {
			return self::not_found();
		}

		$subject = $request->get_param( 'subject' );
		$body    = $request->get_param( 'body' );

		return new WP_REST_Response(
			array(
				'html' => BookingEmails::render(
					null === $subject ? (string) $template['subject'] : (string) $subject,
					null === $body ? (string) $template['body'] : (string) $body
				),
			),
			200
		);
	}

	/**
	 * Sends the template to one address, filled in from the most recent
	 * booking so the placeholders show real values rather than their names.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function test( WP_REST_Request $request ) {
		$key   = (string) $request['key'];
		$email = (string) $request->get_param( 'email' );

		if ( null === EmailTemplatesRepository::find( $key ) ) {
			return self::not_found();
		}

		if ( ! is_email( $email ) ) {
			return new WP_Error(
				'booking_suite_invalid_field',
				__( 'Enter a valid email address.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'email',
				)
			);
		}

		$bookings = BookingsRepository::all( array() );
		$booking  = $bookings[0] ?? null;

		if ( null === $booking ) {
			return new WP_Error(
				'booking_suite_no_bookings',
				__(
					'There are no bookings yet, so there is nothing to fill the placeholders with.',
					'booking-suite'
				),
				array( 'status' => 409 )
			);
		}

		// Redirect this one send to the tester, leaving the guest out of it.
		$redirect = static function ( array $mail ) use ( $email ): array {
			$mail['to']      = $email;
			$mail['subject'] = '[TEST] ' . $mail['subject'];

			return $mail;
		};

		add_filter( 'booking_suite_guest_email', $redirect );

		$sent = BookingEmails::send( $key, (int) $booking['id'] );

		remove_filter( 'booking_suite_guest_email', $redirect );

		if ( ! $sent ) {
			return new WP_Error(
				'booking_suite_mail_failed',
				__(
					'WordPress could not send the email. Check the template is switched on and that the site can send mail.',
					'booking-suite'
				),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( array( 'sent' => true ), 200 );
	}

	private static function not_found(): WP_Error {
		return new WP_Error(
			'booking_suite_template_not_found',
			__( 'That email template does not exist.', 'booking-suite' ),
			array( 'status' => 404 )
		);
	}
}
