<?php
/**
 * Admin UI registration.
 *
 * Registers the top-level admin menu and enqueues the compiled React
 * application.  All UI logic lives in src/ and is compiled to build/.
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin {

	/**
	 * Register WordPress hooks.
	 *
	 * Called from Plugin::init() only when is_admin() is true.
	 */
	public function register_hooks(): void {
		add_action( 'admin_menu',            array( $this, 'add_menu_pages' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register the top-level admin menu page.
	 */
	public function add_menu_pages(): void {
		add_menu_page(
			__( 'QR Jump', 'qr-jump' ),       // Page title.
			__( 'QR Jump', 'qr-jump' ),       // Menu title.
			'manage_options',                  // Required capability.
			'qr-jump',                         // Menu slug.
			array( $this, 'render_app' ),      // Callback.
			'dashicons-admin-links',           // Icon (closest built-in equivalent).
			56                                 // Position — below WooCommerce (55).
		);
	}

	/**
	 * Enqueue the compiled React application and localised data.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_assets( string $hook ): void {
		// Only load on QR Jump pages.
		if ( false === strpos( $hook, 'qr-jump' ) ) {
			return;
		}

		$asset_file = QRJUMP_PLUGIN_DIR . 'build/index.asset.php';

		if ( ! file_exists( $asset_file ) ) {
			// build/ does not exist — plugin has not been compiled.
			add_action( 'admin_notices', array( $this, 'notice_build_missing' ) );
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			'qrjump-admin',
			QRJUMP_PLUGIN_URL . 'build/index.js',
			$asset['dependencies'],
			$asset['version'],
			true // Load in footer.
		);

		// index.css is produced automatically by @wordpress/scripts.
		if ( file_exists( QRJUMP_PLUGIN_DIR . 'build/index.css' ) ) {
			wp_enqueue_style(
				'qrjump-admin',
				QRJUMP_PLUGIN_URL . 'build/index.css',
				array( 'wp-components' ),
				$asset['version']
			);
		}

		// Pass runtime data to the React app.
		wp_localize_script(
			'qrjump-admin',
			'qrJumpData',
			array(
				'apiUrl'        => rest_url( 'qrjump/v1' ),
				'nonce'         => wp_create_nonce( 'wp_rest' ),
				'version'       => QRJUMP_VERSION,
				'homeUrl'       => home_url(),
				'adminUrl'      => admin_url(),
				'redirectPrefix' => Settings::get( 'redirect_prefix' ),
			)
		);
	}

	/**
	 * Render the React app mount point.
	 *
	 * All UI is owned by React — this method only outputs the root element.
	 */
	public function render_app(): void {
		echo '<div id="qrjump-app"></div>';
	}

	/**
	 * Admin notice shown when the plugin has not been compiled.
	 */
	public function notice_build_missing(): void {
		?>
		<div class="notice notice-error">
			<p>
				<?php
				echo wp_kses(
					__( '<strong>QR Jump:</strong> The admin interface has not been compiled. Run <code>npm install && npm run build</code> from the plugin directory.', 'qr-jump' ),
					array(
						'strong' => array(),
						'code'   => array(),
					)
				);
				?>
			</p>
		</div>
		<?php
	}
}
