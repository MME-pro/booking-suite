<?php
/**
 * REST routes for plugin settings.
 *
 * GET /booking-suite/v1/settings   read
 * PUT /booking-suite/v1/settings   update
 *
 * Values are read and written through SettingsRepository (the `mmebk_settings`
 * table), which is the same store the pricing engine and PaymentsRepository
 * read from — so changing the currency here actually changes what guests are
 * charged in.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\APIs;

use BookingSuite\Backend\Repositories\SettingsRepository;
use BookingSuite\Backend\Support\DailySummary;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

final class SettingsController {

	public const NAMESPACE = 'booking-suite/v1';

	public const ROUTE = 'settings';

	/** Matches Menu::CAPABILITY. */
	private const CAPABILITY = 'manage_options';

	/** Currencies the booking flow can price in. */
	public const CURRENCIES = array( 'EUR', 'USD', 'GBP', 'CHF' );

	/** Offered as swatches. Any hex is accepted; these are only shortcuts. */
	public const ACCENT_PRESETS = array( '#2563eb', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#0f172a' );

	/**
	 * Setting key → the repository key it is stored under.
	 *
	 * There is deliberately no language setting. The plugin follows the
	 * WordPress site language through its own translation catalogue, so a
	 * control here could only ever disagree with Settings → General.
	 */
	private const KEYS = array(
		'currency'       => SettingsRepository::CURRENCY,
		'accentColour'   => SettingsRepository::ACCENT_COLOUR,
		'invoiceLogo'    => SettingsRepository::INVOICE_LOGO,
		'invoiceSender'  => SettingsRepository::INVOICE_SENDER,
		'invoicePrefix'  => SettingsRepository::INVOICE_PREFIX,
		'invoiceDueDays' => SettingsRepository::INVOICE_DUE_DAYS,
		'invoiceThanks'  => SettingsRepository::INVOICE_THANKS,
		'invoicePhone'   => SettingsRepository::INVOICE_PHONE,
		'invoiceEmail'   => SettingsRepository::INVOICE_EMAIL,
		'invoiceNotice'  => SettingsRepository::INVOICE_NOTICE,
		'invoiceCounter' => SettingsRepository::INVOICE_COUNTER,
		'taxRate'        => SettingsRepository::TAX_RATE,
		'companyName'    => SettingsRepository::COMPANY_NAME,
		'companyAddress' => SettingsRepository::COMPANY_ADDRESS,
		'companyPhone'   => SettingsRepository::COMPANY_PHONE,
		'companyEmail'   => SettingsRepository::COMPANY_EMAIL,
		'companyLogo'    => SettingsRepository::COMPANY_LOGO,
		'adminEmail'     => SettingsRepository::ADMIN_EMAIL,
		'bankHolder'     => SettingsRepository::BANK_HOLDER,
		'bankName'       => SettingsRepository::BANK_NAME,
		'bankIban'       => SettingsRepository::BANK_IBAN,
		'bankBic'        => SettingsRepository::BANK_BIC,
		'bankDetails'    => SettingsRepository::BANK_DETAILS,
		'emailNotifications' => SettingsRepository::EMAIL_NOTIFICATIONS,
		/*
		 * The booking rules. Every one of these shapes what a guest may ask
		 * for, so every one of them is the owner's to change.
		 */
		'minHours'       => SettingsRepository::MIN_HOURS,
		'maxHours'       => SettingsRepository::MAX_HOURS,
		'baseHours'      => SettingsRepository::BASE_HOURS,
		'includedGuests' => SettingsRepository::INCLUDED_GUESTS,
		'dayStart'       => SettingsRepository::DAY_START,
		'dayEnd'         => SettingsRepository::DAY_END,
		'slotStep'       => SettingsRepository::SLOT_STEP,
		'overnightStart' => SettingsRepository::OVERNIGHT_START,
		'overnightEnd'   => SettingsRepository::OVERNIGHT_END,
		'daytimeSlotDays'  => SettingsRepository::DAYTIME_SLOT_DAYS,
		'daytimeSlotStart' => SettingsRepository::DAYTIME_SLOT_START,
		'daytimeSlotEnd'   => SettingsRepository::DAYTIME_SLOT_END,
		'reservationHours'  => SettingsRepository::RESERVATION_HOURS,
		'taxRateOvernight'  => SettingsRepository::TAX_RATE_OVERNIGHT,
		'taxRateHourly'     => SettingsRepository::TAX_RATE_HOURLY,
		'prepayDiscount'    => SettingsRepository::PREPAY_DISCOUNT,
		'dailySummaryEnabled'    => SettingsRepository::DAILY_SUMMARY_ENABLED,
		'dailySummaryTime'       => SettingsRepository::DAILY_SUMMARY_TIME,
		'dailySummaryRecipients' => SettingsRepository::DAILY_SUMMARY_RECIPIENTS,
		'termsUrl'       => SettingsRepository::TERMS_URL,
		'privacyUrl'     => SettingsRepository::PRIVACY_URL,
	);

	/** Free-text fields: stored as written, escaped when drawn. */
	private const TEXT_KEYS = array(
		'dailySummaryRecipients',
		'invoiceSender',
		'invoiceThanks',
		'invoiceNotice',
		'companyAddress',
		'bankDetails',
	);

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
					'callback'            => array( self::class, 'show' ),
					'permission_callback' => array( self::class, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( self::class, 'update' ),
					'permission_callback' => array( self::class, 'can_manage' ),
					'args'                => array(
						'currency'     => array(
							'type'     => 'string',
							'required' => false,
							'enum'     => self::CURRENCIES,
						),
						'accentColour' => array(
							'type'              => 'string',
							'required'          => false,
							// Refused at the door rather than sanitised into
							// something the caller did not ask for.
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value ) && 1 === preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', trim( $value ) ),
						),
						'invoiceLogo'    => array(
							'type'              => 'integer',
							'required'          => false,
							// 0 clears it; anything else has to be real media.
							'validate_callback' => static fn( $value ): bool =>
								is_numeric( $value )
								&& ( 0 === (int) $value || 'attachment' === get_post_type( (int) $value ) ),
						),
						'invoiceSender'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoicePrefix'  => array(
							'type'              => 'string',
							'required'          => false,
							// It becomes part of a filename and of a sort key.
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value ) && 1 === preg_match( '/^[A-Za-z0-9]{1,10}$/', trim( $value ) ),
						),
						'invoiceDueDays' => array(
							'type'     => 'integer',
							'required' => false,
							'minimum'  => 0,
							'maximum'  => 365,
						),
						'invoiceThanks'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoicePhone'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoiceEmail'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoiceNotice'  => array(
							'type'     => 'string',
							'required' => false,
						),
						'invoiceCounter' => array(
							'type'     => 'integer',
							'required' => false,
							'minimum'  => 0,
						),
						'taxRate'        => array(
							'type'     => 'number',
							'required' => false,
							'minimum'  => 0,
							'maximum'  => 100,
						),
						'companyName'    => array(
							'type'     => 'string',
							'required' => false,
						),
						'companyAddress' => array(
							'type'     => 'string',
							'required' => false,
						),
						'companyPhone'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'companyEmail'   => array(
							'type'     => 'string',
							'required' => false,
						),
						'companyLogo'    => array(
							'type'              => 'integer',
							'required'          => false,
							'validate_callback' => static fn( $value ): bool =>
								is_numeric( $value )
								&& ( 0 === (int) $value || 'attachment' === get_post_type( (int) $value ) ),
						),
						'adminEmail'     => array(
							'type'     => 'string',
							'required' => false,
						),
						'bankHolder'     => array(
							'type'     => 'string',
							'required' => false,
						),
						'bankName'       => array(
							'type'     => 'string',
							'required' => false,
						),
						'bankIban'       => array(
							'type'              => 'string',
							'required'          => false,
							/*
							 * Length and alphabet only — an IBAN's checksum is
							 * the bank's business, and refusing an unusual but
							 * valid one would be worse than accepting a typo.
							 */
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value )
								&& ( '' === trim( $value )
									|| 1 === preg_match( '/^[A-Za-z]{2}[0-9A-Za-z \s]{8,40}$/', trim( $value ) ) ),
						),
						'bankBic'        => array(
							'type'              => 'string',
							'required'          => false,
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value )
								&& ( '' === trim( $value )
									|| 1 === preg_match( '/^[A-Za-z0-9]{8,11}$/', trim( $value ) ) ),
						),
						'bankDetails'    => array(
							'type'     => 'string',
							'required' => false,
						),
						/*
						 * Hours and minutes are bounded rather than merely
						 * numeric: a zero-minute step makes the slot generator
						 * loop forever, and a maximum below the minimum leaves
						 * a guest no length at all to pick.
						 */
						'minHours'       => self::whole( 1, 24 ),
						'maxHours'       => self::whole( 1, 24 ),
						'baseHours'      => self::whole( 1, 24 ),
						'includedGuests' => self::whole( 1, 99 ),
						'slotStep'       => self::whole( 5, 240 ),
						'dayStart'       => self::clock(),
						'dayEnd'         => self::clock(),
						'overnightStart' => self::clock(),
						'overnightEnd'   => self::clock(),
						'daytimeSlotStart' => self::clock(),
						'daytimeSlotEnd'   => self::clock(),
						'daytimeSlotDays'  => array(
							'type'     => 'string',
							'required' => false,
							/*
							 * ISO-8601 weekday numbers, comma separated, or
							 * empty for "never". Anything else is refused
							 * rather than quietly reduced to the days it could
							 * make sense of.
							 */
							'validate_callback' => static fn( $value ): bool =>
								is_string( $value )
								&& ( '' === trim( $value )
									|| 1 === preg_match( '/^[1-7](,[1-7])*$/', trim( $value ) ) ),
						),
						'reservationHours' => self::whole( 1, 720 ),
						/*
						 * A percentage, not a fraction, and allowed to be zero —
						 * which is how an owner switches the discount off.
						 */
						'taxRateOvernight' => self::percent(),
						'taxRateHourly'    => self::percent(),
						'prepayDiscount'   => self::percent(),
						'emailNotifications' => array(
							'type'     => 'boolean',
							'required' => false,
						),
						'dailySummaryEnabled' => array(
							'type'     => 'boolean',
							'required' => false,
						),
						'dailySummaryTime'    => self::clock(),
						'dailySummaryRecipients' => array(
							/*
							 * Free text rather than a list of addresses: the
							 * repository is what decides which lines are
							 * usable, so a typo costs the owner that one
							 * recipient rather than the whole save.
							 */
							'type'     => 'string',
							'required' => false,
						),
						'termsUrl'       => array(
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'esc_url_raw',
						),
						'privacyUrl'     => array(
							'type'              => 'string',
							'required'          => false,
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			)
		);

		/*
		 * Sending is its own route rather than a flag on the save. An owner
		 * wants to see the email before committing to a time, and a save that
		 * mails people as a side effect is a trap: every stray click on Save
		 * would put another message in someone's inbox.
		 */
		register_rest_route(
			self::NAMESPACE,
			'/' . self::ROUTE . '/daily-summary',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'send_summary' ),
				'permission_callback' => array( self::class, 'can_manage' ),
				'args'                => array(
					'date' => array(
						'type'              => 'string',
						'required'          => false,
						'validate_callback' => static fn( $value ): bool =>
							is_string( $value ) && 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', trim( $value ) ),
					),
				),
			)
		);
	}

	/**
	 * Send the summary for one day, now.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function send_summary( WP_REST_Request $request ) {
		$date = trim( (string) $request->get_param( 'date' ) );

		if ( '' === $date ) {
			$date = DailySummary::target_date();
		}

		$recipients = SettingsRepository::daily_summary_recipients();

		if ( ! $recipients ) {
			return new WP_Error(
				'booking_suite_no_recipients',
				__( 'Add at least one address for the summary to go to.', 'booking-suite' ),
				array(
					'status' => 400,
					'field'  => 'dailySummaryRecipients',
				)
			);
		}

		$sent = DailySummary::send( $date );

		/*
		 * Nothing sent is reported as a failure rather than as a quiet success.
		 * The two ways it happens — notifications switched off, or the template
		 * disabled — both look identical from the screen otherwise, and an
		 * owner who pressed the button and saw "done" would go on believing
		 * the schedule works.
		 */
		if ( 0 === $sent ) {
			return new WP_Error(
				'booking_suite_summary_not_sent',
				__( 'Nothing was sent. Check that email notifications are on and that the daily summary template is enabled.', 'booking-suite' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response(
			array(
				'sent'       => $sent,
				'date'       => $date,
				'recipients' => $recipients,
				'figures'    => DailySummary::figures( $date ),
			),
			200
		);
	}

	/**
	 * A whole number within bounds.
	 *
	 * @param int $min Smallest accepted.
	 * @param int $max Largest accepted.
	 * @return array<string, mixed> A REST argument definition.
	 */
	private static function whole( int $min, int $max ): array {
		return array(
			'type'              => 'integer',
			'required'          => false,
			'validate_callback' => static fn( $value ): bool =>
				is_numeric( $value ) && (int) $value >= $min && (int) $value <= $max,
		);
	}

	/**
	 * A percentage between 0 and 100, fractions allowed.
	 *
	 * @return array<string, mixed> A REST argument definition.
	 */
	private static function percent(): array {
		return array(
			'type'              => 'number',
			'required'          => false,
			'validate_callback' => static fn( $value ): bool =>
				is_numeric( $value ) && (float) $value >= 0 && (float) $value <= 100,
		);
	}

	/**
	 * A 24-hour wall-clock time, HH:MM.
	 *
	 * @return array<string, mixed> A REST argument definition.
	 */
	private static function clock(): array {
		return array(
			'type'              => 'string',
			'required'          => false,
			'validate_callback' => static fn( $value ): bool =>
				is_string( $value ) && 1 === preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', trim( $value ) ),
		);
	}

	public static function can_manage(): bool {
		return current_user_can( self::CAPABILITY );
	}

	/**
	 * The stored settings, with defaults filled in and unknown keys dropped.
	 *
	 * @return array<string, string>
	 */
	public static function all(): array {
		$currency = SettingsRepository::currency();

		// A value that is no longer offered falls back rather than sticking.
		return array(
			'currency'     => in_array( $currency, self::CURRENCIES, true )
				? $currency
				: 'EUR',
			'accentColour'   => SettingsRepository::accent_colour(),
			'invoiceLogo'    => (int) SettingsRepository::get( SettingsRepository::INVOICE_LOGO ),
			'invoiceSender'  => SettingsRepository::get( SettingsRepository::INVOICE_SENDER ),
			'invoicePrefix'  => SettingsRepository::get( SettingsRepository::INVOICE_PREFIX ),
			'invoiceDueDays' => (int) SettingsRepository::get( SettingsRepository::INVOICE_DUE_DAYS ),
			'invoiceThanks'  => SettingsRepository::get( SettingsRepository::INVOICE_THANKS ),
			'invoicePhone'   => SettingsRepository::get( SettingsRepository::INVOICE_PHONE ),
			'invoiceEmail'   => SettingsRepository::get( SettingsRepository::INVOICE_EMAIL ),
			'invoiceNotice'  => SettingsRepository::get( SettingsRepository::INVOICE_NOTICE ),
			'invoiceCounter' => (int) SettingsRepository::get( SettingsRepository::INVOICE_COUNTER ),
			'taxRate'        => (float) SettingsRepository::get( SettingsRepository::TAX_RATE ),
			'companyName'    => SettingsRepository::get( SettingsRepository::COMPANY_NAME ),
			'companyAddress' => SettingsRepository::get( SettingsRepository::COMPANY_ADDRESS ),
			'companyPhone'   => SettingsRepository::get( SettingsRepository::COMPANY_PHONE ),
			'companyEmail'   => SettingsRepository::get( SettingsRepository::COMPANY_EMAIL ),
			// The older invoice_logo, until a company logo is chosen.
			'companyLogo'    => SettingsRepository::logo_id(),
			'adminEmail'     => SettingsRepository::get( SettingsRepository::ADMIN_EMAIL ),
			'bankHolder'     => SettingsRepository::get( SettingsRepository::BANK_HOLDER ),
			'bankName'       => SettingsRepository::get( SettingsRepository::BANK_NAME ),
			'bankIban'       => SettingsRepository::get( SettingsRepository::BANK_IBAN ),
			'bankBic'        => SettingsRepository::get( SettingsRepository::BANK_BIC ),
			'bankDetails'    => SettingsRepository::get( SettingsRepository::BANK_DETAILS ),
			'minHours'       => (int) SettingsRepository::number( SettingsRepository::MIN_HOURS ),
			'maxHours'       => (int) SettingsRepository::number( SettingsRepository::MAX_HOURS ),
			'baseHours'      => (int) SettingsRepository::number( SettingsRepository::BASE_HOURS ),
			'includedGuests' => (int) SettingsRepository::number( SettingsRepository::INCLUDED_GUESTS ),
			'dayStart'       => SettingsRepository::get( SettingsRepository::DAY_START ),
			'dayEnd'         => SettingsRepository::get( SettingsRepository::DAY_END ),
			'slotStep'       => (int) SettingsRepository::number( SettingsRepository::SLOT_STEP ),
			'overnightStart' => SettingsRepository::get( SettingsRepository::OVERNIGHT_START ),
			'overnightEnd'   => SettingsRepository::get( SettingsRepository::OVERNIGHT_END ),
			'daytimeSlotDays'  => SettingsRepository::get( SettingsRepository::DAYTIME_SLOT_DAYS ),
			'daytimeSlotStart' => SettingsRepository::get( SettingsRepository::DAYTIME_SLOT_START ),
			'daytimeSlotEnd'   => SettingsRepository::get( SettingsRepository::DAYTIME_SLOT_END ),
			'reservationHours' => SettingsRepository::reservation_hours(),
			'taxRateOvernight' => (float) SettingsRepository::get( SettingsRepository::TAX_RATE_OVERNIGHT ),
			'taxRateHourly'    => (float) SettingsRepository::get( SettingsRepository::TAX_RATE_HOURLY ),
			'prepayDiscount'   => (float) SettingsRepository::get( SettingsRepository::PREPAY_DISCOUNT ),
			'emailNotifications' => SettingsRepository::emails_enabled(),
			'dailySummaryEnabled'    => SettingsRepository::daily_summary_enabled(),
			'dailySummaryTime'       => SettingsRepository::get( SettingsRepository::DAILY_SUMMARY_TIME ),
			'dailySummaryRecipients' => SettingsRepository::get( SettingsRepository::DAILY_SUMMARY_RECIPIENTS ),
			'termsUrl'       => SettingsRepository::get( SettingsRepository::TERMS_URL ),
			'privacyUrl'     => SettingsRepository::get( SettingsRepository::PRIVACY_URL ),
		);
	}

	/**
	 * The logo, ready for the Settings screen to show what is currently set.
	 *
	 * @return array<string, mixed>|null
	 */
	private static function logo(): ?array {
		$id = SettingsRepository::logo_id();

		if ( ! $id || 'attachment' !== get_post_type( $id ) ) {
			return null;
		}

		return array(
			'id'  => $id,
			'url' => (string) wp_get_attachment_image_url( $id, 'medium' ),
		);
	}

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( self::payload(), 200 );
	}

	public static function update( WP_REST_Request $request ) {
		/*
		 * One rule no single field can check for itself.
		 *
		 * A longest stay below the shortest one leaves a guest no length to
		 * pick — the generator quietly collapses the range to a single option
		 * — so the save is refused rather than half-applied. Checked before
		 * anything is written, because a loop that fails partway leaves the
		 * settings in a state nobody asked for.
		 */
		$min = $request->get_param( "minHours" );
		$max = $request->get_param( "maxHours" );

		if ( null !== $min && null !== $max && (int) $max < (int) $min ) {
			return new WP_Error(
				"booking_suite_invalid_field",
				__( "The longest stay cannot be shorter than the shortest one.", "booking-suite" ),
				array(
					"status" => 400,
					"field"  => "maxHours",
				)
			);
		}

		foreach ( self::KEYS as $key => $stored_key ) {
			$value = $request->get_param( $key );

			if ( null === $value ) {
				continue;
			}

			/*
			 * Booleans first: casting false to a string gives '', which reads
			 * back as "not set" and therefore as the default — so switching
			 * notifications off would silently leave them on.
			 */
			if ( is_bool( $value ) ) {
				SettingsRepository::set( $stored_key, $value ? '1' : '0' );

				continue;
			}

			/*
			 * Free-text fields keep their line breaks — an address is several
			 * lines and is printed line by line — so they take the textarea
			 * sanitiser rather than the single-line one.
			 */
			$value = in_array( $key, self::TEXT_KEYS, true )
				? sanitize_textarea_field( (string) $value )
				: (string) $value;

			SettingsRepository::set( $stored_key, $value );
		}

		/*
		 * The scheduled send is booked from admin_init, which a REST save
		 * never reaches — so without this the new time would not take effect
		 * until the next admin page load, and switching the summary off would
		 * leave one more email to arrive.
		 */
		DailySummary::schedule();

		self::purge_page_caches();

		return new WP_REST_Response( self::payload(), 200 );
	}

	/**
	 * Ask any page-caching plugin to drop its stored HTML.
	 *
	 * The accent colour is printed into the page as inline CSS, so a full-page
	 * cache keeps serving the old colour after it is changed — the setting saves
	 * correctly and the site looks untouched, which reads as a broken feature.
	 * Currency has the same problem wherever a price is cached.
	 *
	 * Each of these is the published way to clear that plugin's cache, and each
	 * is a no-op when the plugin is not installed.
	 */
	private static function purge_page_caches(): void {
		// LiteSpeed Cache.
		do_action( 'litespeed_purge_all' );

		// WP Super Cache.
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}

		// WP Rocket.
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}

		// W3 Total Cache.
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}

		// Cache Enabler.
		do_action( 'cache_enabler_clear_complete_cache' );
	}

	/**
	 * The values plus the choices behind them, so the screen never has to keep
	 * its own copy of the allowed options.
	 *
	 * @return array<string, mixed>
	 */
	private static function payload(): array {
		return array(
			'settings' => self::all(),
			'choices'  => array(
				'currencies' => self::CURRENCIES,
				// Sensible starting points; the field still takes any hex.
				'accents'    => self::ACCENT_PRESETS,
			),
			// The shades generated from the accent, so the screen can preview
			// exactly what the booking flow will use.
			'palette'  => SettingsRepository::accent_palette(),
			// So the screen can show the logo that is set without looking it up.
			'logo'     => self::logo(),
		);
	}
}
