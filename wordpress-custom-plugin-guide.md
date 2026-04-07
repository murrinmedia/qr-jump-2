# WordPress Custom Plugin Development — Complete Guide

> **Source:** Based on the official [WordPress Plugin Developer Handbook](https://developer.wordpress.org/plugins/) and WordPress best practices.
> Use this document as your reference every time you build a custom WordPress plugin.

---

## Table of Contents

1. [The Golden Rule](#1-the-golden-rule)
2. [Plugin File Structure](#2-plugin-file-structure)
3. [Plugin Header (Required)](#3-plugin-header-required)
4. [Direct Access Prevention](#4-direct-access-prevention)
5. [Naming & Prefixing](#5-naming--prefixing)
6. [Hooks System — Actions & Filters](#6-hooks-system--actions--filters)
7. [Activation, Deactivation & Uninstall](#7-activation-deactivation--uninstall)
8. [Security Essentials](#8-security-essentials)
   - 8.1 Nonces (CSRF Protection)
   - 8.2 Capability Checks
   - 8.3 Input Sanitization
   - 8.4 Output Escaping
   - 8.5 Data Validation
   - 8.6 Prepared SQL Queries
9. [Enqueuing Scripts & Styles](#9-enqueuing-scripts--styles)
10. [Settings API & Options](#10-settings-api--options)
11. [Admin Menus](#11-admin-menus)
12. [Shortcodes](#12-shortcodes)
13. [AJAX Handling](#13-ajax-handling)
14. [Custom Post Types & Taxonomies](#14-custom-post-types--taxonomies)
15. [Internationalization (i18n)](#15-internationalization-i18n)
16. [REST API Endpoints](#16-rest-api-endpoints)
17. [Database Operations](#17-database-operations)
18. [WP-Cron (Scheduled Tasks)](#18-wp-cron-scheduled-tasks)
19. [Conditional Loading](#19-conditional-loading)
20. [Architecture Patterns](#20-architecture-patterns)
21. [Plugin Readme (readme.txt)](#21-plugin-readme-readmetxt)
22. [Debugging](#22-debugging)
23. [Licensing](#23-licensing)
24. [Full Boilerplate Template](#24-full-boilerplate-template)
25. [Checklist Before Shipping](#25-checklist-before-shipping)

---

## 1. The Golden Rule

**Never modify WordPress core files.** WordPress overwrites core files with every update. All custom functionality must be added through plugins (or themes). This is the fundamental principle of WordPress development.

---

## 2. Plugin File Structure

A well-organized plugin keeps files in a dedicated directory:

```
/your-plugin-name/
├── your-plugin-name.php        ← Main plugin file (entry point + header)
├── uninstall.php               ← Cleanup on plugin deletion
├── readme.txt                  ← Plugin directory readme
├── /includes/                  ← Core PHP classes & helper functions
│   ├── class-your-plugin.php
│   ├── class-your-plugin-admin.php
│   └── class-your-plugin-public.php
├── /admin/                     ← Admin-specific assets
│   ├── /css/
│   ├── /js/
│   └── /images/
├── /public/                    ← Frontend-specific assets
│   ├── /css/
│   ├── /js/
│   └── /images/
├── /templates/                 ← HTML/PHP template files
└── /languages/                 ← Translation .pot / .po / .mo files
```

**Rules:**
- Only ONE PHP file in the entire plugin should contain the plugin header comment.
- The main file name should match the directory name.
- Keep the root directory clean — organize everything into subdirectories.

---

## 3. Plugin Header (Required)

WordPress identifies a plugin by scanning for a specially formatted PHP comment block at the top of the main file. Without this, WordPress will not recognize your plugin.

```php
<?php
/**
 * Plugin Name:       Your Plugin Name
 * Plugin URI:        https://yoursite.com/your-plugin/
 * Description:       A short description of what this plugin does (under 140 characters).
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://yoursite.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       your-plugin-name
 * Domain Path:       /languages
 * Update URI:        https://yoursite.com/your-plugin/
 * Requires Plugins:  woocommerce, another-plugin
 */
```

### Header Fields Reference

| Field | Required? | Purpose |
|---|---|---|
| `Plugin Name` | **YES** | Displayed in the admin Plugins list |
| `Plugin URI` | No | Link to the plugin homepage (must be unique, not wordpress.org) |
| `Description` | No | Short description shown in admin (keep under 140 chars) |
| `Version` | Recommended | Current version number (e.g. 1.0.0) |
| `Requires at least` | Recommended | Minimum WordPress version needed |
| `Requires PHP` | Recommended | Minimum PHP version needed |
| `Author` | Recommended | Plugin author name(s), comma-separated |
| `Author URI` | No | Link to the author's website |
| `License` | Recommended | Short license name (e.g. GPL v2 or later) |
| `License URI` | Recommended | Full URL to license text |
| `Text Domain` | Recommended | Must match the plugin directory name, no underscores |
| `Domain Path` | No | Where translation files are stored |
| `Network` | No | Set to `true` for multisite network-only plugins |
| `Update URI` | No | Prevents accidental overwrites from wordpress.org |
| `Requires Plugins` | No | Comma-separated list of dependency plugin slugs |

**Versioning Note:** WordPress uses PHP's `version_compare()` function. Be careful — `1.02` is considered greater than `1.1`.

---

## 4. Direct Access Prevention

Every PHP file in your plugin should block direct browser access. This prevents attackers from loading your files outside of WordPress.

```php
// Place this at the very top of every PHP file (after <?php)
if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}
```

**Why?** If someone navigates directly to `yoursite.com/wp-content/plugins/your-plugin/includes/some-file.php`, this check ensures nothing executes.

---

## 5. Naming & Prefixing

A naming collision occurs when your plugin uses the same name for a function, class, or variable as another plugin or WordPress core.

### Rules for Prefixing

1. **Prefix must be unique** — at least 4-5 characters long, derived from your plugin name
2. **Prefix everything global** — functions, classes, constants, options, transients, database table names, hooks
3. **Never use reserved prefixes** — avoid `wp_`, `__` (double underscore), `_` (single underscore), `WordPress`
4. **Never use sub-plugin prefixes** — e.g. don't use `woo_` or `wc_` for WooCommerce extensions

### What to Prefix

```php
// Functions
function yplg_save_settings() { }

// Constants
define( 'YPLG_VERSION', '1.0.0' );
define( 'YPLG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// Classes
class YPLG_Admin { }

// Options
update_option( 'yplg_settings', $data );

// Transients
set_transient( 'yplg_cache_data', $data, HOUR_IN_SECONDS );

// Custom hooks
do_action( 'yplg_after_save' );

// Database tables
$table_name = $wpdb->prefix . 'yplg_entries';

// Nonce actions
wp_nonce_field( 'yplg_save_action', 'yplg_nonce' );
```

### OOP Alternative (Recommended)

Using classes and namespaces naturally avoids most collisions:

```php
namespace YourPlugin;

class Admin {
    public function save_settings() { }
    public function get_settings() { }
}
```

### Check Before Defining

```php
if ( ! function_exists( 'yplg_init' ) ) {
    function yplg_init() {
        // Your code
    }
}

if ( ! class_exists( 'YPLG_Plugin' ) ) {
    class YPLG_Plugin {
        // Your code
    }
}
```

**Warning:** Don't rely solely on `function_exists()` as a collision prevention strategy. If another plugin loads first with the same function name, your code silently fails. Unique prefixes are the real solution.

---

## 6. Hooks System — Actions & Filters

Hooks are the backbone of WordPress plugin development. They let you "tap into" WordPress at specific execution points without modifying core files.

### Actions — Execute Code at Specific Points

Actions let you **add functionality** at specific moments in the WordPress execution flow.

```php
// Register a function to run at a specific hook
add_action( 'init', 'yplg_register_post_type' );
function yplg_register_post_type() {
    register_post_type( 'yplg_resource', array(
        'labels'  => array( 'name' => __( 'Resources', 'your-plugin-name' ) ),
        'public'  => true,
    ) );
}

// Common action hooks you'll use:
// 'init'              → Register post types, taxonomies, shortcodes
// 'admin_init'        → Register settings, run admin-only setup
// 'admin_menu'        → Add admin menu pages
// 'wp_enqueue_scripts' → Load frontend CSS/JS
// 'admin_enqueue_scripts' → Load admin CSS/JS
// 'wp_head'           → Output code in <head>
// 'wp_footer'         → Output code before </body>
// 'save_post'         → Run code when a post is saved
// 'rest_api_init'     → Register REST API routes
// 'widgets_init'      → Register widgets
```

### Filters — Modify Data Before It's Used

Filters let you **alter data** as it passes through WordPress.

```php
// Modify post content before display
add_filter( 'the_content', 'yplg_append_cta' );
function yplg_append_cta( $content ) {
    if ( is_single() && is_main_query() ) {
        $content .= '<div class="yplg-cta">Thanks for reading!</div>';
    }
    return $content; // ALWAYS return the value in filters
}

// Common filter hooks:
// 'the_content'       → Modify post content
// 'the_title'         → Modify post title
// 'body_class'        → Add/remove body CSS classes
// 'wp_mail'           → Modify outgoing emails
// 'login_redirect'    → Change redirect URL after login
// 'upload_mimes'      → Add allowed upload file types
```

### Custom Hooks — Make Your Plugin Extensible

```php
// In your plugin: create a hook point for other developers
do_action( 'yplg_after_form_submit', $form_data );

// In your plugin: create a filter for data modification
$message = apply_filters( 'yplg_notification_message', $default_message, $user );
```

### Removing Hooks

```php
// Remove a previously added action/filter
remove_action( 'wp_head', 'wp_generator' );
remove_filter( 'the_content', 'wptexturize' );
```

### Hook Priority & Arguments

```php
// Priority: lower number = runs earlier. Default is 10.
add_action( 'init', 'yplg_early_init', 5 );  // Runs before default
add_action( 'init', 'yplg_late_init', 20 );   // Runs after default

// Accepted arguments: specify how many args the callback receives
add_filter( 'the_content', 'yplg_modify', 10, 2 ); // 10 = priority, 2 = args
```

---

## 7. Activation, Deactivation & Uninstall

These are the three lifecycle hooks every plugin should implement.

### Activation Hook

Runs when the user clicks "Activate" in the admin. Use for initial setup.

```php
register_activation_hook( __FILE__, 'yplg_activate' );
function yplg_activate() {
    // Set default options
    add_option( 'yplg_version', YPLG_VERSION );
    add_option( 'yplg_settings', array(
        'feature_enabled' => true,
        'items_per_page'  => 10,
    ) );

    // Create custom database tables if needed
    yplg_create_tables();

    // Register post types before flushing (required for rewrites)
    yplg_register_post_type();
    flush_rewrite_rules();
}
```

### Deactivation Hook

Runs when the user clicks "Deactivate". Use for temporary cleanup only.

```php
register_deactivation_hook( __FILE__, 'yplg_deactivate' );
function yplg_deactivate() {
    // Flush rewrite rules
    flush_rewrite_rules();

    // Clear scheduled cron events
    $timestamp = wp_next_scheduled( 'yplg_cron_hook' );
    if ( $timestamp ) {
        wp_unschedule_event( $timestamp, 'yplg_cron_hook' );
    }

    // Clear transients/cache
    delete_transient( 'yplg_cache_data' );
}
```

**Important:** Do NOT delete options or database tables on deactivation. Users often deactivate plugins temporarily. Data should only be removed on uninstall (deletion).

### Uninstall — Method 1: uninstall.php (Recommended)

Create an `uninstall.php` file in the plugin root directory. WordPress runs this automatically when the plugin is deleted from the admin.

```php
<?php
// uninstall.php

// If not called by WordPress, abort
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    die;
}

// Delete plugin options
delete_option( 'yplg_version' );
delete_option( 'yplg_settings' );

// Delete site options (for multisite)
delete_site_option( 'yplg_version' );
delete_site_option( 'yplg_settings' );

// Drop custom database tables
global $wpdb;
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}yplg_entries" );

// Delete all post meta created by plugin
$wpdb->query( "DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE 'yplg_%'" );

// Delete user meta created by plugin
$wpdb->query( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE 'yplg_%'" );

// Clear any cached data that may still exist
wp_cache_flush();
```

### Uninstall — Method 2: register_uninstall_hook

```php
register_uninstall_hook( __FILE__, 'yplg_uninstall' );
function yplg_uninstall() {
    delete_option( 'yplg_settings' );
}
```

### Lifecycle Summary

| What to do | Activation | Deactivation | Uninstall |
|---|:---:|:---:|:---:|
| Set default options | ✅ | | |
| Create database tables | ✅ | | |
| Flush rewrite rules | ✅ | ✅ | |
| Clear cache/transients | | ✅ | |
| Unschedule cron events | | ✅ | |
| Delete options | | | ✅ |
| Drop database tables | | | ✅ |
| Delete post/user meta | | | ✅ |

---

## 8. Security Essentials

Security is the plugin developer's ultimate responsibility. WordPress provides built-in functions for every security need — use them.

### 8.1 Nonces (CSRF Protection)

A nonce ("Number Used Once") verifies that a request originated from your site, not from a malicious external source.

```php
// CREATING a nonce — in your form or URL
// In forms:
wp_nonce_field( 'yplg_save_action', 'yplg_nonce' );

// In URLs:
$url = wp_nonce_url( admin_url( 'admin.php?page=yplg&action=delete&id=5' ), 'yplg_delete_5' );

// In AJAX (localized):
wp_localize_script( 'yplg-admin-js', 'yplgAjax', array(
    'nonce' => wp_create_nonce( 'yplg_ajax_nonce' ),
) );

// VERIFYING a nonce — in your handler
// In form handlers:
if ( ! isset( $_POST['yplg_nonce'] ) || ! wp_verify_nonce( $_POST['yplg_nonce'], 'yplg_save_action' ) ) {
    wp_die( __( 'Security check failed.', 'your-plugin-name' ) );
}

// In AJAX handlers:
check_ajax_referer( 'yplg_ajax_nonce', 'nonce' );

// In URL handlers:
if ( ! wp_verify_nonce( $_GET['_wpnonce'], 'yplg_delete_5' ) ) {
    wp_die( __( 'Invalid request.', 'your-plugin-name' ) );
}
```

### 8.2 Capability Checks

Always verify the user has permission to perform the action. Never rely solely on `is_admin()` — it only checks if the request is to the admin area, NOT if the user is an administrator.

```php
// Before saving settings
if ( ! current_user_can( 'manage_options' ) ) {
    wp_die( __( 'You do not have permission to access this page.', 'your-plugin-name' ) );
}

// Before editing posts
if ( ! current_user_can( 'edit_post', $post_id ) ) {
    wp_die( __( 'You do not have permission to edit this post.', 'your-plugin-name' ) );
}

// Common capabilities:
// 'manage_options'     → Admin settings
// 'edit_posts'         → Edit own posts
// 'edit_others_posts'  → Edit others' posts
// 'publish_posts'      → Publish posts
// 'delete_posts'       → Delete posts
// 'upload_files'       → Upload media
// 'edit_users'         → Edit user profiles
```

### 8.3 Input Sanitization

Sanitize ALL data coming from users before saving or processing. Never trust user input.

```php
// Text fields — strips tags, removes extra whitespace
$clean_title = sanitize_text_field( $_POST['title'] );

// Textarea — preserves line breaks, strips dangerous tags
$clean_desc = sanitize_textarea_field( $_POST['description'] );

// Email addresses
$clean_email = sanitize_email( $_POST['email'] );

// URLs
$clean_url = esc_url_raw( $_POST['website'] );  // For saving to DB
$clean_url = esc_url( $_POST['website'] );       // For output in HTML

// Integers
$clean_id = absint( $_POST['item_id'] );          // Absolute integer (positive)
$clean_num = intval( $_POST['quantity'] );         // Integer (can be negative)

// File names
$clean_file = sanitize_file_name( $_POST['filename'] );

// HTML content — allows only safe HTML tags
$allowed_html = array(
    'a'      => array( 'href' => array(), 'title' => array(), 'target' => array() ),
    'br'     => array(),
    'em'     => array(),
    'strong' => array(),
    'p'      => array(),
);
$clean_html = wp_kses( $_POST['content'], $allowed_html );

// Or use wp_kses_post() for post-like content (allows standard post HTML)
$clean_html = wp_kses_post( $_POST['content'] );

// CSS class names
$clean_class = sanitize_html_class( $_POST['css_class'] );

// Slugs / keys
$clean_key = sanitize_key( $_POST['option_key'] );
```

### 8.4 Output Escaping

Escape ALL data before displaying it in HTML. This prevents XSS (Cross-Site Scripting) attacks.

```php
// In HTML context — escapes <, >, &, ", '
echo esc_html( $user_input );

// In HTML attribute values
echo '<input value="' . esc_attr( $value ) . '">';

// In URLs (href, src)
echo '<a href="' . esc_url( $link ) . '">Click</a>';
echo '<img src="' . esc_url( $image_url ) . '">';

// In JavaScript
echo '<script>var name = "' . esc_js( $name ) . '";</script>';

// In textarea content
echo '<textarea>' . esc_textarea( $content ) . '</textarea>';

// Translatable strings with escaping (PREFERRED for i18n output)
echo esc_html__( 'Settings saved.', 'your-plugin-name' );
echo esc_attr__( 'Save Changes', 'your-plugin-name' );
esc_html_e( 'Settings saved.', 'your-plugin-name' );
```

**Rule of Thumb:** Escape late — as close to the output as possible. Sanitize early — as soon as you receive the data.

### 8.5 Data Validation

Validate data to ensure it meets expected criteria before processing.

```php
// Check if value is in allowed list
$allowed_colors = array( 'red', 'green', 'blue' );
if ( ! in_array( $_POST['color'], $allowed_colors, true ) ) {
    $color = 'red'; // Default fallback
} else {
    $color = $_POST['color'];
}

// Validate email
if ( ! is_email( $_POST['email'] ) ) {
    wp_die( 'Invalid email address.' );
}

// Validate number range
$per_page = absint( $_POST['per_page'] );
if ( $per_page < 1 || $per_page > 100 ) {
    $per_page = 10; // Default fallback
}

// Validate date format
$date = sanitize_text_field( $_POST['date'] );
$d = DateTime::createFromFormat( 'Y-m-d', $date );
if ( ! $d || $d->format( 'Y-m-d' ) !== $date ) {
    wp_die( 'Invalid date format.' );
}
```

### 8.6 Prepared SQL Queries

When running custom database queries, ALWAYS use `$wpdb->prepare()` to prevent SQL injection.

```php
global $wpdb;

// SELECT with prepare
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}yplg_entries WHERE status = %s AND user_id = %d",
        'active',
        $user_id
    )
);

// INSERT with prepare
$wpdb->insert(
    $wpdb->prefix . 'yplg_entries',
    array(
        'title'   => sanitize_text_field( $title ),
        'user_id' => absint( $user_id ),
        'status'  => 'active',
    ),
    array( '%s', '%d', '%s' ) // Format specifiers
);

// UPDATE with prepare
$wpdb->update(
    $wpdb->prefix . 'yplg_entries',
    array( 'status' => 'inactive' ),       // Data
    array( 'id' => absint( $entry_id ) ),   // Where
    array( '%s' ),                           // Data format
    array( '%d' )                            // Where format
);

// DELETE with prepare
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->prefix}yplg_entries WHERE id = %d",
        $entry_id
    )
);

// Format specifiers:
// %s → string
// %d → integer
// %f → float
```

---

## 9. Enqueuing Scripts & Styles

Never hardcode `<script>` or `<link>` tags. Use WordPress's enqueue system to avoid conflicts, handle dependencies, and enable caching.

```php
// Frontend scripts & styles
add_action( 'wp_enqueue_scripts', 'yplg_enqueue_frontend' );
function yplg_enqueue_frontend() {
    // CSS
    wp_enqueue_style(
        'yplg-frontend-style',                              // Handle (unique)
        plugin_dir_url( __FILE__ ) . 'public/css/style.css', // Path
        array(),                                             // Dependencies
        YPLG_VERSION                                         // Version (cache busting)
    );

    // JavaScript
    wp_enqueue_script(
        'yplg-frontend-script',
        plugin_dir_url( __FILE__ ) . 'public/js/script.js',
        array( 'jquery' ),         // Dependencies
        YPLG_VERSION,
        true                       // Load in footer
    );

    // Pass PHP data to JavaScript
    wp_localize_script( 'yplg-frontend-script', 'yplgData', array(
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'nonce'   => wp_create_nonce( 'yplg_ajax_nonce' ),
        'siteUrl' => home_url(),
    ) );
}

// Admin scripts & styles
add_action( 'admin_enqueue_scripts', 'yplg_enqueue_admin' );
function yplg_enqueue_admin( $hook_suffix ) {
    // Only load on YOUR plugin's admin pages
    if ( 'toplevel_page_yplg-settings' !== $hook_suffix ) {
        return;
    }

    wp_enqueue_style( 'yplg-admin-style', plugin_dir_url( __FILE__ ) . 'admin/css/admin.css', array(), YPLG_VERSION );
    wp_enqueue_script( 'yplg-admin-script', plugin_dir_url( __FILE__ ) . 'admin/js/admin.js', array( 'jquery' ), YPLG_VERSION, true );
}
```

**Critical:** Always check `$hook_suffix` in admin to only load your assets on YOUR plugin pages. Loading assets site-wide slows down the entire admin.

---

## 10. Settings API & Options

WordPress provides a Settings API for building admin settings pages the right way.

```php
// Register settings
add_action( 'admin_init', 'yplg_register_settings' );
function yplg_register_settings() {
    // Register a setting group
    register_setting(
        'yplg_settings_group',         // Option group
        'yplg_settings',               // Option name in DB
        array(
            'type'              => 'array',
            'sanitize_callback' => 'yplg_sanitize_settings',
            'default'           => array(),
        )
    );

    // Add a settings section
    add_settings_section(
        'yplg_general_section',
        __( 'General Settings', 'your-plugin-name' ),
        'yplg_general_section_callback',
        'yplg-settings'
    );

    // Add fields to the section
    add_settings_field(
        'yplg_enable_feature',
        __( 'Enable Feature', 'your-plugin-name' ),
        'yplg_enable_feature_callback',
        'yplg-settings',
        'yplg_general_section'
    );
}

// Sanitize callback — validate & clean all submitted settings
function yplg_sanitize_settings( $input ) {
    $sanitized = array();
    $sanitized['enable_feature'] = isset( $input['enable_feature'] ) ? 1 : 0;
    $sanitized['api_key']        = sanitize_text_field( $input['api_key'] ?? '' );
    $sanitized['items_per_page'] = absint( $input['items_per_page'] ?? 10 );
    return $sanitized;
}

// Section description callback
function yplg_general_section_callback() {
    echo '<p>' . esc_html__( 'Configure the general settings for the plugin.', 'your-plugin-name' ) . '</p>';
}

// Field render callback
function yplg_enable_feature_callback() {
    $options = get_option( 'yplg_settings' );
    $checked = isset( $options['enable_feature'] ) ? checked( 1, $options['enable_feature'], false ) : '';
    echo '<input type="checkbox" name="yplg_settings[enable_feature]" value="1" ' . $checked . '>';
}
```

### Using the Options API Directly

```php
// Save
update_option( 'yplg_custom_option', sanitize_text_field( $value ) );

// Retrieve
$value = get_option( 'yplg_custom_option', 'default_value' );

// Delete
delete_option( 'yplg_custom_option' );
```

---

## 11. Admin Menus

### Top-Level Menu

```php
add_action( 'admin_menu', 'yplg_add_admin_menu' );
function yplg_add_admin_menu() {
    add_menu_page(
        __( 'Your Plugin', 'your-plugin-name' ),    // Page title
        __( 'Your Plugin', 'your-plugin-name' ),    // Menu title
        'manage_options',                            // Capability required
        'yplg-settings',                             // Menu slug
        'yplg_settings_page_html',                   // Callback function
        'dashicons-admin-generic',                   // Icon
        100                                          // Position
    );
}

function yplg_settings_page_html() {
    // Check permissions
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <form action="options.php" method="post">
            <?php
            settings_fields( 'yplg_settings_group' );
            do_settings_sections( 'yplg-settings' );
            submit_button( __( 'Save Settings', 'your-plugin-name' ) );
            ?>
        </form>
    </div>
    <?php
}
```

### Sub-Menu

```php
add_submenu_page(
    'yplg-settings',                                 // Parent slug
    __( 'Advanced', 'your-plugin-name' ),            // Page title
    __( 'Advanced', 'your-plugin-name' ),            // Menu title
    'manage_options',                                // Capability
    'yplg-advanced',                                 // Sub-menu slug
    'yplg_advanced_page_html'                        // Callback
);
```

---

## 12. Shortcodes

Shortcodes let users embed plugin output in posts and pages via `[your_shortcode]`.

```php
add_shortcode( 'yplg_display', 'yplg_shortcode_handler' );
function yplg_shortcode_handler( $atts, $content = null ) {
    // Parse attributes with defaults
    $atts = shortcode_atts( array(
        'count' => 5,
        'type'  => 'recent',
    ), $atts, 'yplg_display' );

    // Sanitize attributes
    $count = absint( $atts['count'] );
    $type  = sanitize_key( $atts['type'] );

    // Build output (NEVER echo in shortcodes — always return)
    ob_start();
    ?>
    <div class="yplg-shortcode-output">
        <!-- Your HTML here -->
    </div>
    <?php
    return ob_get_clean();
}

// Usage: [yplg_display count="10" type="popular"]
```

**Critical Rule:** Shortcode callbacks must RETURN output, never `echo` it. Use `ob_start()` and `ob_get_clean()` for complex HTML.

---

## 13. AJAX Handling

```php
// Register AJAX handlers (both logged-in and logged-out users)
add_action( 'wp_ajax_yplg_load_items', 'yplg_ajax_load_items' );        // Logged-in users
add_action( 'wp_ajax_nopriv_yplg_load_items', 'yplg_ajax_load_items' ); // Logged-out users

function yplg_ajax_load_items() {
    // 1. Verify nonce
    check_ajax_referer( 'yplg_ajax_nonce', 'nonce' );

    // 2. Check capabilities (if needed)
    if ( ! current_user_can( 'read' ) ) {
        wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
    }

    // 3. Sanitize input
    $page = absint( $_POST['page'] ?? 1 );

    // 4. Process the request
    $items = yplg_get_items( $page );

    // 5. Return JSON response
    wp_send_json_success( array(
        'items'    => $items,
        'has_more' => count( $items ) === 10,
    ) );
}
```

### JavaScript Side

```javascript
jQuery(document).ready(function($) {
    $('#yplg-load-more').on('click', function() {
        $.ajax({
            url: yplgData.ajaxUrl,
            type: 'POST',
            data: {
                action: 'yplg_load_items',   // Must match the wp_ajax_ suffix
                nonce: yplgData.nonce,
                page: 2,
            },
            success: function(response) {
                if (response.success) {
                    // Handle response.data.items
                }
            },
            error: function() {
                alert('Request failed.');
            }
        });
    });
});
```

---

## 14. Custom Post Types & Taxonomies

```php
add_action( 'init', 'yplg_register_post_types' );
function yplg_register_post_types() {
    register_post_type( 'yplg_resource', array(
        'labels' => array(
            'name'               => __( 'Resources', 'your-plugin-name' ),
            'singular_name'      => __( 'Resource', 'your-plugin-name' ),
            'add_new'            => __( 'Add New', 'your-plugin-name' ),
            'add_new_item'       => __( 'Add New Resource', 'your-plugin-name' ),
            'edit_item'          => __( 'Edit Resource', 'your-plugin-name' ),
            'all_items'          => __( 'All Resources', 'your-plugin-name' ),
            'search_items'       => __( 'Search Resources', 'your-plugin-name' ),
            'not_found'          => __( 'No resources found.', 'your-plugin-name' ),
            'not_found_in_trash' => __( 'No resources found in Trash.', 'your-plugin-name' ),
        ),
        'public'       => true,
        'has_archive'  => true,
        'show_in_rest' => true,   // Enable Gutenberg editor & REST API
        'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
        'menu_icon'    => 'dashicons-media-document',
        'rewrite'      => array( 'slug' => 'resources' ),
    ) );
}

// Custom taxonomy
add_action( 'init', 'yplg_register_taxonomies' );
function yplg_register_taxonomies() {
    register_taxonomy( 'yplg_resource_type', 'yplg_resource', array(
        'labels' => array(
            'name'          => __( 'Resource Types', 'your-plugin-name' ),
            'singular_name' => __( 'Resource Type', 'your-plugin-name' ),
        ),
        'public'       => true,
        'hierarchical' => true,   // true = categories, false = tags
        'show_in_rest' => true,
        'rewrite'      => array( 'slug' => 'resource-type' ),
    ) );
}
```

---

## 15. Internationalization (i18n)

Make all user-facing strings translatable from day one.

```php
// Simple string
__( 'Settings', 'your-plugin-name' );

// Echo a string
_e( 'Settings saved.', 'your-plugin-name' );

// String with escaping (PREFERRED for output)
esc_html__( 'Settings', 'your-plugin-name' );
esc_html_e( 'Settings saved.', 'your-plugin-name' );
esc_attr__( 'Click here', 'your-plugin-name' );

// Strings with placeholders
sprintf(
    /* translators: %s: user display name */
    __( 'Welcome back, %s!', 'your-plugin-name' ),
    esc_html( $user->display_name )
);

// Singular/plural
printf(
    /* translators: %d: number of items */
    _n( '%d item found.', '%d items found.', $count, 'your-plugin-name' ),
    $count
);

// Load text domain (in init hook or plugins_loaded)
add_action( 'init', 'yplg_load_textdomain' );
function yplg_load_textdomain() {
    load_plugin_textdomain( 'your-plugin-name', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
```

**Rules:**
- The text domain MUST match your plugin directory name (use hyphens, not underscores).
- Never use variable text domains — always a string literal.
- Never concatenate translatable strings — use `sprintf()` with placeholders.
- Add `/* translators: */` comments for strings with placeholders.

---

## 16. REST API Endpoints

```php
add_action( 'rest_api_init', 'yplg_register_rest_routes' );
function yplg_register_rest_routes() {
    register_rest_route( 'yplg/v1', '/items', array(
        'methods'             => 'GET',
        'callback'            => 'yplg_rest_get_items',
        'permission_callback' => function() {
            return current_user_can( 'read' );
        },
        'args' => array(
            'per_page' => array(
                'required'          => false,
                'default'           => 10,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param ) && $param > 0 && $param <= 100;
                },
                'sanitize_callback' => 'absint',
            ),
        ),
    ) );

    register_rest_route( 'yplg/v1', '/items/(?P<id>\d+)', array(
        'methods'             => 'GET',
        'callback'            => 'yplg_rest_get_single_item',
        'permission_callback' => function() {
            return current_user_can( 'read' );
        },
        'args' => array(
            'id' => array(
                'validate_callback' => function( $param ) {
                    return is_numeric( $param );
                },
            ),
        ),
    ) );
}

function yplg_rest_get_items( $request ) {
    $per_page = $request->get_param( 'per_page' );
    $items = yplg_get_items( $per_page );
    return rest_ensure_response( $items );
}
```

**Critical:** NEVER return `true` from `permission_callback` for sensitive operations. Always check capabilities. If the endpoint is truly public, you can use `__return_true`.

---

## 17. Database Operations

### Creating Custom Tables

```php
function yplg_create_tables() {
    global $wpdb;
    $table_name      = $wpdb->prefix . 'yplg_entries';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL DEFAULT 0,
        title varchar(255) NOT NULL DEFAULT '',
        content longtext NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY user_id (user_id),
        KEY status (status)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
}
```

**Note on `dbDelta()`:** This function is particular about formatting. Each column must be on its own line. Two spaces between `PRIMARY KEY` and `(id)`. Use `KEY` not `INDEX`.

---

## 18. WP-Cron (Scheduled Tasks)

```php
// Schedule the event on activation
register_activation_hook( __FILE__, 'yplg_schedule_cron' );
function yplg_schedule_cron() {
    if ( ! wp_next_scheduled( 'yplg_daily_cleanup' ) ) {
        wp_schedule_event( time(), 'daily', 'yplg_daily_cleanup' );
    }
}

// Hook the callback
add_action( 'yplg_daily_cleanup', 'yplg_run_cleanup' );
function yplg_run_cleanup() {
    // Your scheduled task logic
    global $wpdb;
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}yplg_entries WHERE status = %s AND created_at < %s",
            'expired',
            gmdate( 'Y-m-d H:i:s', strtotime( '-30 days' ) )
        )
    );
}

// Clear the event on deactivation
register_deactivation_hook( __FILE__, 'yplg_clear_cron' );
function yplg_clear_cron() {
    $timestamp = wp_next_scheduled( 'yplg_daily_cleanup' );
    if ( $timestamp ) {
        wp_unschedule_event( $timestamp, 'yplg_daily_cleanup' );
    }
}

// Custom cron interval
add_filter( 'cron_schedules', 'yplg_add_cron_interval' );
function yplg_add_cron_interval( $schedules ) {
    $schedules['yplg_every_six_hours'] = array(
        'interval' => 6 * HOUR_IN_SECONDS,
        'display'  => __( 'Every 6 Hours', 'your-plugin-name' ),
    );
    return $schedules;
}
```

---

## 19. Conditional Loading

Separate admin code from frontend code to reduce overhead.

```php
// In your main plugin file
if ( is_admin() ) {
    require_once YPLG_PLUGIN_DIR . 'includes/class-your-plugin-admin.php';
} else {
    require_once YPLG_PLUGIN_DIR . 'includes/class-your-plugin-public.php';
}
```

**Remember:** `is_admin()` only checks if the request is to the admin area. It does NOT verify the user is an administrator. Always use capability checks for authorization.

---

## 20. Architecture Patterns

### Pattern 1: Single File with Functions (Simple Plugins)

Good for small, single-purpose plugins.

```php
<?php
/* Plugin Name: Simple Plugin */
if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'init', 'sp_init' );
function sp_init() { /* ... */ }
```

### Pattern 2: Single File with a Class (Medium Plugins)

```php
<?php
/* Plugin Name: Medium Plugin */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! class_exists( 'YPLG_Plugin' ) ) {
    class YPLG_Plugin {
        public function __construct() {
            add_action( 'init', array( $this, 'init' ) );
        }
        public function init() { /* ... */ }
    }
    new YPLG_Plugin();
}
```

### Pattern 3: Main File + Multiple Classes (Large Plugins) — RECOMMENDED

Main file bootstraps the plugin. Each feature is a separate class file.

```
your-plugin-name.php    → Loads the plugin, defines constants
includes/class-loader.php → Registers all hooks
includes/class-admin.php  → Admin functionality
includes/class-public.php → Frontend functionality
```

---

## 21. Plugin Readme (readme.txt)

Required if submitting to the WordPress.org Plugin Directory.

```
=== Your Plugin Name ===
Contributors: yourwporgusername
Tags: tag1, tag2, tag3
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Short description of the plugin (under 150 characters).

== Description ==

Detailed description of what the plugin does.

== Installation ==

1. Upload `your-plugin-name` to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Go to Settings → Your Plugin to configure.

== Frequently Asked Questions ==

= How do I configure this plugin? =

Go to Settings → Your Plugin in your WordPress admin.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
```

---

## 22. Debugging

Enable debug mode in `wp-config.php` during development:

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );     // Logs errors to wp-content/debug.log
define( 'WP_DEBUG_DISPLAY', false ); // Hide errors from screen
define( 'SCRIPT_DEBUG', true );      // Use unminified core CSS/JS
```

Useful tools: Query Monitor plugin, Debug Bar plugin, WP-CLI.

---

## 23. Licensing

- WordPress is licensed under GPLv2 (or later).
- For maximum compatibility, use the same license: **GPL v2 or later**.
- All code, images, and data in the WordPress.org Plugin Directory must be GPL-compatible.
- Include the license text in your plugin header AND a separate LICENSE file.

---

## 24. Full Boilerplate Template

Here is a complete main plugin file you can copy and customize:

```php
<?php
/**
 * Plugin Name:       Your Plugin Name
 * Plugin URI:        https://yoursite.com/your-plugin/
 * Description:       Brief description of what this plugin does.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://yoursite.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       your-plugin-name
 * Domain Path:       /languages
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define plugin constants
define( 'YPLG_VERSION', '1.0.0' );
define( 'YPLG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'YPLG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'YPLG_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// ──────────────────────────────────────────────
// ACTIVATION / DEACTIVATION / UNINSTALL
// ──────────────────────────────────────────────
register_activation_hook( __FILE__, 'yplg_activate' );
function yplg_activate() {
    add_option( 'yplg_version', YPLG_VERSION );
    add_option( 'yplg_settings', array(
        'feature_enabled' => true,
    ) );
    flush_rewrite_rules();
}

register_deactivation_hook( __FILE__, 'yplg_deactivate' );
function yplg_deactivate() {
    flush_rewrite_rules();
    $timestamp = wp_next_scheduled( 'yplg_cron_hook' );
    if ( $timestamp ) {
        wp_unschedule_event( $timestamp, 'yplg_cron_hook' );
    }
}

// ──────────────────────────────────────────────
// LOAD TEXT DOMAIN
// ──────────────────────────────────────────────
add_action( 'init', 'yplg_load_textdomain' );
function yplg_load_textdomain() {
    load_plugin_textdomain( 'your-plugin-name', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}

// ──────────────────────────────────────────────
// ENQUEUE ASSETS
// ──────────────────────────────────────────────
add_action( 'wp_enqueue_scripts', 'yplg_enqueue_frontend' );
function yplg_enqueue_frontend() {
    wp_enqueue_style( 'yplg-style', YPLG_PLUGIN_URL . 'public/css/style.css', array(), YPLG_VERSION );
    wp_enqueue_script( 'yplg-script', YPLG_PLUGIN_URL . 'public/js/script.js', array( 'jquery' ), YPLG_VERSION, true );
    wp_localize_script( 'yplg-script', 'yplgData', array(
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'nonce'   => wp_create_nonce( 'yplg_ajax_nonce' ),
    ) );
}

add_action( 'admin_enqueue_scripts', 'yplg_enqueue_admin' );
function yplg_enqueue_admin( $hook_suffix ) {
    if ( 'toplevel_page_yplg-settings' !== $hook_suffix ) {
        return;
    }
    wp_enqueue_style( 'yplg-admin-style', YPLG_PLUGIN_URL . 'admin/css/admin.css', array(), YPLG_VERSION );
    wp_enqueue_script( 'yplg-admin-script', YPLG_PLUGIN_URL . 'admin/js/admin.js', array( 'jquery' ), YPLG_VERSION, true );
}

// ──────────────────────────────────────────────
// ADMIN MENU & SETTINGS
// ──────────────────────────────────────────────
add_action( 'admin_menu', 'yplg_add_admin_menu' );
function yplg_add_admin_menu() {
    add_menu_page(
        __( 'Your Plugin', 'your-plugin-name' ),
        __( 'Your Plugin', 'your-plugin-name' ),
        'manage_options',
        'yplg-settings',
        'yplg_settings_page_html',
        'dashicons-admin-generic',
        100
    );
}

function yplg_settings_page_html() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <form action="options.php" method="post">
            <?php
            settings_fields( 'yplg_settings_group' );
            do_settings_sections( 'yplg-settings' );
            submit_button( __( 'Save Settings', 'your-plugin-name' ) );
            ?>
        </form>
    </div>
    <?php
}

add_action( 'admin_init', 'yplg_register_settings' );
function yplg_register_settings() {
    register_setting( 'yplg_settings_group', 'yplg_settings', array(
        'sanitize_callback' => 'yplg_sanitize_settings',
    ) );

    add_settings_section( 'yplg_general', __( 'General', 'your-plugin-name' ), '__return_false', 'yplg-settings' );

    add_settings_field( 'yplg_feature_enabled', __( 'Enable Feature', 'your-plugin-name' ), 'yplg_field_feature_enabled', 'yplg-settings', 'yplg_general' );
}

function yplg_sanitize_settings( $input ) {
    $sanitized = array();
    $sanitized['feature_enabled'] = isset( $input['feature_enabled'] ) ? 1 : 0;
    return $sanitized;
}

function yplg_field_feature_enabled() {
    $options = get_option( 'yplg_settings' );
    $checked = ! empty( $options['feature_enabled'] ) ? 'checked' : '';
    echo '<input type="checkbox" name="yplg_settings[feature_enabled]" value="1" ' . esc_attr( $checked ) . '>';
}

// ──────────────────────────────────────────────
// SHORTCODE EXAMPLE
// ──────────────────────────────────────────────
add_shortcode( 'yplg_hello', 'yplg_hello_shortcode' );
function yplg_hello_shortcode( $atts ) {
    $atts = shortcode_atts( array(
        'name' => 'World',
    ), $atts, 'yplg_hello' );

    return '<p class="yplg-hello">' . esc_html(
        sprintf( __( 'Hello, %s!', 'your-plugin-name' ), $atts['name'] )
    ) . '</p>';
}

// ──────────────────────────────────────────────
// AJAX HANDLER EXAMPLE
// ──────────────────────────────────────────────
add_action( 'wp_ajax_yplg_action', 'yplg_ajax_handler' );
add_action( 'wp_ajax_nopriv_yplg_action', 'yplg_ajax_handler' );
function yplg_ajax_handler() {
    check_ajax_referer( 'yplg_ajax_nonce', 'nonce' );

    $data = sanitize_text_field( $_POST['data'] ?? '' );

    // Your logic here

    wp_send_json_success( array( 'message' => 'Done!' ) );
}
```

And the corresponding `uninstall.php`:

```php
<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    die;
}

delete_option( 'yplg_version' );
delete_option( 'yplg_settings' );
delete_site_option( 'yplg_version' );
delete_site_option( 'yplg_settings' );
```

---

## 25. Checklist Before Shipping

Use this checklist every time before deploying a plugin:

- [ ] **Header comment** is complete with all recommended fields
- [ ] **Direct access prevention** (`ABSPATH` check) on every PHP file
- [ ] **All functions/classes/constants** are prefixed uniquely
- [ ] **Nonces** are used on all forms and AJAX requests
- [ ] **Capability checks** on all admin actions
- [ ] **All input is sanitized** before saving
- [ ] **All output is escaped** before displaying
- [ ] **SQL queries use `$wpdb->prepare()`** — no raw user data in queries
- [ ] **Scripts/styles are enqueued** properly (not hardcoded)
- [ ] **Admin assets only load on YOUR pages** (check `$hook_suffix`)
- [ ] **Activation hook** sets up defaults / creates tables
- [ ] **Deactivation hook** clears temp data / cron events
- [ ] **Uninstall method** removes ALL plugin data cleanly
- [ ] **All user-facing strings** are wrapped in i18n functions
- [ ] **Text domain** matches the plugin directory name
- [ ] **`WP_DEBUG` is ON** during development — zero warnings/notices
- [ ] **License** is declared in the header and a LICENSE file exists
- [ ] **readme.txt** is complete (if submitting to wordpress.org)
- [ ] **Code follows WordPress Coding Standards** (PHPCS with WordPress ruleset)

---

## Official Resources

- [Plugin Developer Handbook](https://developer.wordpress.org/plugins/)
- [Plugin Basics](https://developer.wordpress.org/plugins/plugin-basics/)
- [Header Requirements](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/)
- [Best Practices](https://developer.wordpress.org/plugins/plugin-basics/best-practices/)
- [Plugin Security](https://developer.wordpress.org/plugins/security/)
- [Hooks (Actions & Filters)](https://developer.wordpress.org/plugins/hooks/)
- [Settings API](https://developer.wordpress.org/plugins/settings/)
- [REST API](https://developer.wordpress.org/plugins/rest-api/)
- [Internationalization](https://developer.wordpress.org/plugins/internationalization/)
- [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [WordPress Coding Standards (PHPCS)](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/)
- [WordPress Plugin Boilerplate](https://github.com/tommcfarlin/WordPress-Plugin-Boilerplate)

---

> **Built for:** Using as a reference guide when creating any custom WordPress plugin. Follow every section to ensure your plugin is secure, maintainable, and WordPress-standards compliant.
