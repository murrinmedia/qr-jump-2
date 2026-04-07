<?php
/**
 * Records scan events to the database.
 *
 * Uniqueness rule: a scan from the same visitor (ip_hash + user_agent)
 * within the previous 24 hours is recorded as 'repeat'; after 24 hours
 * it becomes a new 'unique' scan.
 *
 * This class is intentionally kept minimal — it does a single SELECT
 * (to determine uniqueness) and a single INSERT. Both hit indexed columns
 * so they should complete well under 5 ms even at 100 k+ rows.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Scan_Logger {

	/**
	 * Log a single scan.
	 *
	 * @param array{
	 *   qr_code_id: int,
	 *   ip_hash: string,
	 *   user_agent: string,
	 *   referrer: string
	 * } $data
	 */
	public static function log( array $data ): void {
		global $wpdb;

		// Silently abort on bad input — logging must never block a redirect.
		if ( empty( $data['qr_code_id'] ) ) {
			return;
		}

		$qr_code_id = (int) $data['qr_code_id'];
		$ip_hash    = (string) $data['ip_hash'];
		$user_agent = (string) $data['user_agent'];
		$referrer   = (string) $data['referrer'];
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$now        = current_time( 'mysql', true ); // UTC

		$scan_type = self::determine_type( $scans_table, $qr_code_id, $ip_hash, $user_agent );

		$wpdb->insert(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$scans_table,
			array(
				'qr_code_id' => $qr_code_id,
				'scanned_at' => $now,
				'ip_hash'    => $ip_hash,
				'user_agent' => $user_agent,
				'referrer'   => $referrer,
				'scan_type'  => $scan_type,
			),
			array( '%d', '%s', '%s', '%s', '%s', '%s' )
		);
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Determine whether this is a 'unique' or 'repeat' scan.
	 *
	 * A scan is 'unique' if the same visitor has not scanned this code
	 * within the last 24 hours.  The composite index (qr_code_id, ip_hash,
	 * scanned_at) makes this lookup a covering-index scan.
	 *
	 * @param string $table
	 * @param int    $qr_code_id
	 * @param string $ip_hash
	 * @param string $user_agent
	 * @return 'unique'|'repeat'
	 */
	private static function determine_type(
		string $table,
		int $qr_code_id,
		string $ip_hash,
		string $user_agent
	): string {
		global $wpdb;

		$since = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );

		$existing = $wpdb->get_var(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT id
				 FROM {$table}
				 WHERE qr_code_id = %d
				   AND ip_hash = %s
				   AND user_agent = %s
				   AND scanned_at >= %s
				 LIMIT 1",
				$qr_code_id,
				$ip_hash,
				$user_agent,
				$since
			)
		);

		return $existing ? 'repeat' : 'unique';
	}
}
