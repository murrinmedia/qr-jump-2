/**
 * Root application component.
 *
 * Defines all client-side routes and wraps the layout shell.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import QRList from './pages/QRList';
import QREdit from './pages/QREdit';
import Settings from './pages/Settings';

export default function App() {
	return (
		<Layout>
			<Routes>
				<Route path="/"                 element={ <Dashboard /> } />
				<Route path="/codes"            element={ <QRList /> } />
				<Route path="/codes/new"        element={ <QREdit /> } />
				<Route path="/codes/:id/edit"   element={ <QREdit /> } />
				<Route path="/settings"         element={ <Settings /> } />
				{ /* Fallback — redirect unknown paths to the dashboard. */ }
				<Route path="*" element={ <Navigate to="/" replace /> } />
			</Routes>
		</Layout>
	);
}
