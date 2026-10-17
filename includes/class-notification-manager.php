<?php
/**
 * Per-scan email notification manager.
 *
 * Notifications are always deferred via WP-Cron so they never add latency
 * to the redirect request.  Rate limiting is enforced via transients — if a
 * notification for a code was already queued within the rate-limit window,
 * the new scan is silently skipped.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Notification_Manager {

	/**
	 * Decide whether to queue a notification for this scan.
	 *
	 * Called by Redirect_Handler after the redirect is sent.
	 * Must be fast — it only checks a transient, then schedules an async event.
	 *
	 * @param int                  $qr_code_id
	 * @param array<string, mixed> $code_settings Decoded JSON settings for this code.
	 */
	public static function maybe_schedule( int $qr_code_id, array $code_settings ): void {
		if ( empty( $code_settings['notify_on_scan'] ) ) {
			return;
		}

		$notify_every = max( 1, (int) ( $code_settings['notify_every_x_scans'] ?? 1 ) );

		if ( $notify_every > 1 ) {
			// Count-based: only notify on every Nth scan.
			global $wpdb;
			$total = (int) $wpdb->get_var(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}qrjump_scans WHERE qr_code_id = %d AND is_bot = 0",
					$qr_code_id
				)
			);
			if ( $total % $notify_every !== 0 ) {
				return;
			}
			// Count-based notifications bypass the time-based rate limit.
		} else {
			// Time-based rate limiting (default: notify on every scan, but
			// throttle to at most once per N minutes).
			$rate_limit_minutes = max(
				1,
				(int) ( $code_settings['notify_rate_limit_minutes'] ?? Settings::get( 'notify_rate_limit_minutes' ) )
			);

			$transient_key = 'qrjump_notif_' . $qr_code_id;

			if ( false !== get_transient( $transient_key ) ) {
				return;
			}

			set_transient( $transient_key, 1, $rate_limit_minutes * MINUTE_IN_SECONDS );
		}

		// The timestamp arg makes each event unique — WordPress silently drops a
		// single event identical to one already queued in the last 10 minutes.
		$now = time();
		wp_schedule_single_event( $now, 'qrjump_send_notification', array( $qr_code_id, $now ) );
	}

	/**
	 * Build and send the notification email.
	 *
	 * Called by the 'qrjump_send_notification' WP-Cron hook.
	 * Errors are swallowed — a failed email must never break plugin operation.
	 *
	 * @param int $qr_code_id
	 * @param int $scanned_at Unix timestamp of the scan (0 = unknown, use now).
	 */
	public static function send( int $qr_code_id, int $scanned_at = 0 ): void {
		global $wpdb;

		$code = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT id, title, slug, destination_url, settings
				 FROM {$wpdb->prefix}qrjump_codes
				 WHERE id = %d",
				$qr_code_id
			)
		);

		if ( ! $code ) {
			return;
		}

		$code_settings = $code->settings
			? (array) json_decode( $code->settings, true )
			: array();

		$email = sanitize_email(
			! empty( $code_settings['notify_email'] )
				? $code_settings['notify_email']
				: get_option( 'admin_email' )
		);

		if ( ! $email ) {
			return;
		}

		/* translators: %s: QR code title */
		$subject = sprintf( __( '[QR Jump] Scan detected: %s', 'qr-jump' ), $code->title ?: __( 'Untitled', 'qr-jump' ) );

		$title      = $code->title ?: __( 'Untitled', 'qr-jump' );
		$manage_url = admin_url( 'admin.php?page=qr-jump#/codes/' . $code->id . '/edit' );
		$prefix     = trim( (string) Settings::get( 'redirect_prefix' ), '/' );
		$short_url  = home_url( '/' . $prefix . '/' . $code->slug );
		$scanned_at = $scanned_at > 0 ? $scanned_at : time();
		$when       = wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $scanned_at );

		$counts = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT COUNT(*) AS total, SUM(scan_type = 'unique') AS unique_scans
				 FROM {$wpdb->prefix}qrjump_scans
				 WHERE qr_code_id = %d AND is_bot = 0",
				$qr_code_id
			)
		);

		$is_vcard    = 'vcard' === ( $code_settings['destination_type'] ?? 'url' );
		$destination = $is_vcard ? __( 'Contact card (vCard)', 'qr-jump' ) : (string) $code->destination_url;

		$rows = array(
			__( 'Scanned', 'qr-jump' )     => esc_html( $when ),
			__( 'Short URL', 'qr-jump' )   => esc_html( $short_url ),
			__( 'Destination', 'qr-jump' ) => esc_html( $destination ),
			__( 'Total scans', 'qr-jump' ) => esc_html( number_format_i18n( (int) ( $counts->total ?? 0 ) ) ),
			__( 'Unique scans', 'qr-jump' ) => esc_html( number_format_i18n( (int) ( $counts->unique_scans ?? 0 ) ) ),
		);

		$table = '';
		foreach ( $rows as $label => $value ) {
			$table .= '<tr><td style="padding:6px 12px 6px 0;color:#757575;white-space:nowrap;vertical-align:top;">'
				. esc_html( $label ) . '</td><td style="padding:6px 0;word-break:break-all;">' . $value . '</td></tr>';
		}

		$message = '<!DOCTYPE html>'
			. '<html><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;'
			. 'color:#1e1e1e;font-size:14px;line-height:1.6;max-width:520px;margin:0 auto;padding:24px;">'
			. '<p>Your QR code <strong>' . esc_html( $title ) . '</strong> was just scanned.</p>'
			. '<table style="border-collapse:collapse;font-size:14px;">' . $table . '</table>'
			. '<p style="margin-top:20px;"><a href="' . esc_url( $manage_url ) . '" '
			. 'style="color:#2271b1;text-decoration:none;font-weight:500;">Manage this code</a></p>'
			. '</body></html>';

		$headers = array( 'Content-Type: text/html; charset=UTF-8' );

		// Errors are intentionally ignored — wp_mail returns false on failure.
		wp_mail( $email, $subject, $message, $headers );
	}
}
