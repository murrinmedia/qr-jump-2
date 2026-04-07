<?php
/**
 * REST API controller.
 *
 * Registers and handles all qrjump/v1 endpoints.
 * Every endpoint requires the 'manage_options' capability and a valid
 * wp_rest nonce (X-WP-Nonce header).
 *
 * Endpoint map
 * ──────────────────────────────────────────────────────────────────────
 * GET    /codes                     List codes (paginated, search, sort)
 * POST   /codes                     Create code
 * GET    /codes/{id}                Single code + aggregate stats
 * PUT    /codes/{id}                Update code (partial — only sent fields)
 * DELETE /codes/{id}                Delete code and its scan history
 * GET    /codes/{id}/stats          Detailed stats + 30-day daily breakdown
 * GET    /codes/{id}/qr             Serve QR image (PNG or SVG; ?fg_colour/?bg_colour override stored colours)
 * GET    /qr-preview               Generate preview QR for any URL (used before save)
 * GET    /dashboard                 Aggregate dashboard data
 * GET    /settings                  Plugin settings
 * POST   /settings                  Update plugin settings
 * POST   /slugs/validate            Check slug availability
 * ──────────────────────────────────────────────────────────────────────
 *
 * @package QRJump
 */

namespace QRJump;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class REST_Controller {

	const REST_NAMESPACE = 'qrjump/v1';

