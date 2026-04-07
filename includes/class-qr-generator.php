<?php
/**
 * QR code generation wrapper around endroid/qr-code v4.
 *
 * Requires the Composer vendor autoloader to be present.
 * Run `composer install` from the plugin root before use.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel\ErrorCorrectionLevelHigh;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;
use Endroid\QrCode\Color\Color;

class QR_Generator {

	/**
	 * Generate a QR code and return the raw output.
	 *
	 * @param string $url       Short URL to encode (e.g. https://example.com/go/abc).
	 * @param string $format    'png' or 'svg'.
	 * @param string $fg_colour Hex foreground colour (e.g. '#000000').
	 * @param string $bg_colour Hex background colour (e.g. '#ffffff').
	 * @param int    $size      Output size in pixels.  Default 1000 for print quality.
	 *                          Admin preview should pass a smaller value (e.g. 300).
	 * @return string Raw PNG binary or SVG markup.
	 * @throws \RuntimeException If the endroid library is not installed.
	 */
	public static function generate(
		string $url,
		string $format    = 'png',
		string $fg_colour = '#000000',
		string $bg_colour = '#ffffff',
		int    $size      = 1000
	): string {
		if ( ! class_exists( Builder::class ) ) {
			throw new \RuntimeException(
				'endroid/qr-code is not installed. Run `composer install` from the plugin directory.'
			);
		}

		$writer = 'svg' === $format ? new SvgWriter() : new PngWriter();

		$result = Builder::create()
			->writer( $writer )
			->data( $url )
			->encoding( new Encoding( 'UTF-8' ) )
			->errorCorrectionLevel( new ErrorCorrectionLevelHigh() )
			->size( $size )
			->margin( 20 )
			->foregroundColor( self::hex_to_color( $fg_colour ) )
			->backgroundColor( self::hex_to_color( $bg_colour ) )
			->build();

		return $result->getString();
	}

	/**
	 * Return the MIME type for the given format.
	 *
	 * @param string $format 'png' or 'svg'.
	 * @return string
	 */
	public static function get_mime_type( string $format ): string {
		return 'svg' === $format ? 'image/svg+xml' : 'image/png';
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Convert a hex colour string to an endroid Color object.
	 *
	 * @param string $hex e.g. '#1a2b3c' or '#fff'.
	 * @return Color
	 */
	private static function hex_to_color( string $hex ): Color {
		$hex = ltrim( $hex, '#' );

		// Expand 3-digit shorthand.
		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}

		return new Color(
			(int) hexdec( substr( $hex, 0, 2 ) ),
			(int) hexdec( substr( $hex, 2, 2 ) ),
			(int) hexdec( substr( $hex, 4, 2 ) )
		);
	}
}
