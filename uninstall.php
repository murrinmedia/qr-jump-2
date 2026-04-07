<?php
/**
 * Uninstall QR Jump.
 *
 * Drops all custom tables and removes every plugin option when the user
 * deletes the plugin from the WordPress admin.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
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
