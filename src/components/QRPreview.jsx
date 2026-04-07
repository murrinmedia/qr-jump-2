/**
 * QR code preview panel.
 *
 * Renders the generated QR image from the REST API.  Debounces colour changes
 * so the API is not hammered while the user drags a colour picker.
 *
 * For saved codes:   uses /codes/{id}/qr?fg_colour=...&bg_colour=...
 * For unsaved codes: uses /qr-preview?url=...&fg_colour=...&bg_colour=...
 *
 * The image src changes after debounce, which causes the browser to re-fetch
 * automatically — no extra JS required.
 */

import { useState, useEffect } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../api/client';

/**
 * @param {{
 *   codeId?:   number|null,   Pass null for unsaved codes.
 *   shortUrl?: string,        Short URL to encode (for unsaved / preview mode).
 *   fgColour:  string,
 *   bgColour:  string,
 *   slug?:     string,        Used only to derive download filename.
 * }} props
 */
export default function QRPreview( { codeId, shortUrl, fgColour, bgColour, slug = 'qr-code' } ) {
	const debouncedFg = useDebounce( fgColour, 600 );
	const debouncedBg = useDebounce( bgColour, 600 );

	const [ src,     setSrc     ] = useState( '' );
	const [ loaded,  setLoaded  ] = useState( false );
	const [ errored, setErrored ] = useState( false );

	useEffect( () => {
		setLoaded( false );
		setErrored( false );

		if ( codeId ) {
			setSrc( api.codes.qrUrl( codeId, {
				format:    'png',
				size:      300,
				fg_colour: debouncedFg,
				bg_colour: debouncedBg,
			} ) );
		} else if ( shortUrl ) {
			setSrc( api.qrPreviewUrl( shortUrl, {
				format:    'png',
				size:      300,
				fg_colour: debouncedFg,
				bg_colour: debouncedBg,
			} ) );
		} else {
			setSrc( '' );
		}
	}, [ codeId, shortUrl, debouncedFg, debouncedBg ] );

	const canDownload = !! codeId;

	return (
		<div className="qrjump-qr-preview">
			<h3 className="qrjump-qr-preview__title">QR Preview</h3>

			<div className="qrjump-qr-preview__image-wrap">
				{ src ? (
					<>
						{ ! loaded && ! errored && (
							<div className="qrjump-qr-preview__placeholder">
								<span className="qrjump-qr-preview__loader" />
							</div>
						) }
						<img
							src={ src }
							alt="QR code preview"
							className="qrjump-qr-preview__img"
							style={ { display: loaded ? 'block' : 'none' } }
							onLoad={ () => { setLoaded( true ); setErrored( false ); } }
							onError={ () => { setErrored( true ); setLoaded( false ); } }
						/>
						{ errored && (
							<div className="qrjump-qr-preview__placeholder qrjump-qr-preview__placeholder--error">
								<p>Preview unavailable.<br />Install Composer dependencies to enable QR generation.</p>
							</div>
						) }
					</>
				) : (
					<div className="qrjump-qr-preview__placeholder">
						<p>{ codeId
							? 'Generating preview…'
							: 'Enter a destination URL and slug to see a preview.' }
						</p>
					</div>
				) }
			</div>

			{ canDownload && (
				<div className="qrjump-qr-preview__downloads">
					<a
						href={ api.codes.qrUrl( codeId, { format: 'png', size: 1000, download: true } ) }
						download={ `${ slug }.png` }
						className="qrjump-btn qrjump-btn--secondary"
					>
						↓ Download PNG
					</a>
					<a
						href={ api.codes.qrUrl( codeId, { format: 'svg', download: true } ) }
						download={ `${ slug }.svg` }
						className="qrjump-btn qrjump-btn--secondary"
					>
						↓ Download SVG
					</a>
				</div>
			) }

			{ ! canDownload && shortUrl && (
				<p className="qrjump-qr-preview__save-hint">
					Save the code to enable high-resolution downloads.
				</p>
			) }
		</div>
	);
}
