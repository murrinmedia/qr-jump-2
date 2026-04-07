<?php
/**
 * Main plugin orchestrator.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Singleton that wires every subsystem together via WordPress hooks.
 */
final class Plugin {

	/** @var Plugin|null */
	private static $instance = null;

	/**
	 * Private constructor — use instance().
	 */
	private function __construct() {
		$this->init();
	}

	/**
	 * Return (and create on first call) the single plugin instance.
	 */
	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Register all hooks.
	 */
	private function init(): void {
		// Run DB upgrade check on every request (cheap version_compare).
		add_action( 'init', array( 'QRJump\\Installer', 'maybe_upgrade' ) );

		// i18n.
		add_action( 'init', array( $this, 'load_textdomain' ) );

		// Handle short-URL redirects as early as possible.
		add_action( 'parse_request', array( new Redirect_Handler(), 'handle' ), 1 );

		// REST API.
		add_action( 'rest_api_init', array( new REST_Controller(), 'register_routes' ) );

		// Admin UI — only load in the admin context to save resources.
		if ( is_admin() ) {
			( new Admin() )->register_hooks();
		}

		// Scheduled tasks and async notifications.
		( new Report_Scheduler() )->register_hooks();
	}

	/**
	 * Load plugin translations.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain(
			'qr-jump',
			false,
			dirname( QRJUMP_PLUGIN_BASENAME ) . '/languages'
		);
	}

	/** Prevent cloning the singleton. */
	private function __clone() {}

	/** Prevent unserialising the singleton. */
	public function __wakeup(): void {
		throw new \Exception( 'Cannot unserialise the QRJump singleton.' );
	}
}
