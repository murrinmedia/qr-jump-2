/**
 * Dashboard page.
 *
 * Shows aggregate scan stats, a 30-day activity chart, top QR codes,
 * and recent scan activity.
 */

import { useState, useEffect } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ScanChart from '../components/ScanChart';
import HourChart from '../components/HourChart';
import StatCard from '../components/StatCard';
import RangeSelect, { useRangeDays, rangeLabel } from '../components/RangeSelect';

export default function Dashboard() {
	const navigate = useNavigate();

	const [ days,    setDays    ] = useRangeDays();
	const [ data,    setData    ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error,   setError   ] = useState( null );

	useEffect( () => {
		let cancelled = false;
		api.dashboard( days )
			.then( d => { if ( ! cancelled ) { setData( d ); setError( null ); } } )
			.catch( err => { if ( ! cancelled ) setError( err.message ); } )
			.finally( () => { if ( ! cancelled ) setLoading( false ); } );
		return () => { cancelled = true; };
	}, [ days ] );

	if ( loading ) {
		return (
			<div className="qrjump-spinner-wrap">
				<Spinner />
			</div>
		);
	}

	if ( error ) {
		return (
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">Dashboard</h1>
				<p className="qrjump-notice qrjump-notice--error">{ error }</p>
			</div>
		);
	}

	const prefix = window.qrJumpData?.redirectPrefix || 'go';
	const homeUrl = window.qrJumpData?.homeUrl || '';

	const prevLabel = days > 0 ? `previous ${ days } days` : '';
	const prev      = data.previous || null;

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">Dashboard</h1>
				<RangeSelect value={ days } onChange={ setDays } />
			</div>

			{ /* ── Stat cards ── */ }
			<div className="qrjump-stats-grid">
				<StatCard label="Total Scans"  value={ data.total_scans }  previous={ prev ? prev.total : null }        previousLabel={ prevLabel } />
				<StatCard label="Unique Scans" value={ data.unique_scans } previous={ prev ? prev.unique_scans : null } previousLabel={ prevLabel } />
				<StatCard label="Repeat Scans" value={ data.repeat_scans } previous={ prev ? prev.repeat_scans : null } previousLabel={ prevLabel } />
				{ data.bot_scans > 0 && (
					<StatCard label="Bot hits (excluded)" value={ data.bot_scans } />
				) }
				<StatCard label="Total Codes"  value={ data.total_codes }  />
				<StatCard label="Active Codes" value={ data.active_codes } />
			</div>

			{ /* ── Two-column lower section ── */ }
			<div className="qrjump-dashboard-grid">

				{ /* Top codes */ }
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">Top QR Codes <span className="qrjump-card__subtitle">{ rangeLabel( days ) }</span></h2>
					</div>
					{ data.top_codes && data.top_codes.length > 0 ? (
						<table className="qrjump-table">
							<thead>
								<tr>
									<th>Title / Slug</th>
									<th style={ { textAlign: 'right' } }>Scans</th>
									<th style={ { textAlign: 'right' } }>Unique</th>
								</tr>
							</thead>
							<tbody>
								{ data.top_codes.map( code => (
									<tr
										key={ code.id }
										onClick={ () => navigate( `/codes/${ code.id }/edit` ) }
										style={ { cursor: 'pointer' } }
									>
										<td>
											<strong style={ { display: 'block' } }>
												{ code.title || code.slug }
											</strong>
											<span style={ { fontSize: 11, color: 'var(--qrjump-text-muted)' } }>
												{ homeUrl }/{ prefix }/{ code.slug }
											</span>
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( code.total_scans ).toLocaleString() }
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--qrjump-text-muted)' } }>
											{ Number( code.unique_scans ).toLocaleString() }
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					) : (
						<div className="qrjump-card__content">
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>
								No scan data yet.
							</p>
						</div>
					) }
				</div>

				{ /* Recent scans */ }
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">Recent Scans</h2>
					</div>
					{ data.recent_scans && data.recent_scans.length > 0 ? (
						<table className="qrjump-table">
							<thead>
								<tr>
									<th>Code</th>
									<th>Type</th>
									<th style={ { textAlign: 'right' } }>When</th>
								</tr>
							</thead>
							<tbody>
								{ data.recent_scans.map( ( scan, i ) => (
									<tr key={ i }>
										<td>
											<span
												style={ { cursor: 'pointer', color: 'var(--qrjump-accent)' } }
												onClick={ () => navigate( `/codes/${ scan.qr_code_id }/edit` ) }
											>
												{ scan.code_title || scan.slug || `Code #${ scan.qr_code_id }` }
											</span>
										</td>
										<td>
											<span className={ `qrjump-badge qrjump-badge--${ scan.scan_type === 'unique' ? 'active' : 'inactive' }` }>
												{ scan.scan_type }
											</span>
										</td>
										<td style={ { textAlign: 'right', color: 'var(--qrjump-text-muted)', fontSize: 12, whiteSpace: 'nowrap' } }>
											{ formatRelativeTime( scan.scanned_at ) }
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					) : (
						<div className="qrjump-card__content">
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>
								No recent scans.
							</p>
						</div>
					) }
				</div>

			</div>

			{ /* ── Charts (below the tables) ── */ }
			<div className="qrjump-dashboard-grid" style={ { marginTop: 24 } }>
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">
							Daily scans <span className="qrjump-card__subtitle">{ days > 0 ? rangeLabel( days ) : 'last 12 months' }</span>
						</h2>
					</div>
					<div className="qrjump-card__content">
						{ data.daily && data.daily.length > 0 ? (
							<ScanChart data={ data.daily } />
						) : (
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No scan data yet.</p>
						) }
					</div>
				</div>
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">
							Scans by hour of day <span className="qrjump-card__subtitle">{ rangeLabel( days ) }</span>
						</h2>
					</div>
					<div className="qrjump-card__content">
						{ data.hourly && data.hourly.length > 0 ? (
							<HourChart data={ data.hourly } />
						) : (
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No scan data yet.</p>
						) }
					</div>
				</div>
			</div>
		</>
	);
}

/** Returns a human-readable relative time string for a UTC datetime string. */
function formatRelativeTime( datetimeStr ) {
	if ( ! datetimeStr ) return '—';
	const diff = Math.floor( ( Date.now() - new Date( datetimeStr + 'Z' ) ) / 1000 );

	if ( diff < 60 )        return 'just now';
	if ( diff < 3600 )      return `${ Math.floor( diff / 60 ) }m ago`;
	if ( diff < 86400 )     return `${ Math.floor( diff / 3600 ) }h ago`;
	if ( diff < 86400 * 7 ) return `${ Math.floor( diff / 86400 ) }d ago`;

	return new Date( datetimeStr + 'Z' ).toLocaleDateString();
}
