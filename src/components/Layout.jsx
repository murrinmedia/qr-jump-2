/**
 * Application shell — sidebar navigation + main content area.
 */

import { NavLink } from 'react-router-dom';

const NAV = [
	{
		to:    '/',
		label: 'Dashboard',
		icon:  (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
				<rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
			</svg>
		),
	},
	{
		to:    '/codes',
		label: 'QR Codes',
		icon:  (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<rect x="3" y="3" width="5" height="5" /><rect x="3" y="16" width="5" height="5" />
				<rect x="16" y="3" width="5" height="5" />
				<path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M7 21v-3" />
			</svg>
		),
	},
	{
		to:    '/settings',
		label: 'Settings',
		icon:  (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</svg>
		),
	},
];

export default function Layout( { children } ) {
	return (
		<div className="qrjump-layout">
			<aside className="qrjump-sidebar">
				<div className="qrjump-sidebar__logo">
					<span className="qrjump-sidebar__logo-icon" aria-hidden="true">⊞</span>
					QR Jump
				</div>

				<nav aria-label="QR Jump navigation">
					<ul className="qrjump-sidebar__nav">
						{ NAV.map( ( { to, label, icon } ) => (
							<li key={ to } className="qrjump-sidebar__nav-item">
								<NavLink
									to={ to }
									end={ to === '/' }
									className={ ( { isActive } ) =>
										`qrjump-sidebar__nav-link${ isActive ? ' qrjump-sidebar__nav-link--active' : '' }`
									}
								>
									<span className="qrjump-sidebar__nav-icon">{ icon }</span>
									{ label }
								</NavLink>
							</li>
						) ) }
					</ul>
				</nav>

				<div className="qrjump-sidebar__footer">
					<span>v{ window.qrJumpData?.version }</span>
				</div>
			</aside>

			<main className="qrjump-main" id="qrjump-main-content">
				{ children }
			</main>
		</div>
	);
}
