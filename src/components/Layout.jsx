/**
 * Application shell — sidebar navigation + main content area.
 */

import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
	{ to: '/',         label: 'Dashboard' },
	{ to: '/codes',    label: 'QR Codes'  },
	{ to: '/settings', label: 'Settings'  },
];

export default function Layout( { children } ) {
	return (
		<div className="qrjump-layout">
			<aside className="qrjump-sidebar">
				<div className="qrjump-sidebar__logo">QR Jump</div>
				<ul className="qrjump-sidebar__nav">
					{ NAV_ITEMS.map( ( { to, label } ) => (
						<li
							key={ to }
							className="qrjump-sidebar__nav-item"
						>
							<NavLink
								to={ to }
								end={ to === '/' }
								className={ ( { isActive } ) =>
									isActive ? 'qrjump-sidebar__nav-item--active' : undefined
								}
							>
								{ label }
							</NavLink>
						</li>
					) ) }
				</ul>
			</aside>

			<main className="qrjump-main">
				{ children }
			</main>
		</div>
	);
}
