<?php
/**
 * Plugin-wide settings management.
 *
 * Wraps get_option / update_option with a typed defaults layer so every
 * part of the plugin reads settings through a single source of truth.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Settings {

	/**
	 * Default values for every plugin setting.
	 *
	 * @var array<string, mixed>
	 */
	private static $defaults = array(
		'redirect_prefix'           => 'go',         // URL segment: example.com/go/<slug>
		'disabled_behavior'         => '404',         // '404' | 'message'
		'disabled_message'          => 'This QR code is no longer active.',
		'report_schedule'           => 'none',        // 'none' | 'daily' | 'weekly' | 'monthly'
		'report_email'              => '',
		'notify_rate_limit_minutes' => 5,
	);

	/**
	 * Get a single setting value.
	 *
	 * @param string $key     Setting key (without 'qrjump_' prefix).
	 * @param mixed  $default Override the built-in default (optional).
	 * @return mixed
	 */
	public static function get( string $key, $default = null ) {
		if ( null === $default && array_key_exists( $key, self::$defaults ) ) {
			$default = self::$defaults[ $key ];
		}
		return get_option( 'qrjump_' . $key, $default );
	}

	/**
	 * Persist a single setting.
	 *
	 * @param string $key   Setting key (without 'qrjump_' prefix).
	 * @param mixed  $value New value.
	 * @return bool
	 */
	public static function set( string $key, $value ): bool {
		return update_option( 'qrjump_' . $key, $value );
	}

	/**
	 * Return all settings as an associative array.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_all(): array {
		$settings = array();
		foreach ( self::$defaults as $key => $default ) {
			$settings[ $key ] = self::get( $key );
		}
		return $settings;
	}

	/**
	 * Persist multiple settings at once.
	 *
	 * Only keys present in $defaults are accepted; unknown keys are silently
	 * ignored to prevent arbitrary option writes.
	 *
	 * @param array<string, mixed> $data Key → value map.
	 */
	public static function update_all( array $data ): void {
		foreach ( $data as $key => $value ) {
			if ( array_key_exists( $key, self::$defaults ) ) {
				self::set( $key, $value );
			}
		}
	}

	/**
	 * Return the default value for a key, or null if unknown.
	 *
	 * @param string $key
	 * @return mixed
	 */
	public static function get_default( string $key ) {
		return self::$defaults[ $key ] ?? null;
	}
}
