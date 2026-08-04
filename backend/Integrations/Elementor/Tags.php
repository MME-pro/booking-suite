<?php
/**
 * Elementor dynamic tags for apartment fields.
 *
 * These classes extend Elementor's base class, so this file is required only
 * from inside the elementor/dynamic_tags/register hook — never autoloaded —
 * and nothing here runs when Elementor is not installed.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Integrations\Elementor;

use BookingSuite\Backend\PostTypes\ApartmentPostType;
use BookingSuite\Backend\Repositories\ApartmentsRepository;
use BookingSuite\Backend\Repositories\PriceRulesRepository;
use Elementor\Core\DynamicTags\Tag;
use Elementor\Modules\DynamicTags\Module;

defined( 'ABSPATH' ) || exit;

/**
 * Shared behaviour: resolve the apartment being rendered.
 */
abstract class ApartmentTag extends Tag {

	public const GROUP = 'booking-suite';

	public function get_group() {
		return self::GROUP;
	}

	public function get_categories() {
		return array( Module::TEXT_CATEGORY );
	}

	/**
	 * The apartment currently being rendered, or null on any other post type.
	 *
	 * @return array<string, mixed>|null
	 */
	protected function apartment(): ?array {
		$id = get_the_ID();

		if ( ! $id || ApartmentPostType::POST_TYPE !== get_post_type( $id ) ) {
			return null;
		}

		return ApartmentsRepository::find( (int) $id );
	}

	public function render(): void {
		$value = $this->value();

		if ( '' === $value ) {
			return;
		}

		echo wp_kses_post( $value );
	}

	abstract protected function value(): string;
}

/**
 * The apartment's name — the post title, which is the same value the meta box
 * and the Booking Suite screen write.
 */
final class NameTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-name';
	}

	public function get_title() {
		return __( 'Apartment: Name', 'booking-suite' );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		return $apartment ? (string) $apartment['name'] : '';
	}
}

/**
 * The apartment's description — the post content, unformatted.
 */
final class DescriptionTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-description';
	}

	public function get_title() {
		return __( 'Apartment: Description', 'booking-suite' );
	}

	public function get_categories() {
		return array( Module::TEXT_CATEGORY );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		return $apartment ? wp_kses_post( (string) $apartment['description'] ) : '';
	}
}

final class GuestsTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-guests';
	}

	public function get_title() {
		return __( 'Apartment: Guests', 'booking-suite' );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		return $apartment ? (string) $apartment['capacity'] : '';
	}
}

final class CleaningTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-cleaning';
	}

	public function get_title() {
		return __( 'Apartment: Cleaning time', 'booking-suite' );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		if ( ! $apartment ) {
			return '';
		}

		return sprintf(
			/* translators: %d: cleaning turnaround in minutes. */
			__( '%d minutes', 'booking-suite' ),
			(int) $apartment['cleaning_min']
		);
	}
}

final class ColourTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-colour';
	}

	public function get_title() {
		return __( 'Apartment: Colour', 'booking-suite' );
	}

	public function get_categories() {
		return array( Module::COLOR_CATEGORY, Module::TEXT_CATEGORY );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		return $apartment ? (string) $apartment['colour'] : '';
	}
}

final class PriceFromTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-price-from';
	}

	public function get_title() {
		return __( 'Apartment: Price from', 'booking-suite' );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		if ( ! $apartment ) {
			return '';
		}

		$prices = PriceRulesRepository::lowest_public_price( array( (int) $apartment['id'] ) );
		$price  = $prices[ (int) $apartment['id' ] ] ?? null;

		if ( null === $price ) {
			return __( 'Price on request', 'booking-suite' );
		}

		return number_format_i18n( $price, 2 ) . ' €';
	}
}

final class BookingLinkTag extends ApartmentTag {

	public function get_name() {
		return 'bks-apartment-booking-link';
	}

	public function get_title() {
		return __( 'Apartment: Booking link', 'booking-suite' );
	}

	public function get_categories() {
		return array( Module::URL_CATEGORY );
	}

	protected function value(): string {
		$apartment = $this->apartment();

		if ( ! $apartment ) {
			return '';
		}

		$short = (string) $apartment['booking_short_link'];

		return '' !== $short
			? home_url( '/' . ltrim( $short, '/' ) )
			: (string) $apartment['permalink'];
	}
}
