<?php
/**
 * Optional scan-history retention.
 *
 * A daily WP-Cron event deletes scans older than the 'retention_days' setting
 * (0 = keep forever). Deletion is batched so a large backlog never holds a
 * long table lock.
 *
 * Note: scan limits and scan counts are based on stored scans, so purging old
 * scans also reduces those counts.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Data_Retention {

	const HOOK       = 'qrjump_purge_old_scans';
	const BATCH_SIZE = 5000;
	const MAX_BATCHES = 20;

	/** Schedule the daily purge if it isn't already. */
	public static function schedule(): void {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::HOOK );
		}
	}

	/** Remove the scheduled purge. */
	public static function unschedule(): void {
		$ts = wp_next_scheduled( self::HOOK );
		if ( $ts ) {
			wp_unschedule_event( $ts, self::HOOK );
		}
	}

	/**
	 * Delete scans older than the retention window. Cron callback.
	 */
	public static function run(): void {
		global $wpdb;

		$days = absint( Settings::get( 'retention_days' ) );
		if ( $days < 1 ) {
			return;
		}

		$cutoff = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );

		for ( $i = 0; $i < self::MAX_BATCHES; $i++ ) {
			$deleted = $wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"DELETE FROM {$wpdb->prefix}qrjump_scans WHERE scanned_at < %s LIMIT %d",
					$cutoff,
					self::BATCH_SIZE
				)
			);
			if ( ! $deleted || $deleted < self::BATCH_SIZE ) {
				break;
			}
		}
	}
}
