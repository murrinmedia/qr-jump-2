# QR Jump — Product Specification

You are a senior WordPress plugin engineer and product-minded full stack developer.

Build a production-quality WordPress plugin called **QR Jump**.

---

# 1. Core Purpose

QR Jump is a **dynamic QR code generator** for WordPress.

Users create QR codes that point to an internal short URL:

`https://example.com/<slug>`

That short URL redirects to a configurable destination URL.

This allows QR codes to remain unchanged while the destination can be updated at any time.

---

# 2. Non-Negotiables

* Must use **custom database tables** (NOT post meta)
* Redirect must be **fast and not rely on full WordPress page load**
* QR codes must always point to **internal short URLs**
* Slugs must be **manually settable** for legacy support
* Scan logging must **not noticeably slow down redirects**
* Admin UI must feel like a **premium SaaS product**

---

# 3. QR Code Records

Each QR code is a managed record with:

* Title / label
* Destination URL
* Slug (short code)
* Status (active / inactive)
* Created date
* Updated date
* Notes
* QR foreground colour
* QR background colour
* Redirect type (default 302, support 301 later)
* Notification settings (per code)
* Scan statistics

---

# 4. Slug Rules

### Format

* Lowercase only
* Allowed characters: `a-z`, `0-9`, `-`
* No spaces or special characters
* Max length: 32 characters

### Behaviour

* Slugs must be **unique**
* Enforce uniqueness at **database level (unique index)**

### Creation

* User can:

  * auto-generate slug
  * manually enter slug

### Editing

* Slugs **can be edited after creation**
* Changing a slug:

  * immediately invalidates the old slug
  * no aliasing

### Legacy Support

* Users must be able to manually recreate existing slugs from previous systems

---

# 5. Redirect Behaviour

When a short URL is accessed:

* Redirect must occur **as early as possible**
* Must NOT rely on full WP page rendering
* Use rewrite rules + lightweight handling

### Flow:

1. Match slug
2. Lookup QR code
3. Log scan
4. Redirect to destination

### Requirements:

* Use `wp_redirect()` with correct status code
* Validate destination URLs (prevent open redirect attacks)
* Redirect must be extremely fast (<100ms processing target)

### Disabled Codes:

* Configurable:

  * return 404
  * OR show simple fallback message

### Future-ready:

* expiry dates
* scan limits

---

# 6. Scan Tracking & Analytics

Each scan stores:

* QR code ID
* Timestamp
* Hashed IP
* User agent
* Referrer
* Scan type (unique / repeat)

---

## 6.1 Scan Uniqueness Rules

A scan is considered **unique** if:

* Same QR code
* Same visitor (hashed IP + user agent)
* Outside a 24-hour rolling window

If within 24 hours:
→ repeat scan

After 24 hours:
→ new unique scan

This logic should be configurable in the future.

---

## 6.2 Performance Rules

* Logging must NOT delay redirect
* Logging must be lightweight
* Heavy processing (e.g. geolocation) must be deferred
* Logging failure must NOT block redirect

---

## 6.3 Minimum Stats Required

* Total scans
* Unique scans
* Repeat scans
* Last scanned date

---

# 7. Email Notifications & Reporting

## 7.1 Per-Scan Notifications

* Optional per QR code
* Sends email on scan

### Requirements:

* Must include **rate limiting** to prevent spam
* Must not impact redirect performance

---

## 7.2 Scheduled Reports

* Support:

  * daily
  * weekly
  * monthly

* Include:

  * total scans
  * unique scans
  * repeat scans
  * top QR codes
  * recent activity

### Implementation:

* Use WP-Cron initially
* Structure for future upgrade to Action Scheduler

---

## 7.3 Reliability

* Failed emails must not break plugin functionality

---

# 8. QR Code Generation

Users can customise:

* Foreground colour
* Background colour

Downloads:

* PNG
* SVG

### Requirements:

* High resolution (print quality)
* Clean output
* Optional live preview in admin

---

# 9. Admin UI / UX

Must feel like a **premium SaaS interface inside WordPress**

### Requirements:

* Built with React
* Fast and responsive
* Clean layout
* Professional visual hierarchy
* Clear validation and error handling
* Search / filter / sort QR codes
* Stats dashboard
* Easy download access
* Structured per-code settings UI

### Architecture:

* REST API backend
* Secure (nonce + capability checks)
* Clean separation of PHP and JS

---

# 10. Technical Architecture

### Stack:

* PHP (WordPress plugin)
* React (admin UI)
* REST API
* Custom database tables
* OOP structure

---

## 10.1 Database Requirements

Minimum tables:

### QR Codes Table

* id
* slug (unique index)
* destination_url
* status
* settings (JSON or structured fields)
* created_at
* updated_at

### Scan Events Table

* id
* qr_code_id (indexed)
* timestamp (indexed)
* ip_hash
* user_agent
* referrer
* scan_type

### Requirements:

* Optimised for large datasets (100k+ rows)
* Proper indexing
* Future-ready for geolocation

---

## 10.2 Data Retention

* Must support future cleanup strategies
* Design for scalability from day one

---

# 11. Security Requirements

* Validate destination URLs:

  * allow only http/https
* Prevent open redirect vulnerabilities
* Sanitize all inputs
* Escape all outputs
* Use nonces for all actions
* Use capability checks for all admin functionality

---

# 12. Deliverables

## Phase 1 — Planning

* Feature breakdown
* Architecture
* Database schema
* Admin UI structure
* REST API design
* Scan uniqueness strategy
* Reporting strategy
* QR library selection

## Phase 2 — Scaffold

* Plugin bootstrap
* File structure
* REST endpoints
* DB install routines
* Rewrite handling
* CRUD foundation

## Phase 3 — Core Features

* QR CRUD
* Slug system
* Redirect system
* Scan logging
* Admin UI
* Stats dashboard
* Downloads (PNG/SVG)
* Notifications
* Reporting

## Phase 4 — Polish

* Validation improvements
* UI refinement
* Documentation
* Uninstall cleanup

---

# 13. Coding Expectations

* Real code (no pseudo-code)
* Modular and maintainable
* Production-ready decisions
* Clean architecture
* No overengineering

---

# 14. Future Expansion

Design with support for:

* Scan limits
* Expiry dates
* Geolocation
* CSV export
* Bulk actions
* Role-based access
