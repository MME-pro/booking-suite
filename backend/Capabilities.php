<?php
/**
 * Who may do what.
 *
 * One role held everything until now: `manage_options`, which is WordPress's
 * "you own this site" capability. That works for an owner running the place
 * alone and fails the moment anyone else needs a screen, because the only way
 * to give someone the bookings list was to give them the whole installation.
 *
 * Three roles, in widening circles:
 *
 *   Employee     the desk. Takes bookings, settles payments, works the diary.
 *   Admin        the client who runs the business. The desk, plus the books.
 *   Super admin  us. Everything, plus how this installation itself is doing.
 *
 * The whole map lives here rather than being spread across the controllers, so
 * deciding whether a new screen is desk work or the client's business is a
 * matter of asking the same question in the same place rather than inventing a
 * rule each time.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend;

defined( 'ABSPATH' ) || exit;

final class Capabilities {

	public const SUPER_ADMIN = 'bks_super_admin';
	public const ADMIN       = 'bks_admin';
	public const EMPLOYEE    = 'bks_staff';

	/**
	 * Bumped whenever the map below changes.
	 *
	 * Roles are written to the database once and then left alone, so a
	 * capability added in a later release would never reach a site that was
	 * already running. This is what tells install() there is work to do.
	 */
	private const VERSION = 1;

	private const VERSION_OPTION = 'bksuite_caps_version';

	/* ---------------------------------------------------------------------
	 * The three money lines.
	 *
	 * Money is not one question, and answering it as though it were produces a
	 * role that is either useless or leaky. It is three:
	 *
	 *   VIEW_AMOUNTS    "what does this guest owe?" — desk work. Without it
	 *                   nobody can take a booking, because they cannot see
	 *                   what to charge.
	 *   VIEW_FINANCIALS "the books" — totals across bookings, reports, rates,
	 *                   exports. The client's business, not the desk's.
	 *   VIEW_STATS      "how is this installation doing?" — the summary cards
	 *                   above a working table. Ours, not the client's.
	 *
	 * The last two look alike and are not. An Admin still sees and works every
	 * payment row; they are simply not handed the figure totalled across the
	 * top of it. That split is what lets the client have full operational
	 * access without the installation-level read.
	 * ------------------------------------------------------------------ */

	public const VIEW_AMOUNTS    = 'bks_view_booking_amounts';
	public const VIEW_FINANCIALS = 'bks_view_financials';
	public const VIEW_STATS      = 'bks_view_stats';

	public const VIEW_BOOKINGS      = 'bks_view_bookings';
	public const MANAGE_BOOKINGS    = 'bks_manage_bookings';
	public const VIEW_PAST_BOOKINGS = 'bks_view_past_bookings';
	public const VIEW_PAYMENTS      = 'bks_view_payments';
	public const MANAGE_PAYMENTS    = 'bks_manage_payments';
	public const VIEW_CALENDAR      = 'bks_view_calendar';
	public const VIEW_CUSTOMERS     = 'bks_view_customers';
	public const MANAGE_CUSTOMERS   = 'bks_manage_customers';
	public const MANAGE_APARTMENTS  = 'bks_manage_apartments';
	public const VIEW_EXTRAS        = 'bks_view_extras';
	public const MANAGE_EXTRAS      = 'bks_manage_extras';
	public const VIEW_REPORTS       = 'bks_view_reports';
	public const MANAGE_SETTINGS    = 'bks_manage_settings';
	public const EXPORT_DATA        = 'bks_export_data';

	/**
	 * The desk.
	 *
	 * @return string[]
	 */
	public static function employee_caps(): array {
		return array(
			'read',
			self::VIEW_BOOKINGS,
			self::MANAGE_BOOKINGS,
			self::VIEW_AMOUNTS,
			self::VIEW_PAYMENTS,
			self::MANAGE_PAYMENTS,
			self::VIEW_CALENDAR,
			self::VIEW_CUSTOMERS,
			self::MANAGE_CUSTOMERS,
			self::MANAGE_APARTMENTS,
			self::VIEW_EXTRAS,
			self::MANAGE_EXTRAS,
		);
	}

	/**
	 * The desk, plus the books.
	 *
	 * @return string[]
	 */
	public static function admin_caps(): array {
		return array_merge(
			self::employee_caps(),
			array(
				self::VIEW_FINANCIALS,
				self::VIEW_PAST_BOOKINGS,
				self::VIEW_REPORTS,
				self::MANAGE_SETTINGS,
				self::EXPORT_DATA,
			)
		);
	}

	/**
	 * Everything.
	 *
	 * @return string[]
	 */
	public static function super_admin_caps(): array {
		return array_merge( self::admin_caps(), array( self::VIEW_STATS ) );
	}

	/**
	 * Every capability this plugin owns.
	 *
	 * What deactivation removes, which is why `read` must never appear in it.
	 *
	 * @return string[]
	 */
	public static function all_caps(): array {
		return array_values(
			array_diff( self::super_admin_caps(), self::denied_to_wp_admin() )
		);
	}

	/**
	 * Capabilities that belong to WordPress and are only borrowed here.
	 *
	 * `read` is WordPress's own. Granting it to the administrator role and then
	 * removing it on deactivation would take away something this plugin never
	 * gave, so it is excluded from both ends.
	 *
	 * @return string[]
	 */
	private static function denied_to_wp_admin(): array {
		return array( 'read' );
	}

	/**
	 * What a WordPress administrator gets.
	 *
	 * Everything an Admin has, minus `read`, which they already have.
	 *
	 * A site owner who is a WordPress administrator should be able to work the
	 * plugin without also being given a plugin role by hand. Note what they do
	 * not get: VIEW_STATS. A Super Admin is a deliberate grant, not "whoever
	 * happens to administer this WordPress" — on a client site the client
	 * usually is one, which would defeat the point of having the level at all.
	 *
	 * @return string[]
	 */
	public static function wp_admin_caps(): array {
		return array_values(
			array_diff( self::admin_caps(), self::denied_to_wp_admin() )
		);
	}

	/**
	 * What the current user may do, as plain yes/no answers.
	 *
	 * Handed to the admin screens so they can stop drawing controls the server
	 * will refuse. Deliberately the answers and not the questions: it carries
	 * no capability names to be edited into something else, and nothing reads
	 * it as permission — every route asks WordPress again.
	 *
	 * @return array<string, bool>
	 */
	public static function current_user_map(): array {
		$map = array();

		foreach ( self::super_admin_caps() as $cap ) {
			if ( 'read' === $cap ) {
				continue;
			}

			// bks_view_financials -> viewFinancials, so the screens read as
			// JavaScript rather than as a translated PHP constant.
			$name = lcfirst( str_replace( ' ', '', ucwords( str_replace( '_', ' ', substr( $cap, 4 ) ) ) ) );

			$map[ $name ] = current_user_can( $cap );
		}

		return $map;
	}

	/**
	 * @return array<string, array{label: string, caps: string[]}>
	 */
	private static function roles(): array {
		return array(
			self::SUPER_ADMIN => array(
				'label' => __( 'Booking Super Admin', 'booking-suite' ),
				'caps'  => self::super_admin_caps(),
			),
			self::ADMIN       => array(
				'label' => __( 'Booking Admin', 'booking-suite' ),
				'caps'  => self::admin_caps(),
			),
			self::EMPLOYEE    => array(
				'label' => __( 'Booking Employee', 'booking-suite' ),
				'caps'  => self::employee_caps(),
			),
		);
	}

	public static function register(): void {
		/*
		 * On every admin load, not on activation alone.
		 *
		 * Activation runs once. A capability added in a later release would
		 * otherwise reach only the sites that happened to deactivate and
		 * reactivate, which is nobody. The version check below keeps the cost
		 * to one option read on the loads where nothing has changed.
		 */
		add_action( 'admin_init', array( self::class, 'maybe_install' ) );
	}

	public static function maybe_install(): void {
		if ( (int) get_option( self::VERSION_OPTION, 0 ) === self::VERSION ) {
			return;
		}

		self::install();
	}

	/**
	 * Write the roles and their capabilities. Idempotent.
	 */
	public static function install(): void {
		foreach ( self::roles() as $slug => $role ) {
			// remove_role() first so a capability dropped from the map above is
			// dropped from the site too; add_role() alone only ever adds.
			remove_role( $slug );

			add_role(
				$slug,
				$role['label'],
				array_fill_keys( $role['caps'], true )
			);
		}

		$administrator = get_role( 'administrator' );

		if ( $administrator ) {
			foreach ( self::wp_admin_caps() as $cap ) {
				$administrator->add_cap( $cap );
			}
		}

		update_option( self::VERSION_OPTION, self::VERSION, false );
	}

	/**
	 * Take the plugin's capabilities back off the site.
	 *
	 * Roles go entirely. The administrator keeps everything WordPress gave it
	 * and loses only what this plugin added — which is what all_caps() is for.
	 *
	 * Users are walked as well as roles. A capability written onto a user
	 * record outranks the role it came from, so removing it from the role
	 * alone changes nothing for anyone who has one.
	 */
	public static function uninstall(): void {
		foreach ( array_keys( self::roles() ) as $slug ) {
			remove_role( $slug );
		}

		$administrator = get_role( 'administrator' );

		if ( $administrator ) {
			foreach ( self::all_caps() as $cap ) {
				$administrator->remove_cap( $cap );
			}
		}

		self::revoke_from_users();

		delete_option( self::VERSION_OPTION );
	}

	/**
	 * Strip plugin capabilities written directly onto user records.
	 *
	 * @param string[]|null $caps Which to strip; all of them when null.
	 */
	public static function revoke_from_users( ?array $caps = null ): void {
		$caps = $caps ?? self::all_caps();

		foreach ( get_users( array( 'fields' => 'ID' ) ) as $user_id ) {
			$user = get_userdata( (int) $user_id );

			if ( ! $user ) {
				continue;
			}

			foreach ( $caps as $cap ) {
				// Only where it is on the user itself. Asking a role for a
				// capability it does not have is harmless; writing to every
				// user on the site on every call is not.
				if ( isset( $user->caps[ $cap ] ) ) {
					$user->remove_cap( $cap );
				}
			}
		}
	}
}
