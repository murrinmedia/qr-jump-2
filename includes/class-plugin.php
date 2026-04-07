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
		// Register cache exclusions with every major caching plugin so that
		// short URLs are never served from cache.  Must run before caching
		// plugins initialise (plugins_loaded priority 1 in the main file, but
		// the filters themselves fire lazily so adding them here is fine).
		$this->register_cache_exclusions();

		// Run DB upgrade check on every request (cheap version_compare).
		add_action( 'init', array( 'QRJump\\Installer', 'maybe_upgrade' ) );

		// i18n.
		add_action( 'init', array( $this, 'load_textdomain' ) );

		// Handle short-URL redirects as early as possible — fires before
		// caching plugins, canonical redirects, and template routing.
		add_action( 'init', array( new Redirect_Handler(), 'handle' ), 1 );

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
	 * Tell every major caching plugin not to cache our short URLs.
	 *
	 * Each caching plugin exposes its own filter/constant.  We register with
	 * all of them so the plugin works out-of-the-box regardless of which
	 * caching plugin the site uses — no manual exclusions needed.
	 */
	private function register_cache_exclusions(): void {
		// Build the pattern once; re-used in every filter below.
		$get_pattern = static function (): string {
			$prefix = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
			return '/' . $prefix . '/';
		};

		// ── FlyingPress ──────────────────────────────────────────────────────
		add_filter(
			'flying_press_exclude_urls',
			static function ( $urls ) use ( $get_pattern ) {
				$urls[] = $get_pattern();
				return $urls;
			}
		);

		// ── WP Rocket ────────────────────────────────────────────────────────
		add_filter(
			'rocket_cache_reject_uri',
			static function ( $uris ) use ( $get_pattern ) {
				$uris[] = $get_pattern() . '(.*)';
				return $uris;
			}
		);

		// ── LiteSpeed Cache ───────────────────────────────────────────────────
		add_filter(
			'litespeed_cache_exception',
			static function ( $list ) use ( $get_pattern ) {
				$list[] = $get_pattern();
				return $list;
			}
		);

		// ── W3 Total Cache ────────────────────────────────────────────────────
		add_filter(
			'w3tc_cache_reject_uri',
			static function ( $uris ) use ( $get_pattern ) {
				$uris[] = $get_pattern() . '.*';
				return $uris;
			}
		);

		// ── WP Super Cache ────────────────────────────────────────────────────
		add_filter(
			'wpsc_rejected_urls',
			static function ( $urls ) use ( $get_pattern ) {
				$urls[] = $get_pattern();
				return $urls;
			}
		);

		// ── Swift Performance ─────────────────────────────────────────────────
		add_filter(
			'swp_cache_exclude',
			static function ( $urls ) use ( $get_pattern ) {
				$urls[] = $get_pattern();
				return $urls;
			}
		);

		// ── Define DONOTCACHEPAGE constant if this request is a short URL.
		// Works as a fallback signal for any caching plugin that checks it.
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		$prefix      = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
		if ( $prefix && false !== strpos( $request_uri, '/' . $prefix . '/' ) ) {
			if ( ! defined( 'DONOTCACHEPAGE' ) ) {
				define( 'DONOTCACHEPAGE', true );
			}
			if ( ! defined( 'DONOTCACHEOBJECT' ) ) {
				define( 'DONOTCACHEOBJECT', true );
			}
		}
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
