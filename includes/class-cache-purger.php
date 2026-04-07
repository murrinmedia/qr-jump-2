<?php
/**
 * Cache purger.
 *
 * Clears cached copies of QR Jump short URLs from every major caching plugin
 * using each plugin's own documented public API.  Called when a QR code is
 * created, updated, or deleted — so stale cached responses can never cause
 * redirect failures.
 *
 * All calls are wrapped in function_exists / class_exists / action-exists
 * guards so this class is safe to run on any site regardless of which (if
 * any) caching plugin is installed.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cache_Purger {

	/**
	 * Purge the cached copy of a single short URL.
	 *
	 * @param string $slug  The QR code slug.
	 */
	public static function purge_url( string $slug ): void {
		$prefix    = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
		$short_url = home_url( '/' . $prefix . '/' . $slug );

		// ── FlyingPress ───────────────────────────────────────────────────────
		if ( function_exists( 'flying_press_purge_url' ) ) {
			flying_press_purge_url( $short_url );
		}

		// ── WP Rocket ─────────────────────────────────────────────────────────
		if ( function_exists( 'rocket_clean_domain' ) ) {
			// rocket_clean_domain purges by URL pattern via WP Rocket's own cache
			// path helper — there is no single-URL function in their public API.
			// Purging the full domain is safe (it only clears HTML cache, not
			// assets) and is what their own plugin does on post save.
			rocket_clean_domain();
		}

		// ── LiteSpeed Cache ───────────────────────────────────────────────────
		if ( class_exists( 'LiteSpeed_Cache_API' ) ) {
			LiteSpeed_Cache_API::purge( $short_url );
		}
		// LiteSpeed v4+.
		do_action( 'litespeed_purge_url', $short_url );

		// ── W3 Total Cache ─────────────────────────────────────────────────────
		if ( function_exists( 'w3tc_flush_url' ) ) {
			w3tc_flush_url( $short_url );
		}

		// ── WP Super Cache ─────────────────────────────────────────────────────
		if ( function_exists( 'wpsc_delete_url_cache' ) ) {
			wpsc_delete_url_cache( $short_url );
		}

		// ── Swift Performance ──────────────────────────────────────────────────
		if ( function_exists( 'swift_performance_cache_warmup_delete_cache_by_url' ) ) {
			swift_performance_cache_warmup_delete_cache_by_url( $short_url );
		}

		// ── Hummingbird ────────────────────────────────────────────────────────
		do_action( 'wphb_clear_page_cache', $short_url );

		// ── Autoptimize ────────────────────────────────────────────────────────
		if ( class_exists( 'autoptimizeCache' ) ) {
			\autoptimizeCache::clearall();
		}

		// ── Cloudflare (via WP Cloudflare Super Page Cache) ───────────────────
		do_action( 'swcfpc_purge_cache' );

		/**
		 * Allow third-party plugins or themes to hook in their own cache
		 * purge logic.
		 *
		 * @param string $short_url  The full short URL that was invalidated.
		 * @param string $slug       The QR code slug.
		 */
		do_action( 'qrjump_purge_url', $short_url, $slug );
	}

	/**
	 * Purge the entire site cache.
	 *
	 * Called on plugin activation / prefix change to ensure no stale short-URL
	 * responses remain cached from before the plugin was installed.
	 */
	public static function purge_all(): void {
		// ── FlyingPress ───────────────────────────────────────────────────────
		if ( function_exists( 'flying_press_purge_all' ) ) {
			flying_press_purge_all();
		}

		// ── WP Rocket ─────────────────────────────────────────────────────────
		if ( function_exists( 'rocket_clean_domain' ) ) {
			rocket_clean_domain();
		}

		// ── LiteSpeed Cache ───────────────────────────────────────────────────
		do_action( 'litespeed_purge_all' );

		// ── W3 Total Cache ─────────────────────────────────────────────────────
		if ( function_exists( 'w3tc_flush_all' ) ) {
			w3tc_flush_all();
		}

		// ── WP Super Cache ─────────────────────────────────────────────────────
		if ( function_exists( 'wp_cache_clear_cache' ) ) {
			wp_cache_clear_cache();
		}

		// ── Swift Performance ──────────────────────────────────────────────────
		do_action( 'swift_performance_before_purge_cache' );

		// ── Hummingbird ────────────────────────────────────────────────────────
		do_action( 'wphb_clear_page_cache' );

		/**
		 * Allow third-party integrations to hook in.
		 */
		do_action( 'qrjump_purge_all' );
	}
}
