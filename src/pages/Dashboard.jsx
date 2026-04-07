/**
 * Dashboard page.
 *
 * Shows aggregate scan stats, top codes, and a 30-day activity chart.
 * Full implementation in Phase 3.
 */

import { useState, useEffect } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { api } from '../api/client';

export default function Dashboard() {
	const [ data,    setData    ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error,   setError   ] = useState( null );

	useEffect( () => {
		api.dashboard()
			.then( setData )
			.catch( err => setError( err.message ) )
			.finally( () => setLoading( false ) );
	}, [] );

	if ( loading ) {
		return (
			<div className="qrjump-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	if ( error ) {
		return <p style={ { color: 'red' } }>{ error }</p>;
	}

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">Dashboard</h1>
			</div>

			<div className="qrjump-stats-grid">
				<StatCard label="Total Scans"   value={ data.total_scans }  />
				<StatCard label="Unique Scans"  value={ data.unique_scans } />
				<StatCard label="Repeat Scans"  value={ data.repeat_scans } />
				<StatCard label="Total Codes"   value={ data.total_codes }  />
				<StatCard label="Active Codes"  value={ data.active_codes } />
			</div>

			{ /* Phase 3: chart + top codes table here */ }
		</>
	);
}

function StatCard( { label, value } ) {
	return (
		<div className="qrjump-stat-card">
			<div className="qrjump-stat-card__label">{ label }</div>
			<div className="qrjump-stat-card__value">
				{ Number( value ).toLocaleString() }
			</div>
		</div>
	);
}
