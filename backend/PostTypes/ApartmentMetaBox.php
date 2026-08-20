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
	private static function render_calendar_sync( int $post_id ): void {
		$feeds = IcalFeedsRepository::for_apartment( $post_id );
		$token = ApartmentsRepository::token( $post_id );

		?>
		<div class="bks-meta__sync">
			<span class="bks-meta__label"><?php esc_html_e( 'Calendar sync', 'booking-suite' ); ?></span>

			<div class="bks-meta__feeds" data-bks-feeds>
				<span class="bks-meta__sublabel"><?php esc_html_e( 'Subscriptions (import)', 'booking-suite' ); ?></span>

				<p class="description">
					<?php esc_html_e( 'Dates these calendars have sold are pulled in and blocked here, so the apartment cannot be booked twice. Read automatically on a schedule; nothing is sent back to the portal.', 'booking-suite' ); ?>
				</p>

				<ul class="bks-meta__feed-list" data-bks-feed-list>
					<?php foreach ( $feeds as $index => $feed ) : ?>
						<?php self::render_feed_row( (string) $index, $feed ); ?>
					<?php endforeach; ?>
				</ul>

				<?php if ( ! $feeds ) : ?>
					<p class="bks-meta__feed-empty" data-bks-feed-empty>
						<?php esc_html_e( 'No calendars subscribed. Add one to block the dates another portal has already sold.', 'booking-suite' ); ?>
					</p>
				<?php endif; ?>

				<button type="button" class="button" data-bks-feed-add>
					<?php esc_html_e( 'Add subscription', 'booking-suite' ); ?>
				</button>

				<?php
				/*
				 * The blank row lives in a <template>, so the browser parses it
				 * but never submits it and never renders it. Cloning markup the
				 * server wrote keeps one definition of a row instead of a PHP
				 * one and a JavaScript one that drift apart.
				 */
				?>
				<template data-bks-feed-template>
					<?php self::render_feed_row( '__INDEX__', array() ); ?>
				</template>
			</div>

			<div class="bks-meta__export">
				<span class="bks-meta__label"><?php esc_html_e( 'Export link (.ics)', 'booking-suite' ); ?></span>

				<?php if ( '' !== $token ) : ?>
					<input
						type="url"
						class="bks-meta__feed-url"
						readonly
						value="<?php echo esc_url( IcalFeed::url_from_token( $token ) ); ?>"
						onfocus="this.select()"
						aria-label="<?php esc_attr_e( 'Export link for this apartment', 'booking-suite' ); ?>"
					/>
					<p class="description">
						<?php esc_html_e( 'Give this to Airbnb or Booking.com and they will block the dates this site has taken. Treat it as private; it can be replaced on the Calendar sync screen if it gets out.', 'booking-suite' ); ?>
					</p>
				<?php else : ?>
					<label>
						<input type="checkbox" name="bks_ical_publish" value="1" />
						<?php esc_html_e( 'Publish this apartment’s calendar when I save', 'booking-suite' ); ?>
					</label>
					<p class="description">
						<?php esc_html_e( 'Not published yet. Creating the link makes this apartment’s booked dates readable by anyone holding it — it says when the apartment is taken, never who by.', 'booking-suite' ); ?>
					</p>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * One subscription row.
	 *
	 * @param string               $index Position in the posted array, or the
	 *                                    placeholder the template is cloned with.
	 * @param array<string, mixed> $feed  The stored subscription, or empty for a
	 *                                    blank row.
	 */
	private static function render_feed_row( string $index, array $feed ): void {
		$name   = 'bks_ical[' . $index . ']';
		$source = (string) ( $feed['source'] ?? 'airbnb' );

		?>
		<li class="bks-meta__feed" data-bks-feed>
			<input type="hidden" name="<?php echo esc_attr( $name ); ?>[id]" value="<?php echo esc_attr( (string) ( $feed['id'] ?? 0 ) ); ?>" />

			<div class="bks-meta__feed-head">
				<p class="bks-meta__field">
					<label><?php esc_html_e( 'Portal', 'booking-suite' ); ?></label>
					<select name="<?php echo esc_attr( $name ); ?>[source]">
						<?php foreach ( IcalParser::source_options() as $option ) : ?>
							<option value="<?php echo esc_attr( $option['value'] ); ?>" <?php selected( $source, $option['value'] ); ?>>
								<?php echo esc_html( $option['label'] ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</p>

				<button type="button" class="button-link bks-meta__feed-remove" data-bks-feed-remove>
					<?php esc_html_e( 'Remove', 'booking-suite' ); ?>
				</button>
			</div>

			<p class="bks-meta__field">
				<label><?php esc_html_e( 'Calendar link', 'booking-suite' ); ?></label>
				<input
					type="url"
					class="bks-meta__feed-url"
					name="<?php echo esc_attr( $name ); ?>[url]"
					maxlength="<?php echo esc_attr( (string) self::MAX_URL_LENGTH ); ?>"
					value="<?php echo esc_url( (string) ( $feed['url'] ?? '' ) ); ?>"
					placeholder="https://www.airbnb.com/calendar/ical/…"
					autocomplete="off"
					spellcheck="false"
				/>
				<span class="description">
					<?php esc_html_e( 'Airbnb: Calendar → Availability → Connect calendars. Booking.com: Rates & Availability → Sync calendars.', 'booking-suite' ); ?>
				</span>
			</p>

			<div class="bks-meta__feed-foot">
				<p class="bks-meta__field">
					<label><?php esc_html_e( 'Label (optional)', 'booking-suite' ); ?></label>
					<input
						type="text"
						name="<?php echo esc_attr( $name ); ?>[name]"
						maxlength="<?php echo esc_attr( (string) self::MAX_LENGTH ); ?>"
						value="<?php echo esc_attr( (string) ( $feed['name'] ?? '' ) ); ?>"
					/>
				</p>

				<label class="bks-meta__feed-active">
					<input type="checkbox" name="<?php echo esc_attr( $name ); ?>[active]" value="1" <?php checked( (bool) ( $feed['active'] ?? true ) ); ?> />
					<?php esc_html_e( 'Sync automatically', 'booking-suite' ); ?>
				</label>
			</div>

			<?php
			/*
			 * A subscription that has quietly stopped working looks exactly like
			 * one that is fine — the link is still there, the dates simply stop
			 * arriving. This line is the only thing that tells them apart, so a
			 * failure carries the portal's own message rather than a tidied-up
			 * version of it.
			 */
			?>
			<?php if ( ! empty( $feed['lastSyncAt'] ) ) : ?>
				<p class="bks-meta__feed-status <?php echo IcalFeedsRepository::STATUS_ERROR === ( $feed['lastStatus'] ?? '' ) ? 'is-error' : ''; ?>">
					<?php
					if ( IcalFeedsRepository::STATUS_ERROR === ( $feed['lastStatus'] ?? '' ) ) {
						printf(
							/* translators: %s: the reason the last read failed. */
							esc_html__( 'Last read failed: %s', 'booking-suite' ),
							esc_html( (string) ( $feed['lastMessage'] ?: __( 'no reason given', 'booking-suite' ) ) )
						);
					} else {
						printf(
							/* translators: 1: number of dated entries read, 2: when it was read. */
							esc_html__( 'Last read %1$d entries on %2$s', 'booking-suite' ),
							(int) ( $feed['lastEventCount'] ?? 0 ),
							esc_html( (string) $feed['lastSyncAt'] )
						);
					}
					?>
				</p>
			<?php endif; ?>
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

			$name = trim( sanitize_text_field( (string) ( $row['name'] ?? '' ) ) );

			$values = array(
				'name'   => '' === $name
					? IcalParser::source_label( $source )
					: mb_substr( $name, 0, self::MAX_LENGTH ),
				'url'    => $url,
				'source' => $source,
				'active' => ! empty( $row['active'] ),
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
		 * sale. Releasing them is offered on the Calendar Sync screen, where it
		 * can be asked about.
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
