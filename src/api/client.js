/**
 * QR Jump REST API client.
 *
 * Thin wrapper around the Fetch API:
 *   • Always sends the WP REST nonce (X-WP-Nonce header).
 *   • Always sends/expects JSON (except binary QR image endpoints).
 *   • Throws descriptive Error objects with `.code` and `.statusCode`.
 *
 * Binary image endpoints (qrUrl, qrPreviewUrl) return constructed URL strings
 * for use directly in <img src> or <a href> — the browser fetches them with
 * the nonce passed as _wpnonce query param (accepted by WP REST).
 */

const { apiUrl, nonce } = window.qrJumpData;

// ─── Internal helpers ────────────────────────────────────────────────────────

async function request( endpoint, options = {} ) {
	const url = `${ apiUrl }${ endpoint }`;

	const response = await fetch( url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce':   nonce,
			...( options.headers || {} ),
		},
	} );

	const data = await response.json().catch( () => ( {} ) );

	if ( ! response.ok ) {
		const err      = new Error( data.message || `HTTP ${ response.status }` );
		err.code       = data.code || 'unknown_error';
		err.statusCode = response.status;
		err.data       = data;
		throw err;
	}

	return { data, headers: response.headers };
}

async function get( endpoint, params = {} ) {
	const qs = new URLSearchParams( params ).toString();
	return request( qs ? `${ endpoint }?${ qs }` : endpoint );
}

async function post( endpoint, body = {} ) {
	const { data } = await request( endpoint, {
		method: 'POST',
		body:   JSON.stringify( body ),
	} );
	return data;
}

async function put( endpoint, body = {} ) {
	const { data } = await request( endpoint, {
		method: 'PUT',
		body:   JSON.stringify( body ),
	} );
	return data;
}

async function del( endpoint ) {
	const { data } = await request( endpoint, { method: 'DELETE' } );
	return data;
}

/** Build a signed image URL for use in <img src> or download links. */
function signedUrl( path, params = {} ) {
	const qs = new URLSearchParams( { _wpnonce: nonce, ...params } ).toString();
	return `${ apiUrl }${ path }?${ qs }`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {

	codes: {
		/**
		 * List codes.
		 *
		 * @param {Object} params  { page, per_page, search, status, orderby, order }
		 * @returns {Promise<{ data: Array, total: number, totalPages: number }>}
		 */
		list: async ( params = {} ) => {
			const { data, headers } = await get( '/codes', params );
			return {
				data,
				total:      parseInt( headers.get( 'X-WP-Total' ) || '0', 10 ),
				totalPages: parseInt( headers.get( 'X-WP-TotalPages' ) || '1', 10 ),
			};
		},

		/** @param {number} id */
		get: ( id ) => get( `/codes/${ id }` ).then( r => r.data ),

		/** @param {Object} payload */
		create: ( payload ) => post( '/codes', payload ),

		/** @param {number} id @param {Object} payload */
		update: ( id, payload ) => put( `/codes/${ id }`, payload ),

		/** @param {number} id */
		delete: ( id ) => del( `/codes/${ id }` ),

		/** @param {number} id */
		stats: ( id ) => get( `/codes/${ id }/stats` ).then( r => r.data ),

		/** @param {number} id */
		resetScans: ( id ) => del( `/codes/${ id }/scans` ),

		/** @param {number} id */
		duplicate: ( id ) => post( `/codes/${ id }/duplicate` ),

		/**
		 * @param {'delete'|'activate'|'deactivate'} action
		 * @param {number[]} ids
		 */
		bulk: ( action, ids ) => post( '/codes/bulk', { action, ids } ),

		/**
		 * Signed URL for the QR image of a saved code.
		 * Safe to use as <img src> or <a href download>.
		 *
		 * @param {number} id
		 * @param {Object} params  { format, size, download, fg_colour, bg_colour }
		 */
		qrUrl: ( id, params = {} ) => signedUrl( `/codes/${ id }/qr`, params ),
	},

	/**
	 * Signed URL for the QR preview endpoint (no saved code required).
	 *
	 * @param {string} url        The short URL to encode in the QR.
	 * @param {Object} params     { format, size, fg_colour, bg_colour }
	 */
	qrPreviewUrl: ( url, params = {} ) => signedUrl( '/qr-preview', { url, ...params } ),

	dashboard: () => get( '/dashboard' ).then( r => r.data ),

	settings: {
		get:    ()       => get( '/settings' ).then( r => r.data ),
		update: ( data ) => post( '/settings', data ),
	},

	slugs: {
		/**
		 * @param {string} slug
		 * @param {number} [excludeId=0]  Pass the current code ID when editing.
		 * @returns {Promise<{ valid: boolean, slug: string, message: string }>}
		 */
		validate: ( slug, excludeId = 0 ) =>
			post( '/slugs/validate', { slug, exclude_id: excludeId } ),
	},

	data: {
		/** Delete all codes and scans. confirm must equal "DELETE". */
		deleteAll: () => del( '/data/delete-all?confirm=DELETE' ),

		/**
		 * Trigger a file download of the export JSON directly in the browser.
		 * @param {boolean} includeScans
		 */
		exportDownload: ( includeScans = false ) => {
			const qs = new URLSearchParams( {
				_wpnonce:      nonce,
				include_scans: includeScans ? '1' : '0',
			} ).toString();
			window.location.href = `${ apiUrl }/data/export?${ qs }`;
		},

		/**
		 * Import a parsed JSON object (the contents of an export file).
		 * @param {Object} payload
		 * @returns {Promise<{ codes_imported: number, codes_skipped: number, scans_imported: number }>}
		 */
		import: ( payload ) => post( '/data/import', payload ),
	},
};