	/**
	 * Register all routes.
	 *
	 * Hooked to 'rest_api_init'.
	 */
	public function register_routes(): void {
		// Collection + creation.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_codes' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
					'args'                => $this->list_args(),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_code' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
					'args'                => $this->code_args( true ),
				),
			)
		);

		// Single-resource operations.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/(?P<id>[\d]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_code' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
				),
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_code' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
					'args'                => $this->code_args( false ),
				),
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_code' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
				),
			)
		);

		// Detailed stats for one code.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/(?P<id>[\d]+)/stats',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_code_stats' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
			)
		);

		// QR image endpoint — serves binary output directly.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/(?P<id>[\d]+)/qr',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_qr_image' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
				'args'                => array(
					'format' => array(
						'default'           => 'png',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => static function ( $value ): bool {
							return in_array( $value, array( 'png', 'svg' ), true );
						},
					),
					'size' => array(
						'default'           => 1000,
						'sanitize_callback' => 'absint',
					),
					'download' => array(
						'default'           => false,
						'sanitize_callback' => 'rest_sanitize_boolean',
					),
					// Optional colour overrides — used by the live admin preview.
					'fg_colour' => array(
						'default'           => null,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'bg_colour' => array(
						'default'           => null,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		// QR preview for unsaved codes — generates a QR for any valid URL.
		register_rest_route(
			self::REST_NAMESPACE,
			'/qr-preview',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_qr_preview' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
				'args'                => array(
					'url' => array(
						'required'          => true,
						'sanitize_callback' => static function ( $v ) { return trim( (string) $v ); },
					),
					'format' => array(
						'default'           => 'png',
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => static function ( $v ): bool {
							return in_array( $v, array( 'png', 'svg' ), true );
						},
					),
					'size' => array(
						'default'           => 300,
						'sanitize_callback' => 'absint',
					),
					'fg_colour' => array(
						'default'           => '#000000',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'bg_colour' => array(
						'default'           => '#ffffff',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		// Reset scan history for one code.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/(?P<id>[\d]+)/scans',
			array(
				'methods'             => \WP_REST_Server::DELETABLE,
				'callback'            => array( $this, 'reset_code_scans' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
			)
		);

		// Duplicate a code.
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/(?P<id>[\d]+)/duplicate',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'duplicate_code' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
			)
		);

		// Bulk actions (delete / activate / deactivate).
		register_rest_route(
			self::REST_NAMESPACE,
			'/codes/bulk',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'bulk_action' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
				'args'                => array(
					'action' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
						'validate_callback' => static function ( $v ): bool {
							return in_array( $v, array( 'delete', 'activate', 'deactivate' ), true );
						},
					),
					'ids' => array(
						'required'          => true,
						'validate_callback' => static function ( $v ): bool {
							return is_array( $v ) && count( $v ) > 0;
						},
					),
				),
			)
		);

		// Dashboard aggregate data.
		register_rest_route(
			self::REST_NAMESPACE,
			'/dashboard',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_dashboard' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
			)
		);

		// Plugin settings.
		register_rest_route(
			self::REST_NAMESPACE,
			'/settings',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_settings' ),
					'permission_callback' => array( $this, 'admin_permissions' ),
				),
			)
		);

		// Slug availability check (used by the live slug input in the editor).
		register_rest_route(
			self::REST_NAMESPACE,
			'/slugs/validate',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'validate_slug' ),
				'permission_callback' => array( $this, 'admin_permissions' ),
				'args'                => array(
					'slug'       => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'exclude_id' => array(
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	// =========================================================================
	// Permission callback
	// =========================================================================

	/**
	 * All endpoints require manage_options capability.
	 *
	 * @return bool|\WP_Error
	 */
	public function admin_permissions() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to access this endpoint.', 'qr-jump' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	// =========================================================================
	// Codes — list
	// =========================================================================

	/**
	 * GET /codes
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function get_codes( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';

		$per_page = min( absint( $request->get_param( 'per_page' ) ?: 20 ), 100 );
		$page     = max( 1, absint( $request->get_param( 'page' ) ?: 1 ) );
		$search   = sanitize_text_field( (string) ( $request->get_param( 'search' ) ?? '' ) );
		$status   = $request->get_param( 'status' );
		$orderby  = $this->validate_orderby( (string) ( $request->get_param( 'orderby' ) ?? 'created_at' ) );
		$order    = 'ASC' === strtoupper( (string) ( $request->get_param( 'order' ) ?? '' ) ) ? 'ASC' : 'DESC';
		$offset   = ( $page - 1 ) * $per_page;

		// Build WHERE clause dynamically.
		$wheres = array( '1=1' );
		$args   = array();

		if ( '' !== $search ) {
			$wheres[] = '(title LIKE %s OR slug LIKE %s OR destination_url LIKE %s)';
			$like     = '%' . $wpdb->esc_like( $search ) . '%';
			$args[]   = $like;
			$args[]   = $like;
			$args[]   = $like;
		}

		if ( null !== $status && 'all' !== $status ) {
			$wheres[] = 'status = %d';
			$args[]   = (int) $status;
		}

		$where_sql = implode( ' AND ', $wheres );

		// Total count.
		$count_sql = "SELECT COUNT(*) FROM {$codes_table} WHERE {$where_sql}";
		$total     = (int) (
			$args
				? $wpdb->get_var( $wpdb->prepare( $count_sql, $args ) )  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				: $wpdb->get_var( $count_sql )                            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		);

		// Page of results.
		// $orderby is whitelisted via validate_orderby() so direct interpolation is safe.
		$data_sql = "SELECT * FROM {$codes_table} WHERE {$where_sql} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d";
		$data_args = array_merge( $args, array( $per_page, $offset ) );
		$codes     = $wpdb->get_results( $wpdb->prepare( $data_sql, $data_args ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Batch-load scan counts to avoid N+1 queries.
		$scan_counts = array();
		if ( ! empty( $codes ) ) {
			$ids          = wp_list_pluck( $codes, 'id' );
			$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
			$scan_rows    = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT qr_code_id, COUNT(*) AS total, MAX(scanned_at) AS last_scanned_at
					 FROM {$scans_table}
					 WHERE qr_code_id IN ({$placeholders})
					 GROUP BY qr_code_id",
					$ids
				)
			);
			foreach ( $scan_rows as $row ) {
				$scan_counts[ (int) $row->qr_code_id ] = array(
					'total'           => (int) $row->total,
					'last_scanned_at' => $row->last_scanned_at,
				);
			}
		}

		$items = array_map(
			function ( $code ) use ( $scan_counts ) {
				$item                    = $this->prepare_code( $code );
				$id                      = (int) $code->id;
				$item['total_scans']     = $scan_counts[ $id ]['total'] ?? 0;
				$item['last_scanned_at'] = $scan_counts[ $id ]['last_scanned_at'] ?? null;
				return $item;
			},
			$codes ?? array()
		);

		$response = rest_ensure_response( $items );
		$response->header( 'X-WP-Total', $total );
		$response->header( 'X-WP-TotalPages', (int) ceil( $total / $per_page ) );

		return $response;
	}

	// =========================================================================
	// Codes — create
	// =========================================================================

	/**
	 * POST /codes
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_code( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table     = $wpdb->prefix . 'qrjump_codes';
		$destination_url = $this->sanitize_destination( (string) $request->get_param( 'destination_url' ) );

		if ( ! $this->is_valid_destination( $destination_url ) ) {
			return new \WP_Error(
				'qrjump_invalid_url',
				__( 'Destination URL must be a valid http or https URL.', 'qr-jump' ),
				array( 'status' => 400 )
			);
		}

		// Slug handling.
		$slug_input = $request->get_param( 'slug' );
		if ( $slug_input ) {
			$slug = $this->clean_slug( (string) $slug_input );
			if ( strlen( $slug ) < 1 ) {
				return new \WP_Error(
					'qrjump_invalid_slug',
					__( 'Slug must contain at least one valid character (a–z, 0–9, -).', 'qr-jump' ),
					array( 'status' => 400 )
				);
			}
			if ( ! $this->slug_is_available( $slug ) ) {
				return new \WP_Error(
					'qrjump_slug_taken',
					__( 'That slug is already in use. Please choose another.', 'qr-jump' ),
					array( 'status' => 409 )
				);
			}
		} else {
			$slug = $this->generate_slug();
		}

		$now  = current_time( 'mysql', true );
		$data = array(
			'title'           => sanitize_text_field( (string) $request->get_param( 'title' ) ),
			'slug'            => $slug,
			'destination_url' => $destination_url,
			'status'          => $request->get_param( 'status' ) ? 1 : 0,
			'redirect_type'   => $this->clean_redirect_type( (int) $request->get_param( 'redirect_type' ) ),
			'fg_colour'       => $this->clean_colour( (string) ( $request->get_param( 'fg_colour' ) ?? '#000000' ) ),
			'bg_colour'       => $this->clean_colour( (string) ( $request->get_param( 'bg_colour' ) ?? '#ffffff' ) ),
			'notes'           => sanitize_textarea_field( (string) ( $request->get_param( 'notes' ) ?? '' ) ),
			'settings'        => wp_json_encode( $this->clean_code_settings( (array) ( $request->get_param( 'settings' ) ?? array() ) ) ),
			'created_at'      => $now,
			'updated_at'      => $now,
		);

		$inserted = $wpdb->insert( $codes_table, $data );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( false === $inserted ) {
			return new \WP_Error(
				'qrjump_db_error',
				__( 'Failed to save QR code. Please try again.', 'qr-jump' ),
				array( 'status' => 500 )
			);
		}

		$new_id = (int) $wpdb->insert_id;
		$code   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$codes_table} WHERE id = %d", $new_id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Purge any cached copy of the new short URL.
		Cache_Purger::purge_url( $code->slug );

		return rest_ensure_response( $this->prepare_code( $code ) );
	}

	// =========================================================================
	// Codes — read single
	// =========================================================================

	/**
	 * GET /codes/{id}
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_code( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$id          = absint( $request->get_param( 'id' ) );

		$code = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $code ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$response = $this->prepare_code( $code );

		// Inline aggregate stats for the single-code view.
		$stats = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT COUNT(*) AS total,
					SUM(scan_type = 'unique') AS unique_scans,
					SUM(scan_type = 'repeat') AS repeat_scans,
					MAX(scanned_at) AS last_scanned_at
				 FROM {$scans_table}
				 WHERE qr_code_id = %d",
				$id
			)
		);

		$response['total_scans']     = (int) ( $stats->total ?? 0 );
		$response['unique_scans']    = (int) ( $stats->unique_scans ?? 0 );
		$response['repeat_scans']    = (int) ( $stats->repeat_scans ?? 0 );
		$response['last_scanned_at'] = $stats->last_scanned_at ?? null;

		return rest_ensure_response( $response );
	}

	// =========================================================================
	// Codes — update
	// =========================================================================

	/**
	 * PUT /codes/{id}
	 *
	 * Partial update — only fields present in the request body are written.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_code( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$id          = absint( $request->get_param( 'id' ) );

		$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $existing ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$data = array();

		if ( $request->has_param( 'title' ) ) {
			$data['title'] = sanitize_text_field( (string) $request->get_param( 'title' ) );
		}

		if ( $request->has_param( 'destination_url' ) ) {
			$url = $this->sanitize_destination( (string) $request->get_param( 'destination_url' ) );
			if ( ! $this->is_valid_destination( $url ) ) {
				return new \WP_Error(
					'qrjump_invalid_url',
					__( 'Destination URL must be a valid http or https URL.', 'qr-jump' ),
					array( 'status' => 400 )
				);
			}
			$data['destination_url'] = $url;
		}

		if ( $request->has_param( 'slug' ) ) {
			$slug = $this->clean_slug( (string) $request->get_param( 'slug' ) );
			if ( strlen( $slug ) < 1 ) {
				return new \WP_Error(
					'qrjump_invalid_slug',
					__( 'Slug must contain at least one valid character (a–z, 0–9, -).', 'qr-jump' ),
					array( 'status' => 400 )
				);
			}
			// Only check uniqueness when the slug actually changes.
			if ( $slug !== $existing->slug && ! $this->slug_is_available( $slug, $id ) ) {
				return new \WP_Error(
					'qrjump_slug_taken',
					__( 'That slug is already in use. Please choose another.', 'qr-jump' ),
					array( 'status' => 409 )
				);
			}
			$data['slug'] = $slug;
		}

		if ( $request->has_param( 'status' ) ) {
			$data['status'] = $request->get_param( 'status' ) ? 1 : 0;
		}

		if ( $request->has_param( 'redirect_type' ) ) {
			$data['redirect_type'] = $this->clean_redirect_type( (int) $request->get_param( 'redirect_type' ) );
		}

		if ( $request->has_param( 'fg_colour' ) ) {
			$data['fg_colour'] = $this->clean_colour( (string) $request->get_param( 'fg_colour' ) );
		}

		if ( $request->has_param( 'bg_colour' ) ) {
			$data['bg_colour'] = $this->clean_colour( (string) $request->get_param( 'bg_colour' ) );
		}

		if ( $request->has_param( 'notes' ) ) {
			$data['notes'] = sanitize_textarea_field( (string) $request->get_param( 'notes' ) );
		}

		if ( $request->has_param( 'settings' ) ) {
			$data['settings'] = wp_json_encode( $this->clean_code_settings( (array) $request->get_param( 'settings' ) ) );
		}

		// Nothing to update — return the existing record.
		if ( empty( $data ) ) {
			return $this->get_code( $request );
		}

		$data['updated_at'] = current_time( 'mysql', true );

		$updated = $wpdb->update( $codes_table, $data, array( 'id' => $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( false === $updated ) {
			return new \WP_Error(
				'qrjump_db_error',
				__( 'Failed to update QR code. Please try again.', 'qr-jump' ),
				array( 'status' => 500 )
			);
		}

		// Purge cached copy — destination or status may have changed.
		Cache_Purger::purge_url( $existing->slug );

		return $this->get_code( $request );
	}

	// =========================================================================
	// Codes — delete
	// =========================================================================

	/**
	 * DELETE /codes/{id}
	 *
	 * Permanently removes the code and all its associated scan records.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_code( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$id          = absint( $request->get_param( 'id' ) );

		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $exists ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$slug = $wpdb->get_var( $wpdb->prepare( "SELECT slug FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Delete scan history first.
		$wpdb->delete( $scans_table, array( 'qr_code_id' => $id ), array( '%d' ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Delete the code record.
		$wpdb->delete( $codes_table, array( 'id' => $id ), array( '%d' ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		// Purge cached copy so the URL returns 404 rather than stale content.
		if ( $slug ) {
			Cache_Purger::purge_url( (string) $slug );
		}

		return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
	}

	// =========================================================================
	// Codes — reset scans
	// =========================================================================

	/**
	 * DELETE /codes/{id}/scans
	 *
	 * Deletes all scan records for a code without deleting the code itself.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function reset_code_scans( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$id          = absint( $request->get_param( 'id' ) );

		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $exists ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$wpdb->delete( $scans_table, array( 'qr_code_id' => $id ), array( '%d' ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		return rest_ensure_response( array( 'reset' => true, 'id' => $id ) );
	}

	// =========================================================================
	// Codes — duplicate
	// =========================================================================

	/**
	 * POST /codes/{id}/duplicate
	 *
	 * Creates a copy of the code with a new auto-generated slug.
	 * Scan history is NOT copied.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function duplicate_code( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$id          = absint( $request->get_param( 'id' ) );

		$original = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $original ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$now  = current_time( 'mysql', true );
		$data = array(
			'title'           => $original->title ? $original->title . ' (copy)' : '',
			'slug'            => $this->generate_slug(),
			'destination_url' => $original->destination_url,
			'status'          => (int) $original->status,
			'redirect_type'   => (int) $original->redirect_type,
			'fg_colour'       => $original->fg_colour,
			'bg_colour'       => $original->bg_colour,
			'notes'           => $original->notes ?? '',
			'settings'        => $original->settings,
			'created_at'      => $now,
			'updated_at'      => $now,
		);

		$inserted = $wpdb->insert( $codes_table, $data );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( false === $inserted ) {
			return new \WP_Error( 'qrjump_db_error', __( 'Failed to duplicate QR code.', 'qr-jump' ), array( 'status' => 500 ) );
		}

		$new_id = (int) $wpdb->insert_id;
		$code   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$codes_table} WHERE id = %d", $new_id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		Cache_Purger::purge_url( $code->slug );

		return rest_ensure_response( $this->prepare_code( $code ) );
	}

	// =========================================================================
	// Codes — bulk actions
	// =========================================================================

	/**
	 * POST /codes/bulk
	 *
	 * Performs a bulk action on multiple codes.
	 * action: 'delete' | 'activate' | 'deactivate'
	 * ids:    array of integer code IDs
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function bulk_action( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$action      = sanitize_text_field( (string) $request->get_param( 'action' ) );
		$ids         = array_map( 'absint', (array) $request->get_param( 'ids' ) );
		$ids         = array_filter( $ids );

		if ( empty( $ids ) ) {
			return new \WP_Error( 'qrjump_invalid', __( 'No valid IDs provided.', 'qr-jump' ), array( 'status' => 400 ) );
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );

		if ( 'delete' === $action ) {
			// Fetch slugs for cache purging before deletion.
			$slugs = $wpdb->get_col(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare( "SELECT slug FROM {$codes_table} WHERE id IN ({$placeholders})", ...$ids )
			);

			$wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare( "DELETE FROM {$scans_table} WHERE qr_code_id IN ({$placeholders})", ...$ids )
			);
			$wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare( "DELETE FROM {$codes_table} WHERE id IN ({$placeholders})", ...$ids )
			);

			foreach ( $slugs as $slug ) {
				Cache_Purger::purge_url( $slug );
			}
		} elseif ( 'activate' === $action ) {
			$wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare( "UPDATE {$codes_table} SET status = 1, updated_at = %s WHERE id IN ({$placeholders})", current_time( 'mysql', true ), ...$ids )
			);
		} elseif ( 'deactivate' === $action ) {
			$wpdb->query(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare( "UPDATE {$codes_table} SET status = 0, updated_at = %s WHERE id IN ({$placeholders})", current_time( 'mysql', true ), ...$ids )
			);
		}

		return rest_ensure_response( array( 'action' => $action, 'ids' => $ids, 'count' => count( $ids ) ) );
	}

	// =========================================================================
	// Codes — stats
	// =========================================================================

	/**
	 * GET /codes/{id}/stats
	 *
	 * Returns aggregate totals and a 30-day daily breakdown.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_code_stats( \WP_REST_Request $request ) {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';
		$id          = absint( $request->get_param( 'id' ) );

		$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$codes_table} WHERE id = %d", $id ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		if ( ! $exists ) {
			return new \WP_Error( 'qrjump_not_found', __( 'QR code not found.', 'qr-jump' ), array( 'status' => 404 ) );
		}

		$totals = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT
					COUNT(*) AS total,
					SUM(scan_type = 'unique') AS unique_scans,
					SUM(scan_type = 'repeat') AS repeat_scans,
					MAX(scanned_at) AS last_scanned_at
				 FROM {$scans_table}
				 WHERE qr_code_id = %d",
				$id
			)
		);

		$since = gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) );
		$daily = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT DATE(scanned_at) AS date, COUNT(*) AS scans,
					SUM(scan_type = 'unique') AS unique_scans
				 FROM {$scans_table}
				 WHERE qr_code_id = %d AND scanned_at >= %s
				 GROUP BY DATE(scanned_at)
				 ORDER BY date ASC",
				$id,
				$since
			)
		);

		$hourly = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT HOUR(scanned_at) AS hour, COUNT(*) AS scans
				 FROM {$scans_table}
				 WHERE qr_code_id = %d AND scanned_at >= %s
				 GROUP BY HOUR(scanned_at)
				 ORDER BY hour ASC",
				$id,
				$since
			)
		);

		$referrers = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT referrer, COUNT(*) AS scans
				 FROM {$scans_table}
				 WHERE qr_code_id = %d AND referrer != ''
				 GROUP BY referrer
				 ORDER BY scans DESC
				 LIMIT 10",
				$id
			)
		);

		return rest_ensure_response(
			array(
				'total'           => (int) ( $totals->total ?? 0 ),
				'unique_scans'    => (int) ( $totals->unique_scans ?? 0 ),
				'repeat_scans'    => (int) ( $totals->repeat_scans ?? 0 ),
				'last_scanned_at' => $totals->last_scanned_at ?? null,
				'daily'           => $daily ?? array(),
				'hourly'          => $hourly ?? array(),
				'referrers'       => $referrers ?? array(),
			)
		);
	}

	// =========================================================================
	// QR image
	// =========================================================================

	/**
	 * GET /codes/{id}/qr
	 *
	 * Generates and streams a QR code image.  Bypasses WP REST JSON response
	 * handling to serve the binary output directly.
	 *
	 * Supports ?format=png|svg, ?size=<px>, ?download=true.
	 * Optional ?fg_colour and ?bg_colour override the stored colours (used for
	 * the live preview in the admin editor).
	 * Nonce verification is handled by WP REST before this callback fires.
	 *
	 * @param \WP_REST_Request $request
	 */
	public function get_qr_image( \WP_REST_Request $request ): void {
		global $wpdb;

		$id     = absint( $request->get_param( 'id' ) );
		$format = $request->get_param( 'format' ) ?? 'png';
		$size   = min( max( absint( $request->get_param( 'size' ) ?? 1000 ), 100 ), 2000 );
		$dl     = (bool) $request->get_param( 'download' );

		$code = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT id, title, slug, fg_colour, bg_colour FROM {$wpdb->prefix}qrjump_codes WHERE id = %d",
				$id
			)
		);

		if ( ! $code ) {
			wp_send_json_error( array( 'message' => __( 'QR code not found.', 'qr-jump' ) ), 404 );
		}

		// Allow colour overrides from query params (live preview without saving).
		$fg_colour = $request->get_param( 'fg_colour' )
			? $this->clean_colour( (string) $request->get_param( 'fg_colour' ), $code->fg_colour )
			: $code->fg_colour;
		$bg_colour = $request->get_param( 'bg_colour' )
			? $this->clean_colour( (string) $request->get_param( 'bg_colour' ), $code->bg_colour )
			: $code->bg_colour;

		$prefix    = (string) Settings::get( 'redirect_prefix' );
		$short_url = home_url( '/' . $prefix . '/' . $code->slug );

		try {
			$image_data = QR_Generator::generate( $short_url, $format, $fg_colour, $bg_colour, $size );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}

		$mime     = QR_Generator::get_mime_type( $format );
		$filename = sanitize_file_name( $code->slug . '.' . $format );

		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . strlen( $image_data ) );
		header( 'Cache-Control: private, max-age=30' );

		if ( $dl ) {
			header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
		} else {
			header( 'Content-Disposition: inline' );
		}

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $image_data;
		exit;
	}

	/**
	 * GET /qr-preview
	 *
	 * Generates a QR preview for any valid URL without requiring a saved code.
	 * Used in the admin editor for new codes before they are saved, and for
	 * live colour-change previews.
	 *
	 * @param \WP_REST_Request $request
	 */
	public function get_qr_preview( \WP_REST_Request $request ): void {
		$url       = (string) $request->get_param( 'url' );
		$format    = $request->get_param( 'format' ) ?? 'png';
		$size      = min( max( absint( $request->get_param( 'size' ) ?? 300 ), 100 ), 2000 );
		$fg_colour = $this->clean_colour( (string) ( $request->get_param( 'fg_colour' ) ?? '#000000' ) );
		$bg_colour = $this->clean_colour( (string) ( $request->get_param( 'bg_colour' ) ?? '#ffffff' ), '#ffffff' );

		if ( ! $this->is_valid_destination( $url ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid URL for QR preview.', 'qr-jump' ) ), 400 );
		}

		try {
			$image_data = QR_Generator::generate( $url, $format, $fg_colour, $bg_colour, $size );
		} catch ( \Exception $e ) {
			wp_send_json_error( array( 'message' => $e->getMessage() ), 500 );
		}

		header( 'Content-Type: ' . QR_Generator::get_mime_type( $format ) );
		header( 'Content-Length: ' . strlen( $image_data ) );
		header( 'Cache-Control: private, max-age=30' );
		header( 'Content-Disposition: inline' );

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $image_data;
		exit;
	}

	// =========================================================================
	// Dashboard
	// =========================================================================

	/**
	 * GET /dashboard
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function get_dashboard( \WP_REST_Request $request ): \WP_REST_Response {
		global $wpdb;

		$codes_table = $wpdb->prefix . 'qrjump_codes';
		$scans_table = $wpdb->prefix . 'qrjump_scans';

		$totals = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT COUNT(*) AS total,
				SUM(scan_type = 'unique') AS unique_scans,
				SUM(scan_type = 'repeat') AS repeat_scans
			 FROM {$scans_table}"
		);

		$total_codes  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$codes_table}" );          // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$active_codes = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$codes_table} WHERE status = 1" );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		$top_codes = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT c.id, c.title, c.slug,
			        COUNT(s.id) AS total_scans,
			        SUM(s.scan_type = 'unique') AS unique_scans
			 FROM {$scans_table} s
			 JOIN {$codes_table} c ON c.id = s.qr_code_id
			 GROUP BY s.qr_code_id
			 ORDER BY total_scans DESC
			 LIMIT 5"
		);

		$recent_scans = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT s.qr_code_id, s.scanned_at, s.scan_type,
			        c.title AS code_title, c.slug
			 FROM {$scans_table} s
			 JOIN {$codes_table} c ON c.id = s.qr_code_id
			 ORDER BY s.scanned_at DESC
			 LIMIT 10"
		);

		$since = gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) );
		$daily = $wpdb->get_results(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT DATE(scanned_at) AS date, COUNT(*) AS scans
				 FROM {$scans_table}
				 WHERE scanned_at >= %s
				 GROUP BY DATE(scanned_at)
				 ORDER BY date ASC",
				$since
			)
		);

		return rest_ensure_response(
			array(
				'total_scans'   => (int) ( $totals->total ?? 0 ),
				'unique_scans'  => (int) ( $totals->unique_scans ?? 0 ),
				'repeat_scans'  => (int) ( $totals->repeat_scans ?? 0 ),
				'total_codes'   => $total_codes,
				'active_codes'  => $active_codes,
				'top_codes'     => $top_codes ?? array(),
				'recent_scans'  => $recent_scans ?? array(),
				'daily'         => $daily ?? array(),
			)
		);
	}

	// =========================================================================
	// Settings
	// =========================================================================

	/**
	 * GET /settings
	 *
	 * @return \WP_REST_Response
	 */
	public function get_settings(): \WP_REST_Response {
		return rest_ensure_response( Settings::get_all() );
	}

	/**
	 * POST /settings
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_settings( \WP_REST_Request $request ) {
		$body = $request->get_json_params();

		if ( empty( $body ) ) {
			return new \WP_Error(
				'qrjump_no_data',
				__( 'No settings provided.', 'qr-jump' ),
				array( 'status' => 400 )
			);
		}

		$sanitizers = array(
			'redirect_prefix'           => static function ( $v ) {
				$v = strtolower( sanitize_text_field( (string) $v ) );
				$v = trim( $v, '/' );
				$v = preg_replace( '/[^a-z0-9\-_]/', '', $v );
				return $v ?: 'go';
			},
			'disabled_behavior'         => static function ( $v ) {
				return in_array( $v, array( '404', 'message' ), true ) ? $v : '404';
			},
			'disabled_message'          => 'sanitize_textarea_field',
			'report_schedule'           => static function ( $v ) {
				return in_array( $v, array( 'none', 'daily', 'weekly', 'monthly' ), true ) ? $v : 'none';
			},
			'report_email'              => 'sanitize_email',
			'notify_rate_limit_minutes' => static function ( $v ) {
				return max( 1, absint( $v ) );
			},
		);

		foreach ( $sanitizers as $key => $fn ) {
			if ( array_key_exists( $key, $body ) ) {
				Settings::set( $key, $fn( $body[ $key ] ) );
			}
		}

		return rest_ensure_response( Settings::get_all() );
	}

	// =========================================================================
	// Slug validation
	// =========================================================================

	/**
	 * POST /slugs/validate
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function validate_slug( \WP_REST_Request $request ): \WP_REST_Response {
		$slug       = $this->clean_slug( (string) $request->get_param( 'slug' ) );
		$exclude_id = absint( $request->get_param( 'exclude_id' ) );

		if ( strlen( $slug ) < 1 ) {
			return rest_ensure_response(
				array(
					'valid'   => false,
					'slug'    => $slug,
					'message' => __( 'Slug must contain at least one valid character (a–z, 0–9, -).', 'qr-jump' ),
				)
			);
		}

		$available = $this->slug_is_available( $slug, $exclude_id );

		return rest_ensure_response(
			array(
				'valid'   => $available,
				'slug'    => $slug,
				'message' => $available ? '' : __( 'That slug is already in use.', 'qr-jump' ),
			)
		);
	}

	// =========================================================================
	// Private helpers
	// =========================================================================

	/**
	 * Shape a code DB row into an API response array.
	 *
	 * @param object $code
	 * @return array<string, mixed>
	 */
	private function prepare_code( object $code ): array {
		return array(
			'id'              => (int) $code->id,
			'title'           => $code->title,
			'slug'            => $code->slug,
			'destination_url' => $code->destination_url,
			'status'          => (int) $code->status,
			'redirect_type'   => (int) $code->redirect_type,
			'fg_colour'       => $code->fg_colour,
			'bg_colour'       => $code->bg_colour,
			'notes'           => $code->notes ?? '',
			'settings'        => $code->settings
				? (array) json_decode( $code->settings, true )
				: $this->default_code_settings(),
			'created_at'      => $code->created_at,
			'updated_at'      => $code->updated_at,
			'short_url'       => home_url( '/' . Settings::get( 'redirect_prefix' ) . '/' . $code->slug ),
		);
	}

	/**
	 * Default notification settings for a new code.
	 *
	 * @return array<string, mixed>
	 */
	private function default_code_settings(): array {
		return array(
			'notify_on_scan'            => false,
			'notify_email'              => '',
			'notify_rate_limit_minutes' => (int) Settings::get( 'notify_rate_limit_minutes' ),
		);
	}

	/**
	 * Sanitize and validate per-code notification settings.
	 *
	 * @param array<string, mixed> $raw
	 * @return array<string, mixed>
	 */
	private function clean_code_settings( array $raw ): array {
		return array(
			'notify_on_scan'            => ! empty( $raw['notify_on_scan'] ),
			'notify_email'              => sanitize_email( (string) ( $raw['notify_email'] ?? '' ) ),
			'notify_rate_limit_minutes' => max( 1, absint( $raw['notify_rate_limit_minutes'] ?? Settings::get( 'notify_rate_limit_minutes' ) ) ),
		);
	}

	/**
	 * Sanitize a slug to the allowed character set.
	 *
	 * @param string $slug
	 * @return string Cleaned slug, max 32 chars.
	 */
	private function clean_slug( string $slug ): string {
		$slug = strtolower( sanitize_text_field( $slug ) );
		$slug = preg_replace( '/[^a-z0-9\-]/', '', $slug );
		return substr( (string) $slug, 0, 32 );
	}

	/**
	 * Check whether a slug is available in the database.
	 *
	 * @param string $slug
	 * @param int    $exclude_id Exclude this record ID (used when updating).
	 * @return bool
	 */
	private function slug_is_available( string $slug, int $exclude_id = 0 ): bool {
		global $wpdb;

		if ( $exclude_id > 0 ) {
			$exists = $wpdb->get_var(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT id FROM {$wpdb->prefix}qrjump_codes WHERE slug = %s AND id != %d LIMIT 1",
					$slug,
					$exclude_id
				)
			);
		} else {
			$exists = $wpdb->get_var(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT id FROM {$wpdb->prefix}qrjump_codes WHERE slug = %s LIMIT 1",
					$slug
				)
			);
		}

		return null === $exists;
	}

	/**
	 * Auto-generate a unique, URL-safe slug.
	 *
	 * @return string 8-character slug guaranteed to be unique.
	 */
	private function generate_slug(): string {
		do {
			// wp_generate_password with no specials gives a-zA-Z0-9.
			$raw  = wp_generate_password( 12, false, false );
			$slug = substr( preg_replace( '/[^a-z0-9]/', '', strtolower( $raw ) ), 0, 8 );
		} while ( strlen( $slug ) < 4 || ! $this->slug_is_available( $slug ) );

		return $slug;
	}

	/**
	 * Validate a destination URL: must be absolute http/https with a host.
	 *
	 * @param string $url
	 * @return bool
	 */
	private function is_valid_destination( string $url ): bool {
		$url    = trim( $url );
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		$host   = wp_parse_url( $url, PHP_URL_HOST );
		return in_array( $scheme, array( 'http', 'https' ), true ) && ! empty( $host );
	}

	/**
	 * Sanitize a destination URL for storage.
	 *
	 * We deliberately do NOT use esc_url_raw() here because it strips colons
	 * from URL paths, breaking URLs like /filter/tax/days-of-week:63/ that
	 * JetEngine and similar plugins generate.  The URL is validated separately
	 * by is_valid_destination() before this is called.
	 *
	 * @param string $url
	 * @return string
	 */
	private function sanitize_destination( string $url ): string {
		return trim( $url );
	}

	/**
	 * Sanitize a hex colour string and return #rrggbb or the given fallback.
	 *
	 * @param string $colour
	 * @param string $fallback
	 * @return string
	 */
	private function clean_colour( string $colour, string $fallback = '#000000' ): string {
		$colour = trim( $colour );
		if ( preg_match( '/^#[a-fA-F0-9]{6}$/', $colour ) ) {
			return strtolower( $colour );
		}
		// Expand #abc → #aabbcc.
		if ( preg_match( '/^#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])$/', $colour, $m ) ) {
			return strtolower( "#{$m[1]}{$m[1]}{$m[2]}{$m[2]}{$m[3]}{$m[3]}" );
		}
		return $fallback;
	}

	/**
	 * Ensure redirect type is either 301 or 302; default 302.
	 *
	 * @param int $type
	 * @return int
	 */
	private function clean_redirect_type( int $type ): int {
		return in_array( $type, array( 301, 302 ), true ) ? $type : 302;
	}

	/**
	 * Whitelist the orderby column to prevent SQL injection.
	 *
	 * @param string $column
	 * @return string
	 */
	private function validate_orderby( string $column ): string {
		$allowed = array( 'id', 'title', 'slug', 'status', 'created_at', 'updated_at' );
		return in_array( $column, $allowed, true ) ? $column : 'created_at';
	}

	/**
	 * Argument schema for collection list endpoint.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private function list_args(): array {
		return array(
			'page'     => array( 'default' => 1,        'sanitize_callback' => 'absint' ),
			'per_page' => array( 'default' => 20,       'sanitize_callback' => 'absint' ),
			'search'   => array( 'default' => '',       'sanitize_callback' => 'sanitize_text_field' ),
			'status'   => array( 'default' => 'all',    'sanitize_callback' => 'sanitize_text_field' ),
			'orderby'  => array( 'default' => 'created_at', 'sanitize_callback' => 'sanitize_text_field' ),
			'order'    => array( 'default' => 'DESC',   'sanitize_callback' => 'sanitize_text_field' ),
		);
	}

	/**
	 * Argument schema for create / update code endpoints.
	 *
	 * @param bool $required Whether title and destination_url are required.
	 * @return array<string, array<string, mixed>>
	 */
	private function code_args( bool $required ): array {
		return array(
			'title'           => array( 'required' => $required,  'sanitize_callback' => 'sanitize_text_field' ),
			'destination_url' => array( 'required' => $required,  'sanitize_callback' => static function ( $v ) { return trim( (string) $v ); } ),
			'slug'            => array( 'required' => false,      'sanitize_callback' => 'sanitize_text_field' ),
			'status'          => array( 'default'  => 1,          'sanitize_callback' => 'absint' ),
			'redirect_type'   => array( 'default'  => 302,        'sanitize_callback' => 'absint' ),
			'fg_colour'       => array( 'default'  => '#000000',  'sanitize_callback' => 'sanitize_text_field' ),
			'bg_colour'       => array( 'default'  => '#ffffff',  'sanitize_callback' => 'sanitize_text_field' ),
			'notes'           => array( 'default'  => '',         'sanitize_callback' => 'sanitize_textarea_field' ),
			'settings'        => array( 'default'  => array() ),
		);
	}
}
