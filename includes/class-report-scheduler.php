<?php
/**
 * Scheduled scan report manager.
 *
 * Registers WP-Cron events for daily, weekly, and monthly reports.
 * Each event checks the 'report_schedule' setting before sending, so
 * only one schedule is ever active without needing to de-register events
 * on every settings change.
 *
 * Structured for future swap to Action Scheduler:
 *   • All scheduling is behind static activate/deactivate methods.
 *   • Report building is a pure function with no cron coupling.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Report_Scheduler {

	const DAILY_HOOK   = 'qrjump_daily_report';
	const WEEKLY_HOOK  = 'qrjump_weekly_report';
	const MONTHLY_HOOK = 'qrjump_monthly_report';

	/**
	 * Register all WP-Cron events.
	 *
	 * Called on plugin activation.  wp_next_scheduled() guards against
	 * duplicates if the plugin is re-activated.
	 */
	public static function schedule_all(): void {
		if ( ! wp_next_scheduled( self::DAILY_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::DAILY_HOOK );
		}
		if ( ! wp_next_scheduled( self::WEEKLY_HOOK ) ) {
			wp_schedule_event( time(), 'weekly', self::WEEKLY_HOOK );
		}
		if ( ! wp_next_scheduled( self::MONTHLY_HOOK ) ) {
			wp_schedule_event( time(), 'monthly', self::MONTHLY_HOOK );
		}
	}

	/**
	 * Remove all WP-Cron events.
	 *
	 * Called on plugin deactivation and uninstall.
	 */
	public static function unschedule_all(): void {
		foreach ( array( self::DAILY_HOOK, self::WEEKLY_HOOK, self::MONTHLY_HOOK ) as $hook ) {
			$ts = wp_next_scheduled( $hook );
			if ( $ts ) {
				wp_unschedule_event( $ts, $hook );
			}
		}
	}

	/**
	 * Attach instance callbacks to WordPress hooks.
	 *
	 * Called from Plugin::init().
	 */
	public function register_hooks(): void {
		add_action( self::DAILY_HOOK,        array( $this, 'send_daily_report' ) );
		add_action( self::WEEKLY_HOOK,       array( $this, 'send_weekly_report' ) );
		add_action( self::MONTHLY_HOOK,      array( $this, 'send_monthly_report' ) );
		add_action( 'qrjump_send_notification', array( 'QRJump\\Notification_Manager', 'send' ) );
	}

	// -------------------------------------------------------------------------
	// Cron callbacks
	// -------------------------------------------------------------------------

	public function send_daily_report(): void {
		if ( 'daily' !== Settings::get( 'report_schedule' ) ) {
			return;
		}
		$this->send_report( 'daily', strtotime( '-1 day' ), time() );
	}

	public function send_weekly_report(): void {
		if ( 'weekly' !== Settings::get( 'report_schedule' ) ) {
			return;
		}
		$this->send_report( 'weekly', strtotime( '-1 week' ), time() );
	}

	public function send_monthly_report(): void {
		if ( 'monthly' !== Settings::get( 'report_schedule' ) ) {
			return;
		}
		$this->send_report( 'monthly', strtotime( '-1 month' ), time() );
	}

	// -------------------------------------------------------------------------
	// Private helpers
	// -------------------------------------------------------------------------

	/**
	 * Compile report data and dispatch the email.
	 *
	 * @param string $type 'daily' | 'weekly' | 'monthly'.
	 * @param int    $from Unix timestamp — period start.
	 * @param int    $to   Unix timestamp — period end.
	 */
	private function send_report( string $type, int $from, int $to ): void {
		$email = sanitize_email( (string) Settings::get( 'report_email' ) )
			?: sanitize_email( (string) get_option( 'admin_email' ) );

		if ( ! $email ) {
			return;
		}

		$data = $this->build_report_data( $from, $to );

		/* translators: %s: report type (Daily / Weekly / Monthly) */
		$subject = sprintf( __( '[QR Jump] %s Scan Report', 'qr-jump' ), ucfirst( $type ) );
		$body    = $this->build_email_html( $data, $type );
		$headers = array( 'Content-Type: text/html; charset=UTF-8' );

		// wp_mail failure is intentionally swallowed.
		wp_mail( $email, $subject, $body, $headers );
	}

	/**
	 * Query the database for report metrics.
	 *
	 * @param int $from Unix timestamp.
	 * @param int $to   Unix timestamp.
	 * @return array<string, mixed>
	 */
	private function build_report_data( int $from, int $to ): array {
		global $wpdb;

		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$from_dt     = gmdate( 'Y-m-d H:i:s', $from );
		$to_dt       = gmdate( 'Y-m-d H:i:s', $to );

		$totals = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT
					COUNT(*) AS total,
					SUM(scan_type = 'unique') AS unique_scans,
					SUM(scan_type = 'repeat') AS repeat_scans
				 FROM {$scans_table}
				 WHERE scanned_at BETWEEN %s AND %s",
				$from_dt,
				$to_dt
			)
		);

		$top_codes = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT c.title, c.slug, COUNT(s.id) AS scan_count
				 FROM {$scans_table} s
				 JOIN {$codes_table} c ON c.id = s.qr_code_id
				 WHERE s.scanned_at BETWEEN %s AND %s
				 GROUP BY s.qr_code_id
				 ORDER BY scan_count DESC
				 LIMIT 5",
				$from_dt,
				$to_dt
			)
		);

		return array(
			'totals'    => $totals,
			'top_codes' => $top_codes ?? array(),
			'from'      => $from_dt,
			'to'        => $to_dt,
		);
	}

	/**
	 * Render the report as an HTML email body.
	 *
	 * @param array<string, mixed> $data
	 * @param string               $type
	 * @return string HTML.
	 */
	private function build_email_html( array $data, string $type ): string {
		$totals    = $data['totals'];
		$top_codes = $data['top_codes'];

		ob_start();
		?>
		<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
			<h2 style="border-bottom:2px solid #0073aa;padding-bottom:8px;color:#0073aa">
				<?php
				/* translators: %s: report type */
				printf( esc_html__( 'QR Jump %s Report', 'qr-jump' ), esc_html( ucfirst( $type ) ) );
				?>
			</h2>
			<p style="color:#666;font-size:13px">
				<?php
				printf(
					/* translators: 1: period start, 2: period end */
					esc_html__( 'Period: %1$s to %2$s', 'qr-jump' ),
					esc_html( $data['from'] ),
					esc_html( $data['to'] )
				);
				?>
			</p>

			<h3><?php esc_html_e( 'Summary', 'qr-jump' ); ?></h3>
			<table style="width:100%;border-collapse:collapse">
				<tr>
					<td style="padding:8px;background:#f0f0f0;font-weight:bold"><?php esc_html_e( 'Total Scans', 'qr-jump' ); ?></td>
					<td style="padding:8px;text-align:right"><?php echo (int) $totals->total; ?></td>
				</tr>
				<tr>
					<td style="padding:8px;font-weight:bold"><?php esc_html_e( 'Unique Scans', 'qr-jump' ); ?></td>
					<td style="padding:8px;text-align:right"><?php echo (int) $totals->unique_scans; ?></td>
				</tr>
				<tr>
					<td style="padding:8px;background:#f0f0f0;font-weight:bold"><?php esc_html_e( 'Repeat Scans', 'qr-jump' ); ?></td>
					<td style="padding:8px;text-align:right"><?php echo (int) $totals->repeat_scans; ?></td>
				</tr>
			</table>

			<?php if ( ! empty( $top_codes ) ) : ?>
				<h3><?php esc_html_e( 'Top QR Codes', 'qr-jump' ); ?></h3>
				<table style="width:100%;border-collapse:collapse">
					<thead>
						<tr style="background:#0073aa;color:#fff">
							<th style="padding:8px;text-align:left"><?php esc_html_e( 'Title', 'qr-jump' ); ?></th>
							<th style="padding:8px;text-align:right"><?php esc_html_e( 'Scans', 'qr-jump' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $top_codes as $i => $row ) : ?>
							<tr style="background:<?php echo 0 === $i % 2 ? '#fff' : '#f9f9f9'; ?>">
								<td style="padding:8px"><?php echo esc_html( $row->title ); ?></td>
								<td style="padding:8px;text-align:right"><?php echo (int) $row->scan_count; ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>

			<p style="margin-top:24px;font-size:12px;color:#999">
				<?php
				printf(
					/* translators: %s: admin URL */
					esc_html__( 'Manage your QR codes: %s', 'qr-jump' ),
					'<a href="' . esc_url( admin_url( 'admin.php?page=qr-jump' ) ) . '">'
						. esc_html__( 'QR Jump Dashboard', 'qr-jump' ) . '</a>'
				);
				?>
			</p>
		</div>
		<?php
		return (string) ob_get_clean();
	}
}
