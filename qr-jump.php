<?php
/**
 * Plugin Name:       QR Jump
 * Description:       Dynamic QR code generator with configurable short URLs, scan analytics, and a premium admin interface.
 * Version:           1.0.26
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       qr-jump
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'QRJUMP_VERSION',         '1.0.26' );
define( 'QRJUMP_DB_VERSION',      '1.0' );
define( 'QRJUMP_PLUGIN_FILE',     __FILE__ );
define( 'QRJUMP_PLUGIN_DIR',      plugin_dir_path( __FILE__ ) );
define( 'QRJUMP_PLUGIN_URL',      plugin_dir_url( __FILE__ ) );
define( 'QRJUMP_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Composer autoloader — endroid/qr-code and other vendor dependencies.
if ( file_exists( QRJUMP_PLUGIN_DIR . 'vendor/autoload.php' ) ) {
	require_once QRJUMP_PLUGIN_DIR . 'vendor/autoload.php';
}

// GitHub update checker — allows WordPress to pull updates from GitHub releases.
if ( class_exists( 'YahnisElsts\PluginUpdateChecker\v5\PucFactory' ) ) {
	\YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
		'https://github.com/murrinmedia/qr-jump-2/',
		__FILE__,
		'qr-jump'
	);
}

/**
 * PSR-4-style autoloader for plugin classes.
 *
 * Maps QRJump\Foo_Bar  → includes/class-foo-bar.php
 *     QRJump\Sub\Baz   → includes/sub/class-baz.php
 */
spl_autoload_register( static function ( string $class ): void {
	$prefix = 'QRJump\\';
	$len    = strlen( $prefix );

	if ( strncmp( $prefix, $class, $len ) !== 0 ) {
		return;
	}

	$relative = substr( $class, $len );
	$parts    = explode( '\\', $relative );
	$filename = 'class-' . strtolower( str_replace( '_', '-', array_pop( $parts ) ) ) . '.php';
	$subdir   = $parts
		? strtolower( implode( DIRECTORY_SEPARATOR, $parts ) ) . DIRECTORY_SEPARATOR
		: '';

	$path = QRJUMP_PLUGIN_DIR . 'includes' . DIRECTORY_SEPARATOR . $subdir . $filename;

	if ( file_exists( $path ) ) {
		require_once $path;
	}
} );

// Lifecycle hooks must be registered from the main plugin file.
register_activation_hook( __FILE__, array( 'QRJump\\Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'QRJump\\Installer', 'deactivate' ) );

// Bootstrap once all plugins are loaded so inter-plugin compatibility is maximised.
add_action( 'plugins_loaded', static function (): void {
	QRJump\Plugin::instance();
} );
