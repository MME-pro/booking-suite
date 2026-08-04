<?php
/**
 * Stores the payment receipt a guest uploads with their booking.
 *
 * The file arrives as a data URL from an unauthenticated visitor, so it is
 * treated as hostile: the type must be on the allow-list, the size is capped,
 * and the extension is decided here from the declared type rather than taken
 * from anything the browser sent.
 *
 * @package BookingSuite
 */

declare( strict_types=1 );

namespace BookingSuite\Backend\Support;

defined( 'ABSPATH' ) || exit;

final class ProofUpload {

	/** Accepted types, mapped to the extension the file is saved with. */
	private const ALLOWED = array(
		'image/jpeg'      => 'jpg',
		'image/png'       => 'png',
		'image/webp'      => 'webp',
		'image/gif'       => 'gif',
		'application/pdf' => 'pdf',
	);

	private const MAX_BYTES = 5 * MB_IN_BYTES;

	/**
	 * Save a data URL to the media library.
	 *
	 * @return int|null Attachment id, or null when nothing usable was sent.
	 */
	public static function save( string $data_url, string $reference ): ?int {
		if ( ! preg_match( '#^data:([a-z0-9.+/-]+);base64,#i', $data_url, $matches ) ) {
			return null;
		}

		$mime = strtolower( $matches[1] );

		if ( ! isset( self::ALLOWED[ $mime ] ) ) {
			return null;
		}

		$encoded = substr( $data_url, strlen( $matches[0] ) );
		$binary  = base64_decode( $encoded, true );

		if ( false === $binary || '' === $binary ) {
			return null;
		}

		if ( strlen( $binary ) > self::MAX_BYTES ) {
			return null;
		}

		// Trust the bytes, not the declared type: an image that does not parse
		// as one is rejected outright.
		if ( 'application/pdf' !== $mime && false === @getimagesizefromstring( $binary ) ) {
			return null;
		}

		$filename = sprintf(
			'booking-proof-%s-%s.%s',
			$reference ? sanitize_file_name( $reference ) : 'unreferenced',
			wp_generate_password( 6, false, false ),
			self::ALLOWED[ $mime ]
		);

		$upload = wp_upload_bits( $filename, null, $binary );

		if ( ! empty( $upload['error'] ) ) {
			return null;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => $mime,
				'post_title'     => sprintf(
					/* translators: %s: booking reference. */
					__( 'Payment proof for %s', 'booking-suite' ),
					$reference
				),
				'post_content'   => '',
				'post_status'    => 'inherit',
			),
			$upload['file']
		);

		if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
			return null;
		}

		wp_update_attachment_metadata(
			$attachment_id,
			wp_generate_attachment_metadata( $attachment_id, $upload['file'] )
		);

		return (int) $attachment_id;
	}
}
