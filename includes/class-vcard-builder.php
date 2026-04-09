<?php
/**
 * Generates a vCard 3.0 string from structured builder data.
 *
 * This is the single authoritative source for vCard generation in builder mode.
 * The redirect handler always serves destination_url directly — this class
 * regenerates that field on every save when vcard_mode is 'builder'.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VCard_Builder {

	/**
	 * Generate a vCard 3.0 string from structured data.
	 *
	 * @param array<string, mixed> $data Structured vcard_data fields.
	 * @return string Raw vCard text suitable for storing in destination_url.
	 */
	public static function generate( array $data ): string {
		$lines = array( 'BEGIN:VCARD', 'VERSION:3.0' );

		// Full name (FN is required in vCard 3.0).
		$full_name = trim( (string) ( $data['full_name'] ?? '' ) );
		if ( '' === $full_name ) {
			$full_name = trim( ( $data['first_name'] ?? '' ) . ' ' . ( $data['last_name'] ?? '' ) );
		}
		$lines[] = 'FN:' . self::esc( $full_name !== '' ? $full_name : 'Unknown' );

		// Structured name: N:last;first;;;
		$last    = self::esc( (string) ( $data['last_name']  ?? '' ) );
		$first   = self::esc( (string) ( $data['first_name'] ?? '' ) );
		$lines[] = "N:{$last};{$first};;;";

		if ( ! empty( $data['org'] ) ) {
			$lines[] = 'ORG:' . self::esc( (string) $data['org'] );
		}

		if ( ! empty( $data['title'] ) ) {
			$lines[] = 'TITLE:' . self::esc( (string) $data['title'] );
		}

		if ( ! empty( $data['phone_mobile'] ) ) {
			$lines[] = 'TEL;TYPE=CELL:' . (string) $data['phone_mobile'];
		}

		if ( ! empty( $data['phone_work'] ) ) {
			$lines[] = 'TEL;TYPE=WORK:' . (string) $data['phone_work'];
		}

		if ( ! empty( $data['email'] ) ) {
			$lines[] = 'EMAIL:' . (string) $data['email'];
		}

		if ( ! empty( $data['website'] ) ) {
			$lines[] = 'URL:' . (string) $data['website'];
		}

		if ( ! empty( $data['address'] ) ) {
			$lines[] = 'ADR;TYPE=WORK:;;' . self::esc( (string) $data['address'] ) . ';;;;';
		}

		if ( ! empty( $data['notes'] ) ) {
			$lines[] = 'NOTE:' . self::esc( (string) $data['notes'] );
		}

		// Photo — fetch file from WP media library and embed as base64.
		$photo_id = absint( $data['photo_id'] ?? 0 );
		if ( $photo_id > 0 ) {
			$photo = self::encode_photo( $photo_id );
			if ( null !== $photo ) {
				$lines[] = 'PHOTO;ENCODING=b;TYPE=' . $photo['type'] . ':' . $photo['base64'];
			}
		}

		$lines[] = 'END:VCARD';

		return implode( "\r\n", $lines ) . "\r\n";
	}

	/**
	 * Escape special characters per vCard 3.0 spec.
	 *
	 * @param string $value
	 * @return string
	 */
	private static function esc( string $value ): string {
		$value = str_replace( '\\', '\\\\', $value );
		$value = str_replace( ',', '\\,', $value );
		$value = str_replace( ';', '\\;', $value );
		$value = str_replace( array( "\r\n", "\r", "\n" ), '\\n', $value );
		return $value;
	}

	/**
	 * Read a WP media attachment and return its base64-encoded content.
	 *
	 * Uses the WP-generated 'medium' thumbnail (max 300×300px) rather than
	 * the original file. This keeps the vCard well within the TEXT column
	 * limit (~65KB) and ensures compatibility with contact apps.
	 * Falls back to the original file only if no intermediate size exists.
	 *
	 * @param int $attachment_id
	 * @return array{type: string, base64: string}|null
	 */
	private static function encode_photo( int $attachment_id ): ?array {
		// Only JPEG and PNG are widely supported in vCard photo fields.
		$mime_map = array(
			'image/jpeg' => 'JPEG',
			'image/jpg'  => 'JPEG',
			'image/png'  => 'PNG',
		);

		$mime = (string) get_post_mime_type( $attachment_id );
		$type = $mime_map[ $mime ] ?? null;
		if ( null === $type ) {
			return null;
		}

		// Prefer the 'medium' intermediate size (WP generates this at ≤300×300px).
		// This is small enough to embed safely and large enough to look good.
		$sized = wp_get_attachment_image_src( $attachment_id, 'medium' );
		if ( $sized ) {
			// wp_get_attachment_image_src returns a URL; resolve to a filesystem path.
			$upload_dir = wp_upload_dir();
			$base_url   = $upload_dir['baseurl'];
			$base_dir   = $upload_dir['basedir'];
			$url        = $sized[0];

			// Strip the base URL to get the relative path, then resolve to a filesystem path.
			if ( 0 === strpos( $url, $base_url ) ) {
				$rel_path = substr( $url, strlen( $base_url ) );
				$path     = $base_dir . $rel_path;
			} else {
				$path = null;
			}
		} else {
			$path = null;
		}

		// Fall back to the original file if no intermediate size was found.
		if ( ! $path || ! file_exists( $path ) ) {
			$path = get_attached_file( $attachment_id );
			if ( ! $path || ! file_exists( $path ) ) {
				return null;
			}
		}

		// Enforce a 40KB file-size ceiling to ensure the encoded result fits
		// comfortably within the destination_url TEXT column (max ~65KB total).
		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$size = @filesize( $path );
		if ( false !== $size && $size > 40960 ) {
			return null; // Image still too large even after resizing — skip photo.
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$bytes = file_get_contents( $path );
		if ( false === $bytes || '' === $bytes ) {
			return null;
		}

		return array(
			'type'   => $type,
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			'base64' => base64_encode( $bytes ),
		);
	}
}
