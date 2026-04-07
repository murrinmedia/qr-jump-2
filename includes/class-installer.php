<?php
/**
 * Handles plugin activation, deactivation, and database installation / upgrades.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Installer {

	/**
	 * Runs on plugin activation.
	 *
	 * Called via register_activation_hook() in qr-jump.php.
	 */
	public static function activate(): void {
		// Generate a unique salt for IP hashing.
		if ( ! get_option( 'qrjump_salt' ) ) {
			update_option( 'qrjump_salt', wp_generate_password( 64, true, true ), false );
		}

		self::create_tables();

		// Schedule report cron jobs.
		Report_Scheduler::schedule_all();

		// Flush rewrite rules so /qr/<slug> is routable immediately.
		flush_rewrite_rules();

		// Clear all caches so no stale responses from before plugin install
		// can interfere with short-URL redirects.
		Cache_Purger::purge_all();

		update_option( 'qrjump_db_version', QRJUMP_DB_VERSION, false );
	}

	/**
	 * Runs on plugin deactivation.
	 */
	public static function deactivate(): void {
		Report_Scheduler::unschedule_all();
		flush_rewrite_rules();
	}

	/**
	 * Create (or upgrade) plugin tables using dbDelta.
	 *
	 * Safe to call multiple times — dbDelta is idempotent.
	 */
	public static function create_tables(): void {
		global $wpdb;

		$charset_collate = $wpdb->get_charset_collate();
		$codes_table     = $wpdb->prefix . 'qrjump_codes';
		$scans_table     = $wpdb->prefix . 'qrjump_scans';

		// dbDelta requirements:
		//   • Two spaces between PRIMARY KEY and the opening paren.
		//   • Each field on its own line.
		//   • No trailing comma on last field before PRIMARY KEY.
		$sql = "CREATE TABLE {$codes_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL DEFAULT '',
  slug varchar(32) NOT NULL DEFAULT '',
  destination_url text NOT NULL,
  status tinyint(1) NOT NULL DEFAULT 1,
  redirect_type smallint(3) NOT NULL DEFAULT 302,
  fg_colour varchar(7) NOT NULL DEFAULT '#000000',
  bg_colour varchar(7) NOT NULL DEFAULT '#ffffff',
  notes text,
  settings longtext,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY slug (slug),
  KEY status (status)
) {$charset_collate};
CREATE TABLE {$scans_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  qr_code_id bigint(20) unsigned NOT NULL,
  scanned_at datetime NOT NULL,
  ip_hash varchar(64) NOT NULL DEFAULT '',
  user_agent varchar(512) NOT NULL DEFAULT '',
  referrer varchar(2083) NOT NULL DEFAULT '',
  scan_type enum('unique','repeat') NOT NULL DEFAULT 'unique',
  PRIMARY KEY  (id),
  KEY qr_code_id (qr_code_id),
  KEY scanned_at (scanned_at),
  KEY qr_scan_lookup (qr_code_id, ip_hash, scanned_at)
) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	/**
	 * Run upgrade routines when the stored DB version is behind the current one.
	 *
	 * Hooked to 'init' so it runs on every request with a cheap version_compare.
	 */
	public static function maybe_upgrade(): void {
		$installed = get_option( 'qrjump_db_version', '0' );

		if ( version_compare( $installed, QRJUMP_DB_VERSION, '<' ) ) {
			self::create_tables();
			update_option( 'qrjump_db_version', QRJUMP_DB_VERSION, false );
		}

		// One-time migration: rename the default prefix from 'go' → 'qr'.
		// Only resets if the value is still exactly 'go' (the old default),
		// so any site that intentionally set it to 'go' and then saved Settings
		// won't be affected (they would have saved it explicitly).
		if ( 'go' === get_option( 'qrjump_redirect_prefix', '' ) ) {
			update_option( 'qrjump_redirect_prefix', 'qr', false );
		}
	}
}
