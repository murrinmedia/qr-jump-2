<?php
/**
 * Identifies automated traffic (link-preview fetchers, crawlers, monitors).
 *
 * Bot hits are still redirected and still logged, but flagged with is_bot = 1
 * so they are excluded from stats, scan limits and notifications.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bot_Detector {

	/**
	 * Case-insensitive substrings that identify a bot user agent.
	 *
	 * @return string[]
	 */
	public static function patterns(): array {
		// Generic 'bot' is deliberately NOT a pattern: it would match real
		// phones (e.g. "Cubot"). Crawlers identify as "<name>bot/1.0" or
		// "<name>bot;", so match those tokens plus well-known fetchers.
		$patterns = array(
			'bot/', 'bot;', 'bot)', 'bot-', 'crawl', 'spider', 'slurp', 'preview',
			'monitor', 'headless', 'facebookexternalhit', 'facebot', 'whatsapp',
			'slack', 'telegram', 'discord', 'skype', 'embedly', 'pinterest',
			'flipboard', 'vkshare', 'yandex', 'baidu', 'lighthouse', 'pingdom',
			'uptime', 'semrush', 'ahrefs', 'mj12', 'curl/', 'wget', 'python-requests',
			'go-http-client', 'java/', 'libwww', 'httpclient', 'node-fetch', 'axios',
		);

		/**
		 * Filter the list of bot user-agent substrings.
		 *
		 * @param string[] $patterns Lower-case substrings.
		 */
		return (array) apply_filters( 'qrjump_bot_patterns', $patterns );
	}

	/**
	 * Is this request from a bot?
	 *
	 * An empty user agent or a HEAD request is treated as a bot: real phones
	 * scanning a QR code always send a user agent and a GET.
	 *
	 * @param string $user_agent
	 * @param string $method     HTTP request method.
	 * @return bool
	 */
	public static function is_bot( string $user_agent, string $method = 'GET' ): bool {
		if ( 'HEAD' === strtoupper( $method ) || '' === trim( $user_agent ) ) {
			return true;
		}

		$ua = strtolower( $user_agent );
		foreach ( self::patterns() as $pattern ) {
			if ( '' !== $pattern && false !== strpos( $ua, strtolower( $pattern ) ) ) {
				return true;
			}
		}

		return false;
	}
}
