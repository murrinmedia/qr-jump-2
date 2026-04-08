/**
 * Application shell — horizontal top navigation + main content area.
 */

import { NavLink } from 'react-router-dom';

const NAV = [
	{ to: '/',        label: 'Dashboard', end: true  },
	{ to: '/codes',   label: 'QR Codes',  end: false },
	{ to: '/settings',label: 'Settings',  end: false },
];

export default function Layout( { children } ) {
	const pluginUrl = window.qrJumpData?.pluginUrl || '';

	return (
		<div className="qrjump-layout">
			<header className="qrjump-topbar">
				<div className="qrjump-topbar__brand">
					{ pluginUrl ? (
						<img
							src={ `${ pluginUrl }assets/qrjump-logo.svg` }
							alt="QR Jump"
							className="qrjump-topbar__logo"
						/>
					) : (
						<span className="qrjump-topbar__logo-text">QR Jump</span>
					) }
				</div>

				<nav aria-label="QR Jump navigation" className="qrjump-topbar__nav">
					{ NAV.map( ( { to, label, end } ) => (
						<NavLink
							key={ to }
							to={ to }
							end={ end }
							className={ ( { isActive } ) =>
								`qrjump-topbar__nav-link${ isActive ? ' qrjump-topbar__nav-link--active' : '' }`
							}
						>
							{ label }
						</NavLink>
					) ) }
				</nav>

				<div className="qrjump-topbar__meta">
					v{ window.qrJumpData?.version }
				</div>
			</header>

			<main className="qrjump-main" id="qrjump-main-content">
				{ children }
			</main>
		</div>
	);
}
