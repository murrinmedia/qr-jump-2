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

		$rate_limit_minutes = max(
			1,
			(int) ( $code_settings['notify_rate_limit_minutes'] ?? Settings::get( 'notify_rate_limit_minutes' ) )
		);

		$transient_key = 'qrjump_notif_' . $qr_code_id;

		// Transient present → within rate-limit window, skip.
		if ( false !== get_transient( $transient_key ) ) {
			return;
		}

		// Set the rate-limit guard BEFORE scheduling to avoid race conditions
		// on high-traffic sites where two requests arrive simultaneously.
		set_transient( $transient_key, 1, $rate_limit_minutes * MINUTE_IN_SECONDS );

		// Fire-and-forget: runs on the next WP-Cron execution.
		wp_schedule_single_event( time(), 'qrjump_send_notification', array( $qr_code_id ) );
	}

	/**
	 * Build and send the notification email.
	 *
	 * Called by the 'qrjump_send_notification' WP-Cron hook.
	 * Errors are swallowed — a failed email must never break plugin operation.
	 *
	 * @param int $qr_code_id
	 */
	public static function send( int $qr_code_id ): void {
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

		$prefix    = (string) Settings::get( 'redirect_prefix' );
		$short_url = home_url( '/' . $prefix . '/' . $code->slug );

		/* translators: %s: QR code title */
		$subject = sprintf( __( '[QR Jump] Scan detected: %s', 'qr-jump' ), $code->title );

		$message = sprintf(
			/* translators: 1: QR code title, 2: short URL, 3: destination URL, 4: admin URL */
			__( "Your QR code \"%1\$s\" was just scanned.\n\nShort URL: %2\$s\nDestination: %3\$s\n\nManage your QR codes: %4\$s", 'qr-jump' ),
			$code->title,
			$short_url,
			$code->destination_url,
			admin_url( 'admin.php?page=qr-jump' )
		);

		// Errors are intentionally ignored — wp_mail returns false on failure.
		wp_mail( $email, $subject, $message );
	}
}
