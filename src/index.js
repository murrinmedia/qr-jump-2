/**
 * QR Jump — React admin application entry point.
 *
 * Uses @wordpress/element (React wrapper) so the React instance is shared
 * with the block editor and other WP components, avoiding version conflicts.
 *
 * Routing is hash-based (#/path) so it works inside any WordPress admin URL
 * without server-side routing configuration.
 */

import { createRoot } from '@wordpress/element';
import { HashRouter } from 'react-router-dom';
import App from './App';

import './style.scss';

const container = document.getElementById( 'qrjump-app' );

if ( container ) {
	const root = createRoot( container );
	root.render(
		<HashRouter>
			<App />
		</HashRouter>
	);
}
