-- =============================================================================
-- QR Jump v2 — Migration from old CPT-based plugin
-- =============================================================================
-- Source data: QR-Jump-Export-2026-April-08-0545.csv + wp_qr_jump_analytics
--
-- HOW TO RUN
--   Option A (WP-CLI, recommended):
--     wp db query < migrate-from-v1.sql
--
--   Option B (phpMyAdmin):
--     Open the database, click "SQL", paste and run.
--
-- SAFETY
--   • STEP 1 uses INSERT IGNORE — safe to re-run; duplicate slugs are skipped.
--   • STEP 2 checks for existing scans before importing — safe to re-run.
--   • Neither step touches existing new-plugin data.
--
-- NOTES
--   • The old plugin stored two notification emails for "Corflute Sign" (3290).
--     The new plugin supports one email per code; tammy@tammy-edwards.com.au
--     is used. Update manually in the editor if needed.
--   • IP addresses are hashed with SHA2-256 (no site salt) so the hash matches
--     what WP would produce for historical scans on the original server.
--   • scan_type is derived: 'repeat' if the same IP hit the same code within
--     the 24 hours before that scan, otherwise 'unique'.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Insert the 5 QR codes
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO wp_qrjump_codes
    (title, slug, destination_url, status, redirect_type,
     fg_colour, bg_colour, settings, created_at, updated_at)
VALUES

-- 3128 · Signature Email -------------------------------------------------
(
    'Signature Email',
    'gk1b7',
    'https://tammy-edwards.com.au',
    1, 302, '#000000', '#ffffff',
    '{"destination_type":"url","vcard_mode":"raw","vcard_data":{"first_name":"","last_name":"","full_name":"","org":"","title":"","phone_mobile":"","phone_work":"","email":"","website":"","address":"","notes":"","photo_id":0,"photo_url":""},"notify_on_scan":false,"notify_email":"","notify_rate_limit_minutes":5,"notify_every_x_scans":1,"active_from":"","active_until":"","max_scans":0,"max_scans_message":""}',
    '2025-07-18 05:26:18',
    '2025-07-18 05:26:31'
),

-- 3232 · Register Your Interest ------------------------------------------
(
    'Register Your Interest',
    'xco2f',
    'https://tammy-edwards.com.au/contact',
    1, 302, '#000000', '#ffffff',
    '{"destination_type":"url","vcard_mode":"raw","vcard_data":{"first_name":"","last_name":"","full_name":"","org":"","title":"","phone_mobile":"","phone_work":"","email":"","website":"","address":"","notes":"","photo_id":0,"photo_url":""},"notify_on_scan":false,"notify_email":"","notify_rate_limit_minutes":5,"notify_every_x_scans":1,"active_from":"","active_until":"","max_scans":0,"max_scans_message":""}',
    '2025-08-14 04:52:14',
    '2025-08-16 03:24:12'
),

-- 3290 · Corflute Sign ---------------------------------------------------
-- NOTE: old plugin had 2 notify emails; only primary (tammy@) migrated.
(
    'Corflute Sign',
    'fcxbr',
    'https://tammy-edwards.com.au',
    1, 302, '#f06726', '#ffffff',
    '{"destination_type":"url","vcard_mode":"raw","vcard_data":{"first_name":"","last_name":"","full_name":"","org":"","title":"","phone_mobile":"","phone_work":"","email":"","website":"","address":"","notes":"","photo_id":0,"photo_url":""},"notify_on_scan":true,"notify_email":"tammy@tammy-edwards.com.au","notify_rate_limit_minutes":5,"notify_every_x_scans":1,"active_from":"","active_until":"","max_scans":0,"max_scans_message":""}',
    '2025-08-19 03:38:52',
    '2025-09-04 05:15:24'
),

