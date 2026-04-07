<?php
/**
 * Handles short-URL redirects.
 *
 * Hooked to 'parse_request' at priority 1 so it fires before WordPress
 * performs any post / page database lookup. On a match, it:
 *   1. Sends the redirect header.
 *   2. Flushes the response to the client (fastcgi_finish_request if available).
 *   3. Logs the scan.
 *   4. Queues an optional per-code notification.
 *   5. Exits.
 *
 * If no match is found, it returns silently and WordPress continues normally.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Redirect_Handler {

	/**
	 * Entry point — attached to 'parse_request'.
	 *
	 * Hooked to 'init' — no arguments passed.
	 */
	public function handle(): void {
		$prefix = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
		if ( '' === $prefix ) {
			return;
		}

		// Use REQUEST_URI directly — more reliable than $wp->request which can
		// be empty or incorrect when no rewrite rule matches the path.
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		list( $request_path ) = explode( '?', $request_uri, 2 );

		// Strip home path prefix for subdirectory installs (e.g. /mysite/qr/abc).
		$home_path = (string) parse_url( home_url(), PHP_URL_PATH );
		$home_path = rtrim( $home_path, '/' );
		if ( $home_path && 0 === strpos( $request_path, $home_path . '/' ) ) {
			$request_path = substr( $request_path, strlen( $home_path ) );
		}

		$request = trim( $request_path, '/' );

		// Must start with "<prefix>/".
		if ( 0 !== strpos( $request, $prefix . '/' ) ) {
			return;
		}

		// ── This IS a QR Jump short URL ──────────────────────────────────────
		// Signal every caching layer immediately — before any slug lookup or
		// redirect — so no caching plugin can store this response.
		$this->prevent_caching();

		$slug = substr( $request, strlen( $prefix ) + 1 );
		$slug = trim( $slug, '/' );

		if ( '' === $slug ) {
			return;
		}

		$code = $this->lookup_code( $slug );

		if ( null === $code ) {
			// Unknown slug — let WordPress handle it (404).
			return;
		}

		if ( ! $code->status ) {
			$this->handle_inactive( $code );
			return; // handle_inactive may exit or fall through.
		}

		$destination = $this->safe_destination( $code->destination_url );
		if ( null === $destination ) {
			// Destination URL is invalid — treat as a 404.
			return;
		}

		// Collect scan data before we send headers.
		$scan_data = $this->build_scan_data( (int) $code->id );

		// Send redirect headers — does NOT exit.
		wp_redirect( $destination, (int) $code->redirect_type );

		// Flush the response to the client immediately if running under
		// FastCGI/PHP-FPM so the scan logging is invisible to the user.
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		}

		// Log the scan (always runs; slow on plain PHP, post-flush on FPM).
		Scan_Logger::log( $scan_data );

		// Queue notification (deferred via WP-Cron, never blocks this process).
		$code_settings = $code->settings
			? (array) json_decode( $code->settings, true )
			: array();
		Notification_Manager::maybe_schedule( (int) $code->id, $code_settings );

		exit;
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Prevent every caching layer from storing or serving a cached response
	 * for this request.
	 *
	 * Called as soon as a QR Jump prefix match is confirmed — before any
	 * database lookup or redirect — so it runs regardless of whether the slug
	 * is valid, invalid, or points to an inactive code.
	 *
	 * Strategy:
	 *  1. Define the standard WordPress cache-bypass constants that every
	 *     well-behaved caching plugin checks (DONOTCACHEPAGE, DONOTCACHEDB,
	 *     DONOTMINIFY, DONOTCDN).
	 *  2. Call nocache_headers() to emit HTTP headers that tell downstream
	 *     proxies, CDNs, and the browser not to cache this response.
	 *  3. Send an explicit Cache-Control header that overrides any previously
	 *     set value (some caching plugins send headers before ours).
	 *
	 * This does NOT require users to manually add exclusions in their caching
	 * plugin settings.
	 */
	private function prevent_caching(): void {
		// WordPress cache-bypass constants — checked by virtually every
		// caching plugin (WP Rocket, FlyingPress, LiteSpeed, W3TC, etc.)
		// before they decide to store or serve a cached copy.
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		if ( ! defined( 'DONOTCACHEDB' ) ) {
			define( 'DONOTCACHEDB', true );
		}
		if ( ! defined( 'DONOTMINIFY' ) ) {
			define( 'DONOTMINIFY', true );
		}
		if ( ! defined( 'DONOTCDN' ) ) {
			define( 'DONOTCDN', true );
		}

		// WordPress helper — sets Expires, Cache-Control, and Pragma headers.
		if ( function_exists( 'nocache_headers' ) ) {
			nocache_headers();
		}

		// Belt-and-braces: send a definitive Cache-Control header so that
		// reverse proxies, CDNs (Cloudflare, etc.), and the browser all know
		// this response must never be stored or reused.
		if ( ! headers_sent() ) {
			header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true );
			header( 'Pragma: no-cache', true );
		}
	}

	/**
	 * Fetch the QR code row for the given slug.
	 *
	 * Uses a single indexed lookup — should be <1 ms even at 100k rows.
	 *
	 * @param string $slug
	 * @return object|null
	 */
	private function lookup_code( string $slug ): ?object {
		global $wpdb;

		return $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT id, destination_url, status, redirect_type, settings
				 FROM {$wpdb->prefix}qrjump_codes
				 WHERE slug = %s
				 LIMIT 1",
				$slug
			)
		) ?: null;
	}

	/**
	 * Handle a scan for an inactive QR code per the global setting.
	 *
	 * @param object $code
	 */
	private function handle_inactive( object $code ): void {
		$behavior = Settings::get( 'disabled_behavior' );

		if ( 'message' === $behavior ) {
			$message = Settings::get( 'disabled_message' );
			wp_die(
				esc_html( $message ),
				esc_html__( 'QR Code Inactive', 'qr-jump' ),
				array( 'response' => 200 )
			);
		}

		// 'fallthrough' is treated as 404 — return without exiting so WP
		// continues and serves its own 404 response.
	}

	/**
	 * Validate the destination URL and return the raw URL or null if unsafe.
	 *
	 * @param string $url
	 * @return string|null
	 */
	private function safe_destination( string $url ): ?string {
		$url = trim( $url );
		if ( '' === $url ) {
			return null;
		}

		$scheme = (string) wp_parse_url( $url, PHP_URL_SCHEME );
		if ( ! in_array( strtolower( $scheme ), array( 'http', 'https' ), true ) ) {
			return null;
		}

		// Guard against redirect loops: destination must not be our own short-URL prefix.
		$prefix    = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
		$short_base = rtrim( home_url(), '/' ) . '/' . $prefix . '/';
		if ( 0 === strpos( $url, $short_base ) ) {
			return null;
		}

		return esc_url_raw( $url );
	}

	/**
	 * Build the scan data array from the current server environment.
	 *
	 * IP is hashed immediately — the raw IP is never stored.
	 *
	 * @param int $qr_code_id
	 * @return array<string, mixed>
	 */
	private function build_scan_data( int $qr_code_id ): array {
		$salt       = (string) get_option( 'qrjump_salt', '' );
		$remote_ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '';
		$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] )
			? substr( (string) $_SERVER['HTTP_USER_AGENT'], 0, 512 )
			: '';
		$referrer   = isset( $_SERVER['HTTP_REFERER'] )
			? substr( (string) $_SERVER['HTTP_REFERER'], 0, 2083 )
			: '';

		return array(
			'qr_code_id' => $qr_code_id,
			'ip_hash'    => hash( 'sha256', $remote_ip . $salt ),
			'user_agent' => $user_agent,
			'referrer'   => $referrer,
		);
	}
}
