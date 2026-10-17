<?php
/**
 * Uninstall QR Jump.
 *
 * When the user deletes the plugin from the WordPress admin, drops all custom
 * tables and removes every plugin option — but only if the
 * 'delete_data_on_uninstall' setting is on (off by default).
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Data is kept by default. Only wipe it when the site owner has explicitly
// enabled "Delete all data when plugin is uninstalled" in QR Jump → Settings.
if ( ! (int) get_option( 'qrjump_delete_data_on_uninstall', 0 ) ) {
	return;
}

global $wpdb;

// Drop scan events first (foreign-key order).
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}qrjump_scans" );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}qrjump_codes" );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

// Remove plugin options.
$options = array(
	'qrjump_db_version',
	'qrjump_salt',
	'qrjump_redirect_prefix',
	'qrjump_disabled_behavior',
	'qrjump_disabled_message',
	'qrjump_report_schedule',
	'qrjump_report_email',
	'qrjump_notify_rate_limit_minutes',
	'qrjump_brand_fg_colour',
	'qrjump_brand_bg_colour',
	'qrjump_ip_header',
	'qrjump_retention_days',
	'qrjump_delete_data_on_uninstall',
);

foreach ( $options as $option ) {
	delete_option( $option );
}

// Remove all transients created by this plugin.
$wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_qrjump\_%'
	    OR option_name LIKE '_transient_timeout_qrjump\_%'"
);
