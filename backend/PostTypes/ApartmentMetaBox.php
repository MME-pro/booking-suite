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
use BookingSuite\Backend\Schemas\ApartmentsTable;

use const BookingSuite\PLUGIN_URL;
use const BookingSuite\VERSION;

defined( 'ABSPATH' ) || exit;

final class ApartmentMetaBox {

	private const NONCE = 'bks_apartment_meta';

	private const MAX_LENGTH = 191;

	public static function register(): void {
		add_action( 'add_meta_boxes', array( self::class, 'add' ) );
		add_action( 'save_post_' . ApartmentPostType::POST_TYPE, array( self::class, 'save' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( self::class, 'enqueue' ) );
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
	}
}
