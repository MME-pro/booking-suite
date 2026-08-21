<?php
/**
 * Booking Suite fields on the apartment edit screen.
 *
 * The same fields the React "Add Apartment" form writes, so an apartment can
 * be edited wherever the work happens to be — the Booking Suite screen or the
 * post editor where the Elementor layout is built.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\PostTypes;

use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\IcalFeedsRepository;
use BookingSuite\Backend\Schemas\ApartmentsTable;
use BookingSuite\Backend\Support\IcalFeed;
use BookingSuite\Backend\Support\IcalParser;

use const BookingSuite\PLUGIN_URL;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class ApartmentMetaBox {

	private const NONCE = 'bks_apartment_meta';

	private const MAX_LENGTH = 191;

	/** varchar(500) on the subscription's `url` column. */
	private const MAX_URL_LENGTH = 500;

	/**
	 * Where a rejected calendar link waits between the save and the redirect.
	 *
	 * A meta box has nowhere to answer back: save_post runs, WordPress
	 * redirects, and anything the save wanted to say is gone. So a link that
	 * could not be stored is parked here under the user who submitted it and
	 * read out as a notice on the screen they land on — silently dropping a
	 * pasted link would leave an operator believing a portal is connected when
	 * nothing is.
	 */
	private const NOTICE_KEY = 'bks_apartment_feed_notice_';

	/**
	 * The portals an apartment syncs with, in the order they are shown.
	 *
	 * Fixed rather than a list the operator builds. Both rows are always on
	 * the screen, whether or not they have a link yet, so the section reads as
	 * "here is where the Airbnb link goes" rather than as an empty list with
	 * an Add button and a portal to pick out of nine. Clearing a link removes
	 * that subscription; the row stays.
	 */
	private const PORTALS = array( 'airbnb', 'booking' );

	public static function register(): void {
		add_action( 'add_meta_boxes', array( self::class, 'add' ) );
		add_action( 'save_post_' . ApartmentPostType::POST_TYPE, array( self::class, 'save' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
		add_action( 'admin_notices', array( self::class, 'render_notice' ) );
	}

	public static function add(): void {
		add_meta_box(
			'bks-apartment-fields',
			__( 'Booking Suite', 'booking-suite' ),
			array( self::class, 'render' ),
			ApartmentPostType::POST_TYPE,
			'normal',
			'high'
		);
	}

	public static function enqueue( string $hook_suffix ): void {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		$screen = get_current_screen();

		if ( ! $screen || ApartmentPostType::POST_TYPE !== $screen->post_type ) {
			return;
		}

		wp_enqueue_media();

		wp_enqueue_style(
			'bks-apartment-meta',
			PLUGIN_URL . 'frontend/admin/assets/meta-box.css',
			array(),
			VERSION
		);

		wp_enqueue_script(
			'bks-apartment-meta',
			PLUGIN_URL . 'frontend/admin/assets/meta-box.js',
			array( 'jquery' ),
			VERSION,
			true
		);

		wp_localize_script(
			'bks-apartment-meta',
			'bksApartmentMeta',
			array(
				'frameTitle'  => __( 'Apartment photos', 'booking-suite' ),
				'frameButton' => __( 'Use these photos', 'booking-suite' ),
				'removeLabel' => __( 'Remove photo', 'booking-suite' ),
				'restRoot'    => esc_url_raw( rest_url( 'booking-suite/v1/ical/apartments/' ) ),
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'syncing'     => __( 'Reading…', 'booking-suite' ),
				'syncFailed'  => __( 'Could not read the calendars just now. Try again in a moment.', 'booking-suite' ),
				'syncEmpty'   => __( 'Nothing to read — no calendar link is saved yet.', 'booking-suite' ),
			)
		);
	}

	public static function render( \WP_Post $post ): void {
		$apartment = ApartmentsRepository::find( $post->ID ) ?? array();

		$capacity = (int) ( $apartment['capacity'] ?? 1 );
		$colour   = (string) ( $apartment['colour'] ?? ApartmentsTable::DEFAULT_COLOUR );
		$cleaning = (int) ( $apartment['cleaning_min'] ?? 30 );
		$internal = (string) ( $apartment['internal_short_link'] ?? '' );
		$booking  = (string) ( $apartment['booking_short_link'] ?? '' );
		$holiday  = (bool) ( $apartment['holiday_hesse'] ?? false );
		$active   = (bool) ( $apartment['active'] ?? true );
		$gallery  = array_map( 'absint', (array) ( $apartment['images'] ?? array() ) );
		$weekday  = (float) ( $apartment['weekday_rate'] ?? 0 );
		$weekend  = (float) ( $apartment['weekend_rate'] ?? 0 );

		wp_nonce_field( self::NONCE, self::NONCE );

		?>
		<div class="bks-meta">
			<p class="bks-meta__field bks-meta__field--wide">
				<label for="bks-name"><?php esc_html_e( 'Apartment name', 'booking-suite' ); ?></label>
				<input type="text" id="bks-name" name="bks_name" maxlength="<?php echo esc_attr( (string) self::MAX_LENGTH ); ?>" value="<?php echo esc_attr( $post->post_title ); ?>" />
				<span class="description">
					<?php esc_html_e( 'The same value as the post title — changing it here renames the apartment everywhere.', 'booking-suite' ); ?>
				</span>
			</p>

			<div class="bks-meta__grid">
				<p class="bks-meta__field">
					<label for="bks-capacity"><?php esc_html_e( 'Guests', 'booking-suite' ); ?></label>
					<input type="number" id="bks-capacity" name="bks_capacity" min="1" max="65535" value="<?php echo esc_attr( (string) $capacity ); ?>" />
				</p>

				<p class="bks-meta__field">
					<label for="bks-colour"><?php esc_html_e( 'Calendar colour', 'booking-suite' ); ?></label>
					<input type="color" id="bks-colour" name="bks_colour" value="<?php echo esc_attr( $colour ); ?>" />
				</p>

				<p class="bks-meta__field">
					<label for="bks-cleaning"><?php esc_html_e( 'Cleaning time', 'booking-suite' ); ?></label>
					<select id="bks-cleaning" name="bks_cleaning_min">
						<?php foreach ( ApartmentsTable::CLEANING_MINUTES as $minutes ) : ?>
							<option value="<?php echo esc_attr( (string) $minutes ); ?>" <?php selected( $cleaning, $minutes ); ?>>
								<?php
								printf(
									/* translators: %d: cleaning turnaround in minutes. */
									esc_html__( '%d minutes', 'booking-suite' ),
									(int) $minutes
								);
								?>
							</option>
						<?php endforeach; ?>
					</select>
				</p>

				<p class="bks-meta__field">
					<label for="bks-internal-link"><?php esc_html_e( 'Internal short link', 'booking-suite' ); ?></label>
					<input type="text" id="bks-internal-link" name="bks_internal_short_link" maxlength="<?php echo esc_attr( (string) self::MAX_LENGTH ); ?>" value="<?php echo esc_attr( $internal ); ?>" />
				</p>

				<p class="bks-meta__field">
					<label for="bks-booking-link"><?php esc_html_e( 'Booking short link', 'booking-suite' ); ?></label>
					<input type="text" id="bks-booking-link" name="bks_booking_short_link" maxlength="<?php echo esc_attr( (string) self::MAX_LENGTH ); ?>" value="<?php echo esc_attr( $booking ); ?>" />
				</p>
			</div>

			<div class="bks-meta__rates">
				<div class="bks-meta__grid bks-meta__grid--rates">
					<p class="bks-meta__field">
						<label for="bks-weekday-rate">
							<?php esc_html_e( 'Weekday rate (Sun–Thu)', 'booking-suite' ); ?>
						</label>
						<input type="number" id="bks-weekday-rate" name="bks_weekday_rate" min="0" step="0.01" value="<?php echo esc_attr( number_format( $weekday, 2, '.', '' ) ); ?>" />
					</p>

					<p class="bks-meta__field">
						<label for="bks-weekend-rate">
							<?php esc_html_e( 'Weekend rate (Fri/Sat)', 'booking-suite' ); ?>
						</label>
						<input type="number" id="bks-weekend-rate" name="bks_weekend_rate" min="0" step="0.01" value="<?php echo esc_attr( number_format( $weekend, 2, '.', '' ) ); ?>" />
					</p>
				</div>
			</div>

			<div class="bks-meta__toggles">
				<label>
					<input type="checkbox" name="bks_active" value="1" <?php checked( $active ); ?> />
					<?php esc_html_e( 'Active — guests can book this apartment', 'booking-suite' ); ?>
				</label>
				<label>
					<input type="checkbox" name="bks_holiday_hesse" value="1" <?php checked( $holiday ); ?> />
					<?php esc_html_e( 'Follow Hesse public holidays', 'booking-suite' ); ?>
				</label>
			</div>

			<?php self::render_calendar_sync( $post->ID ); ?>

			<div class="bks-meta__gallery" data-bks-gallery>
				<span class="bks-meta__label"><?php esc_html_e( 'Photo gallery', 'booking-suite' ); ?></span>

				<input type="hidden" name="bks_gallery" value="<?php echo esc_attr( implode( ',', $gallery ) ); ?>" data-bks-gallery-input />

				<ul class="bks-meta__thumbs" data-bks-gallery-list>
					<?php foreach ( $gallery as $attachment_id ) : ?>
						<?php $url = wp_get_attachment_image_url( $attachment_id, 'thumbnail' ); ?>
						<?php if ( $url ) : ?>
							<li data-id="<?php echo esc_attr( (string) $attachment_id ); ?>">
								<img src="<?php echo esc_url( $url ); ?>" alt="" />
								<button type="button" class="bks-meta__remove" aria-label="<?php esc_attr_e( 'Remove photo', 'booking-suite' ); ?>">&times;</button>
							</li>
						<?php endif; ?>
					<?php endforeach; ?>
				</ul>

				<button type="button" class="button" data-bks-gallery-add>
					<?php esc_html_e( 'Add photos', 'booking-suite' ); ?>
				</button>

				<p class="description">
					<?php esc_html_e( 'The first photo is also used as the featured image.', 'booking-suite' ); ?>
				</p>
			</div>
		</div>
		<?php
	}

	/**
	 * Calendar sync: the calendars this apartment reads, and the one it
	 * publishes.
	 *
	 * The same model the Booking Suite apartment form holds, because this box
	 * exists so an apartment can be set up wherever the work happens to be —
	 * and a channel connection made in one place and invisible in the other is
	 * how an apartment ends up double-booked.
	 */
	/**
	 * The shape of the link the operator is being asked for.
	 *
	 * A worked example beats a description of one: the portals' own URLs are
	 * distinctive enough that seeing the right shape is how you know you have
	 * copied the right thing out of the extranet.
	 *
	 * @param string $source The portal key.
	 * @return string A URL-shaped hint.
	 */
	/**
	 * Where in this portal's own admin the link is found.
	 *
	 * Each row now belongs to one portal, so it names that portal's route and
	 * nothing else — an operator filling in the Airbnb row should not have to
	 * read past Booking.com's instructions to find their own.
	 *
	 * @param string $source The portal key.
	 * @return string A route through that portal's extranet.
	 */
	private static function feed_hint( string $source ): string {
		$hints = array(
			'airbnb'  => __( 'Airbnb: Calendar → Availability → Connect calendars.', 'booking-suite' ),
			'booking' => __( 'Booking.com: Rates & Availability → Sync calendars.', 'booking-suite' ),
		);

		return $hints[ $source ] ?? __( 'Paste the calendar link this portal gave you.', 'booking-suite' );
	}

	private static function feed_placeholder( string $source ): string {
		$examples = array(
			'airbnb'  => 'https://www.airbnb.com/calendar/ical/12345.ics?s=…',
			'booking' => 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=…',
		);

		return $examples[ $source ] ?? 'https://…/calendar.ics';
	}

	/**
	 * The export links worth showing for this apartment.
	 *
	 * One per portal, matching the two subscription rows above, and shown
	 * whether or not that portal has a link yet. Each leaves out the dates its
	 * own portal gave us — a lock re-exported to its source can bounce between
	 * the two calendars, gaining a fresh UID on every lap, and neither side can
	 * tell the copies apart afterwards. A portal with nothing subscribed has
	 * given us nothing to leave out, so its link is simply everything we have.
	 *
	 * The all-channels and direct-only feeds still exist and still serve; they
	 * are not offered here because this screen is about the two portals.
	 *
	 * @param int    $post_id The apartment.
	 * @param string $token   Its published secret.
	 * @return array<int, array<string, mixed>> Rows from IcalFeed::exports().
	 */
	private static function offered_exports( int $post_id, string $token ): array {
		$by_scope = array();

		foreach ( IcalFeed::exports( $post_id, $token ) as $export ) {
			$by_scope[ $export['scope'] ] = $export;
		}

		$offered = array();

		foreach ( self::PORTALS as $source ) {
			if ( isset( $by_scope[ $source ] ) ) {
				$offered[] = $by_scope[ $source ];
			}
		}

		return $offered;
	}
	private static function render_calendar_sync( int $post_id ): void {
		$token = ApartmentsRepository::token( $post_id );

		// At most one subscription per portal is kept; a second row for the
		// same portal could only be two links fighting over the same locks.
		$by_source = array();

		foreach ( IcalFeedsRepository::for_apartment( $post_id ) as $feed ) {
			$source = (string) ( $feed['source'] ?? '' );

			if ( ! isset( $by_source[ $source ] ) ) {
				$by_source[ $source ] = $feed;
			}
		}

		?>
		<div class="bks-meta__sync">
			<span class="bks-meta__label"><?php esc_html_e( 'Calendar sync', 'booking-suite' ); ?></span>

			<div class="bks-meta__feeds" data-bks-feeds data-bks-apartment="<?php echo esc_attr( (string) $post_id ); ?>">
				<div class="bks-meta__feeds-head">
					<span class="bks-meta__sublabel"><?php esc_html_e( 'Subscriptions (import)', 'booking-suite' ); ?></span>

					<?php
					/*
					 * The schedule reads these every few minutes anyway; this
					 * is for the moment after a link is pasted, when waiting
					 * for the next run to find out whether it works is the
					 * difference between a setting that is finished and one
					 * that might be. It reads what is *saved*, so a link typed
					 * and not yet saved has nothing to pull.
					 */
					?>
					<button type="button" class="button button-small" data-bks-sync>
						<?php esc_html_e( 'Sync now', 'booking-suite' ); ?>
					</button>
				</div>

				<p class="description">
					<?php esc_html_e( 'Dates these portals have sold are blocked here, read automatically on a schedule.', 'booking-suite' ); ?>
				</p>

				<ul class="bks-meta__feed-list">
					<?php foreach ( self::PORTALS as $source ) : ?>
						<?php self::render_feed_row( $source, $by_source[ $source ] ?? array() ); ?>
					<?php endforeach; ?>
				</ul>
			</div>

			<div class="bks-meta__export">
				<span class="bks-meta__label"><?php esc_html_e( 'Export links (.ics)', 'booking-suite' ); ?></span>

				<?php if ( '' !== $token ) : ?>
					<p class="description">
						<?php esc_html_e( 'Give each to the portal it is named for. Each leaves out that portal’s own dates, and is readable by anyone holding it.', 'booking-suite' ); ?>
					</p>

					<ul class="bks-meta__export-list">
						<?php foreach ( self::offered_exports( $post_id, $token ) as $export ) : ?>
							<li class="bks-meta__export-row">
								<span class="bks-meta__export-name"><?php echo esc_html( $export['label'] ); ?></span>

								<input
									type="url"
									class="bks-meta__feed-url"
									readonly
									value="<?php echo esc_url( $export['url'] ); ?>"
									onfocus="this.select()"
									aria-label="
									<?php
									printf(
										/* translators: %s: which feed, e.g. "For Airbnb". */
										esc_attr__( 'Export link — %s', 'booking-suite' ),
										esc_attr( $export['label'] )
									);
									?>
									"
								/>

								<?php
								/*
								 * What the file carries beyond this site's own
								 * bookings. "Carries Booking.com" is the whole
								 * reason to hand this particular link to Airbnb,
								 * so it sits with the link rather than in the
								 * paragraph above.
								 */
								?>
								<p class="bks-meta__feed-note">
									<?php
									if ( $export['carries'] ) {
										printf(
											/* translators: %s: comma-separated portal names. */
											esc_html__( 'Direct bookings + %s', 'booking-suite' ),
											esc_html(
												implode(
													', ',
													array_map(
														static fn( string $source ): string => IcalParser::source_label( $source ),
														$export['carries']
													)
												)
											)
										);
									} else {
										esc_html_e( 'Direct bookings only', 'booking-suite' );
									}
									?>
								</p>
							</li>
						<?php endforeach; ?>
					</ul>
				<?php else : ?>
					<label>
						<input type="checkbox" name="bks_ical_publish" value="1" />
						<?php esc_html_e( 'Publish this apartment’s calendar when I save', 'booking-suite' ); ?>
					</label>
					<p class="description">
						<?php esc_html_e( 'Not published yet. Creating the links makes this apartment’s booked dates readable by anyone holding one — each says when the apartment is taken, never who by.', 'booking-suite' ); ?>
					</p>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * One portal's subscription row.
	 *
	 * The portal is the row rather than a field in it, so it is posted as a
	 * hidden value and the array is keyed by it. Keying on the portal instead
	 * of a counter also means a row cannot drift onto the wrong subscription
	 * between render and save.
	 *
	 * @param string               $source The portal key, e.g. 'airbnb'.
	 * @param array<string, mixed> $feed   Its subscription, or empty if it has
	 *                                     none yet.
	 */
	private static function render_feed_row( string $source, array $feed ): void {
		$name  = 'bks_ical[' . $source . ']';
		$label = IcalParser::source_label( $source );

		?>
		<li class="bks-meta__feed" data-bks-feed="<?php echo esc_attr( $source ); ?>">
			<input type="hidden" name="<?php echo esc_attr( $name ); ?>[id]" value="<?php echo esc_attr( (string) ( $feed['id'] ?? 0 ) ); ?>" />
			<input type="hidden" name="<?php echo esc_attr( $name ); ?>[source]" value="<?php echo esc_attr( $source ); ?>" />

			<span class="bks-meta__feed-portal"><?php echo esc_html( $label ); ?></span>

			<?php
			/*
			 * The field labels are the row's own heading and each field's
			 * placeholder. Spelling them out again above every input is what
			 * made two subscriptions fill a screen, and a screen-reader label
			 * carries the same information without taking a line.
			 */
			?>
			<input
				type="url"
				class="bks-meta__feed-url"
				name="<?php echo esc_attr( $name ); ?>[url]"
				maxlength="<?php echo esc_attr( (string) self::MAX_URL_LENGTH ); ?>"
				value="<?php echo esc_url( (string) ( $feed['url'] ?? '' ) ); ?>"
				placeholder="<?php echo esc_attr( self::feed_placeholder( $source ) ); ?>"
				aria-label="
				<?php
				printf(
					/* translators: %s: portal name, e.g. Airbnb. */
					esc_attr__( 'Calendar link — %s', 'booking-suite' ),
					esc_attr( $label )
				);
				?>
				"
				autocomplete="off"
				spellcheck="false"
			/>

			<?php
			/*
			 * Where the link is found, and how the last read went, on one
			 * quiet line. A subscription that has stopped working looks
			 * exactly like one that is fine — the link is still there, the
			 * dates simply stop arriving — so a failure carries the portal's
			 * own message rather than a tidied-up version of it.
			 */
			?>
			<p class="bks-meta__feed-note <?php echo IcalFeedsRepository::STATUS_ERROR === ( $feed['lastStatus'] ?? '' ) ? 'is-error' : ''; ?>">
				<?php
				if ( IcalFeedsRepository::STATUS_ERROR === ( $feed['lastStatus'] ?? '' ) ) {
					printf(
						/* translators: %s: the reason the last read failed. */
						esc_html__( 'Last read failed: %s', 'booking-suite' ),
						esc_html( (string) ( $feed['lastMessage'] ?: __( 'no reason given', 'booking-suite' ) ) )
					);
				} elseif ( ! empty( $feed['lastSyncAt'] ) ) {
					printf(
						/* translators: 1: number of dated entries read, 2: when it was read. */
						esc_html__( 'Last read %1$d entries on %2$s', 'booking-suite' ),
						(int) ( $feed['lastEventCount'] ?? 0 ),
						esc_html( (string) $feed['lastSyncAt'] )
					);
				} else {
					echo esc_html( self::feed_hint( $source ) );
				}
				?>
			</p>
		</li>
		<?php
	}

	/**
	 * The name field is the post title. It is written straight to the posts
	 * table rather than through wp_update_post(), because this runs inside
	 * save_post and would otherwise recurse.
	 */
	private static function save_name( int $post_id, \WP_Post $post ): void {
		global $wpdb;

		if ( ! isset( $_POST['bks_name'] ) ) {
			return;
		}

		$name = trim( sanitize_text_field( wp_unslash( (string) $_POST['bks_name'] ) ) );
		$name = mb_substr( $name, 0, self::MAX_LENGTH );

		// An empty name would leave the apartment untitled; keep the old one.
		if ( '' === $name || $name === $post->post_title ) {
			return;
		}

		$wpdb->update(
			$wpdb->posts,
			array( 'post_title' => $name ),
			array( 'ID' => $post_id ),
			array( '%s' ),
			array( '%d' )
		);

		clean_post_cache( $post_id );
	}

	/**
	 * A submitted rate, never negative. Accepts a comma as the decimal mark,
	 * since a German keyboard will produce one.
	 */
	private static function rate( string $key ): float {
		if ( ! isset( $_POST[ $key ] ) ) {
			return 0.0;
		}

		$raw = str_replace( ',', '.', sanitize_text_field( wp_unslash( (string) $_POST[ $key ] ) ) );

		return max( 0, round( (float) $raw, 2 ) );
	}

	public static function save( int $post_id, \WP_Post $post ): void {
		if ( ! isset( $_POST[ self::NONCE ] ) ) {
			return;
		}

		$nonce = sanitize_text_field( wp_unslash( (string) $_POST[ self::NONCE ] ) );

		if ( ! wp_verify_nonce( $nonce, self::NONCE ) ) {
			return;
		}

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		self::save_name( $post_id, $post );

		$capacity = isset( $_POST['bks_capacity'] ) ? absint( wp_unslash( $_POST['bks_capacity'] ) ) : 1;

		$colour = isset( $_POST['bks_colour'] )
			? sanitize_hex_color( sanitize_text_field( wp_unslash( (string) $_POST['bks_colour'] ) ) )
			: null;

		$cleaning = isset( $_POST['bks_cleaning_min'] ) ? absint( wp_unslash( $_POST['bks_cleaning_min'] ) ) : 30;

		$links = array();

		foreach ( array( 'internal_short_link', 'booking_short_link' ) as $field ) {
			$value = isset( $_POST[ 'bks_' . $field ] )
				? sanitize_title( wp_unslash( (string) $_POST[ 'bks_' . $field ] ) )
				: '';

			$links[ $field ] = mb_substr( $value, 0, self::MAX_LENGTH );
		}

		$gallery = isset( $_POST['bks_gallery'] )
			? sanitize_text_field( wp_unslash( (string) $_POST['bks_gallery'] ) )
			: '';

		$images = array_values(
			array_filter(
				array_map( 'absint', array_filter( explode( ',', $gallery ) ) )
			)
		);

		ApartmentsRepository::update(
			$post_id,
			array(
				'capacity'            => max( 1, min( 65535, $capacity ) ),
				'colour'              => $colour ?: ApartmentsTable::DEFAULT_COLOUR,
				'cleaning_min'        => in_array( $cleaning, ApartmentsTable::CLEANING_MINUTES, true ) ? $cleaning : 30,
				'weekday_rate'       => self::rate( 'bks_weekday_rate' ),
				'weekend_rate'       => self::rate( 'bks_weekend_rate' ),
				'internal_short_link' => $links['internal_short_link'],
				'booking_short_link'  => $links['booking_short_link'],
				'active'              => isset( $_POST['bks_active'] ),
				'holiday_hesse'       => isset( $_POST['bks_holiday_hesse'] ),
				'images'              => $images,
			)
		);

		self::save_feeds( $post_id );
		self::maybe_publish_calendar( $post_id );
	}

	/**
	 * Make this apartment's subscriptions match the rows that were posted.
	 *
	 * The box owns the whole list, so this reconciles rather than edits: rows
	 * carrying an id are updated, rows without one are added, and anything the
	 * form no longer lists is removed.
	 *
	 * Absent input means absent, not empty. A save that never rendered this box
	 * — a quick edit from the posts list, a status change, anything programmatic
	 * — must not read "no rows posted" as "unsubscribe everything".
	 */
	private static function save_feeds( int $post_id ): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- save() verified it.
		if ( ! isset( $_POST['bks_ical'] ) || ! is_array( $_POST['bks_ical'] ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitised per field below.
		$posted = wp_unslash( $_POST['bks_ical'] );

		$existing = array();

		foreach ( IcalFeedsRepository::for_apartment( $post_id ) as $feed ) {
			$existing[ (int) $feed['id'] ] = $feed;
		}

		$kept    = array();
		$seen    = array();
		$skipped = 0;

		foreach ( (array) $posted as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$url = self::feed_url( (string) ( $row['url'] ?? '' ) );

			// An empty row is one that was added and left alone; it is dropped
			// rather than counted as a failure.
			if ( '' === trim( (string) ( $row['url'] ?? '' ) ) ) {
				continue;
			}

			/*
			 * Anything else that will not stand up is dropped too, but counted:
			 * the operator pasted something, and being told it did not take is
			 * the whole point of the notice this feeds.
			 */
			if ( '' === $url || isset( $seen[ strtolower( $url ) ] ) ) {
				++$skipped;

				continue;
			}

			$seen[ strtolower( $url ) ] = true;

			$source = sanitize_key( (string) ( $row['source'] ?? '' ) );

			if ( ! in_array( $source, IcalParser::SOURCES, true ) ) {
				$source = IcalParser::detect_source( $url );
			}

			/*
			 * The row carries a link and nothing else now. The name is kept as
			 * a column because other screens read it, but it is the portal's
			 * own label rather than something to be typed; and a subscription
			 * always syncs — one that should not is one whose link should be
			 * cleared instead.
			 */
			$values = array(
				'name'   => IcalParser::source_label( $source ),
				'url'    => $url,
				'source' => $source,
				'active' => true,
			);

			$id = absint( $row['id'] ?? 0 );

			// An id is only honoured if it is one of this apartment's own.
			if ( $id && isset( $existing[ $id ] ) ) {
				IcalFeedsRepository::update( $id, $values );

				$kept[ $id ] = true;

				continue;
			}

			IcalFeedsRepository::create(
				array_merge( array( 'room_id' => $post_id ), $values )
			);
		}

		/*
		 * Removed rows unsubscribe, but the locks they already brought in stay.
		 * Dates a portal has sold are still sold after the subscription goes,
		 * and dropping them here would silently put a booked apartment back on
		 * sale. Releasing them is a separate, deliberate act.
		 */
		foreach ( array_keys( $existing ) as $id ) {
			if ( ! isset( $kept[ $id ] ) ) {
				IcalFeedsRepository::delete( (int) $id );
			}
		}

		if ( $skipped ) {
			set_transient( self::NOTICE_KEY . get_current_user_id(), $skipped, MINUTE_IN_SECONDS );
		}
	}

	/**
	 * A pasted calendar link, in the shape the subscriptions table stores.
	 *
	 * Portals hand out webcal:// as often as https://; the two are the same
	 * address with a different scheme, and normalising here means a link saved
	 * from this box and the same link saved from the React form are one
	 * subscription rather than two.
	 *
	 * @return string The stored form, or '' when it is not a usable address.
	 */
	private static function feed_url( string $raw ): string {
		$url = trim( $raw );

		if ( str_starts_with( strtolower( $url ), 'webcal://' ) ) {
			$url = 'https://' . substr( $url, 9 );
		}

		$url = esc_url_raw( $url );

		if ( ! wp_http_validate_url( $url ) ) {
			return '';
		}

		return mb_substr( $url, 0, self::MAX_URL_LENGTH );
	}

	/**
	 * Publish this apartment's calendar, if the operator asked for it.
	 *
	 * Only ever mints; it never replaces an existing token. Handing a portal a
	 * link and then quietly changing it is how a connection breaks with nothing
	 * to show for it, so replacing one is deliberate and lives on the Calendar
	 * Sync screen behind its own confirmation.
	 */
	private static function maybe_publish_calendar( int $post_id ): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- save() verified it.
		if ( ! isset( $_POST['bks_ical_publish'] ) ) {
			return;
		}

		ApartmentsRepository::ensure_token( $post_id );
	}

	/**
	 * Say so when a pasted calendar link did not survive the save.
	 */
	public static function render_notice(): void {
		$key     = self::NOTICE_KEY . get_current_user_id();
		$skipped = get_transient( $key );

		if ( false === $skipped ) {
			return;
		}

		delete_transient( $key );

		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: %d: number of calendar links that were not saved. */
					_n(
						'%d calendar link was not saved — it is not a usable address, or the same calendar was listed twice.',
						'%d calendar links were not saved — they are not usable addresses, or the same calendar was listed twice.',
						(int) $skipped,
						'booking-suite'
					),
					(int) $skipped
				)
			)
		);
	}
}
