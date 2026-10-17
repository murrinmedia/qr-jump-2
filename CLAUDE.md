# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QR Jump is a WordPress plugin (PHP ≥ 7.4, WP ≥ 6.0) that creates dynamic QR codes pointing at internal short URLs (`/<redirect_prefix>/<slug>`, default prefix `qr`) which redirect to an editable destination. `specifications.md` is the original product spec (non-negotiables: custom tables not post meta, fast redirect without full WP load, logging must never block/break the redirect). `wordpress-custom-plugin-guide.md` is generic WP reference material.

## Commands

- `npm run build` — production build of the React admin UI (`src/` → `build/`, via `@wordpress/scripts`)
- `npm start` — watch/dev build
- `npm run lint:js` — lint JS
- `composer install --no-dev --optimize-autoloader` — PHP deps (endroid/qr-code, plugin-update-checker)

There is no test suite. To verify changes, install the plugin in a WordPress site (symlink/copy this directory into `wp-content/plugins/`) and exercise it.

**`build/` and `vendor/` are committed to git** — rebuild (`npm run build`) and commit `build/` after any change under `src/`, otherwise the change won't appear in the plugin.

## Releasing

Version lives in two places in [qr-jump.php](qr-jump.php): the `Version:` header and the `QRJUMP_VERSION` constant — bump both (commits are named like "v1.0.33 — description"). Keep the rsync excludes in the workflow anchored (`/src`, not `src`) — an unanchored `src` strips the QR libraries' own `src/` folders out of `vendor/` and breaks QR generation on every site updated from the zip; the workflow's "Verify zip contents" step guards this. Pushing a `v*` tag triggers [.github/workflows/release.yml](.github/workflows/release.yml), which builds assets, strips dev files, and attaches `qr-jump.zip` to a GitHub Release. Installed sites self-update from that release asset via `plugin-update-checker` (repo `murrinmedia/qr-jump-2`), so the zip layout (top-level `qr-jump/` folder) matters. `package.json`'s version is unrelated and unused.

## Architecture

**PHP backend** (`includes/`, namespace `QRJump`): files are autoloaded by a custom autoloader in [qr-jump.php](qr-jump.php) mapping `QRJump\Foo_Bar` → `includes/class-foo-bar.php` (no Composer classmap for these). [class-plugin.php](includes/class-plugin.php) is a singleton that wires everything on `plugins_loaded`:

- `Redirect_Handler` — hooked on `init` priority 1; parses `REQUEST_URI` directly (not WP rewrite rules) against the configured prefix, looks up the slug, sends caching-prevention headers, redirects, then logs the scan after flushing the response. Unknown slugs fall through to WordPress. Handles inactive codes, schedules, scan limits, redirect type per code.
- `REST_Controller` — all admin data operations (`/wp-json/...`); the React app talks only to this.
- `Installer` — creates tables via `dbDelta` (`{prefix}qrjump_codes`, `{prefix}qrjump_scans`), `maybe_upgrade` compares `QRJUMP_DB_VERSION` on every `init`. `uninstall.php` handles cleanup.
- `Settings` — plugin options (e.g. `redirect_prefix`); `QR_Generator` / `VCard_Builder` — QR image (PNG/SVG) and vCard payload generation; `Scan_Logger`, `Notification_Manager`, `Report_Scheduler` (WP-Cron), `Cache_Purger`, `Admin` (menu + enqueues the built bundle).
- Schema changes go in `Installer::create_tables()` (dbDelta) and bump `QRJUMP_DB_VERSION`; one-off data fix-ups go in `Installer::migrations()`, keyed by the DB version that introduces them. `maybe_upgrade` runs them once on `init`. Sites that update via the release zip never re-run activation, so anything that must exist on existing sites (e.g. cron events) has to be set up in a migration too.
- Scans are flagged `is_bot = 1` by `Bot_Detector` (still logged and redirected). Every stats/limit/notification query must filter `is_bot = 0`.
- Per-code options (schedule, limits, notifications, redirect type) are stored as a JSON `settings` column on the codes table.

**React admin UI** (`src/`): single-page app using `react-router-dom`, mounted by [src/index.js](src/index.js); pages in `src/pages/` (Dashboard, QRList, QREdit, QRStats, Settings), shared pieces in `src/components/`. All server calls go through [src/api/client.js](src/api/client.js), which reads `window.qrJumpData` (`apiUrl`, `nonce`) injected by `Admin` and sends the `X-WP-Nonce` header. QR images are served by REST endpoints and used directly as `<img src>` URLs with `_wpnonce` in the query string. Styles are in `src/style.scss`.

`migrate-from-v1.sql` is a one-off migration from the previous plugin version; it is excluded from release zips.

## Workflow rules

- Always `git pull` before starting work — development happens on both a Mac and a Windows PC.
- Don't run `composer install` unless adding or updating a PHP library. If `vendor/composer` files show as modified, restore them with `git restore vendor/`.
- Never delete the plugin through WP admin on a live site: `uninstall.php` drops all QR codes and scan data. It's live on murrinmedia.com.au and tammy-edwards.com.au.
- Ask before tagging or pushing a release.