-- 3563 · TT Selfie Frame -------------------------------------------------
(
    'TT Selfie Frame',
    'rf90c',
    'https://tammy-edwards.com.au/tammys-table/',
    1, 302, '#000000', '#ffffff',
    '{"destination_type":"url","vcard_mode":"raw","vcard_data":{"first_name":"","last_name":"","full_name":"","org":"","title":"","phone_mobile":"","phone_work":"","email":"","website":"","address":"","notes":"","photo_id":0,"photo_url":""},"notify_on_scan":true,"notify_email":"tammy@tammy-edwards.com.au","notify_rate_limit_minutes":5,"notify_every_x_scans":1,"active_from":"","active_until":"","max_scans":0,"max_scans_message":""}',
    '2025-10-13 00:30:52',
    '2025-10-13 00:31:37'
),

-- 3625 · Pull Up Banner --------------------------------------------------
(
    'Pull Up Banner',
    'zwfi5',
    'https://tammy-edwards.com.au/tammys-table/',
    1, 302, '#f26625', '#ffffff',
    '{"destination_type":"url","vcard_mode":"raw","vcard_data":{"first_name":"","last_name":"","full_name":"","org":"","title":"","phone_mobile":"","phone_work":"","email":"","website":"","address":"","notes":"","photo_id":0,"photo_url":""},"notify_on_scan":true,"notify_email":"tammy@tammy-edwards.com.au","notify_rate_limit_minutes":5,"notify_every_x_scans":1,"active_from":"","active_until":"","max_scans":0,"max_scans_message":""}',
    '2025-10-28 04:44:15',
    '2025-10-28 04:44:15'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Migrate scan history from wp_qr_jump_analytics
--
-- Idempotency guard: the entire INSERT is skipped if any scans already exist
-- for these five codes, preventing double-import on accidental re-runs.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO wp_qrjump_scans
    (qr_code_id, scanned_at, ip_hash, user_agent, referrer, scan_type)

SELECT
    new_code.id                   AS qr_code_id,
    a.scan_date                   AS scanned_at,
    SHA2(a.ip_address, 256)       AS ip_hash,
    COALESCE(a.user_agent, '')    AS user_agent,
    COALESCE(a.referrer,   '')    AS referrer,

    -- 'repeat' if the same IP hit the same code within the 24 h before
    -- this scan, otherwise 'unique' (mirrors new plugin's scan logger logic).
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM   wp_qr_jump_analytics prev
            WHERE  prev.qr_id      = a.qr_id
              AND  prev.ip_address = a.ip_address
              AND  prev.scan_date  < a.scan_date
              AND  prev.scan_date >= a.scan_date - INTERVAL 24 HOUR
        ) THEN 'repeat'
        ELSE 'unique'
    END AS scan_type

FROM wp_qr_jump_analytics a

-- Map old CPT post IDs to new wp_qrjump_codes row IDs via slug.
INNER JOIN (
    SELECT id, slug
    FROM   wp_qrjump_codes
    WHERE  slug IN ('gk1b7', 'xco2f', 'fcxbr', 'rf90c', 'zwfi5')
) AS new_code
    ON new_code.slug = CASE a.qr_id
        WHEN 3128 THEN 'gk1b7'
        WHEN 3232 THEN 'xco2f'
        WHEN 3290 THEN 'fcxbr'
        WHEN 3563 THEN 'rf90c'
        WHEN 3625 THEN 'zwfi5'
        ELSE NULL
    END

WHERE a.qr_id IN (3128, 3232, 3290, 3563, 3625)

  -- Idempotency guard — skip if we already imported scans for these codes.
  AND NOT EXISTS (
      SELECT 1
      FROM   wp_qrjump_scans  s
      JOIN   wp_qrjump_codes  c ON c.id = s.qr_code_id
      WHERE  c.slug IN ('gk1b7', 'xco2f', 'fcxbr', 'rf90c', 'zwfi5')
      LIMIT 1
  );

-- =============================================================================
-- Done. Verify with:
--   SELECT slug, title FROM wp_qrjump_codes WHERE slug IN ('gk1b7','xco2f','fcxbr','rf90c','zwfi5');
--   SELECT c.slug, COUNT(*) AS scans FROM wp_qrjump_scans s JOIN wp_qrjump_codes c ON c.id = s.qr_code_id WHERE c.slug IN ('gk1b7','xco2f','fcxbr','rf90c','zwfi5') GROUP BY c.slug;
-- =============================================================================
