/**
 * QR Jump REST API client.
 *
 * A thin wrapper around the Fetch API that:
 *   • Always sets the WP REST nonce header.
 *   • Always sends/expects JSON (except for the binary QR image endpoint).
 *   • Throws descriptive errors with the WP REST error code attached.
 */

const { apiUrl, nonce } = window.qrJumpData;

// ─── Core request helper ──────────────────────────────────────────────────────

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
		const err = new Error( data.message || `HTTP ${ response.status }` );
		err.code       = data.code || 'unknown_error';
		err.statusCode = response.status;
		err.data       = data;
		throw err;
	}

	return { data, headers: response.headers };
}

// Convenience shorthand that unwraps the data payload.
async function get( endpoint, params = {} ) {
	const qs = new URLSearchParams( params ).toString();
	const { data, headers } = await request( qs ? `${ endpoint }?${ qs }` : endpoint );
	return { data, headers };
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

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {

	codes: {
		/**
		 * List codes with optional filtering / sorting / pagination.
		 *
		 * @param {Object} params
		 * @returns {Promise<{data: Array, total: number, totalPages: number}>}
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

		/**
		 * Partial update — only fields present in payload are written.
		 *
		 * @param {number} id
		 * @param {Object} payload
		 */
		update: ( id, payload ) => put( `/codes/${ id }`, payload ),

		/** @param {number} id */
		delete: ( id ) => del( `/codes/${ id }` ),

		/** @param {number} id */
		stats: ( id ) => get( `/codes/${ id }/stats` ).then( r => r.data ),

		/**
		 * Build the QR image URL for use in <img src="..."> or download links.
		 * Nonce is passed as a query param so the browser can load the image directly.
		 *
		 * @param {number} id
		 * @param {Object} params  { format: 'png'|'svg', size: number, download: boolean }
		 */
		qrUrl: ( id, params = {} ) => {
			const qs = new URLSearchParams( { _wpnonce: nonce, ...params } ).toString();
			return `${ apiUrl }/codes/${ id }/qr?${ qs }`;
		},
	},

	dashboard: () => get( '/dashboard' ).then( r => r.data ),

	settings: {
		get:    ()       => get( '/settings' ).then( r => r.data ),
		update: ( data ) => post( '/settings', data ),
	},

	slugs: {
		/**
		 * Check if a slug is available.
		 *
		 * @param {string} slug
		 * @param {number} [excludeId=0]  Pass the current code ID when editing.
		 * @returns {Promise<{valid: boolean, slug: string, message: string}>}
		 */
		validate: ( slug, excludeId = 0 ) =>
			post( '/slugs/validate', { slug, exclude_id: excludeId } ),
	},
};
