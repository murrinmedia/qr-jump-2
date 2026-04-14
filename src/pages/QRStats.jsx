/**
 * Per-code stats page.
 *
 * Shows totals, a 30-day daily chart, hour-of-day breakdown,
 * and top referrers for a single QR code.
 */

import { useState, useEffect } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ScanChart from '../components/ScanChart';

export default function QRStats() {
	const { id }   = useParams();
	const navigate = useNavigate();

	const [ code,    setCode    ] = useState( null );
	const [ stats,   setStats   ] = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error,   setError   ] = useState( null );

	useEffect( () => {
		Promise.all( [ api.codes.get( id ), api.codes.stats( id ) ] )
			.then( ( [ codeData, statsData ] ) => {
				setCode( codeData );
				setStats( statsData );
			} )
			.catch( err => setError( err.message ) )
			.finally( () => setLoading( false ) );
	}, [ id ] );

	if ( loading ) return <div className="qrjump-spinner-wrap"><Spinner /></div>;

	if ( error ) return (
		<div className="qrjump-notice qrjump-notice--error">{ error }</div>
	);

	const prefix  = window.qrJumpData?.redirectPrefix || 'qr';
	const homeUrl = ( window.qrJumpData?.homeUrl || '' ).replace( /\/$/, '' );
	const shortUrl = `${ homeUrl }/${ prefix }/${ code.slug }`;

	return (
		<>
			<div className="qrjump-page-header">
				<div>
					<h1 className="qrjump-page-header__title">
						{ code.title || code.slug }
					</h1>
					<p style={ { margin: '4px 0 0', fontSize: 12, color: 'var(--qrjump-text-muted)' } }>
						<a href={ shortUrl } target="_blank" rel="noreferrer">{ shortUrl }</a>
					</p>
				</div>
				<div style={ { display: 'flex', gap: 8 } }>
					<Button variant="secondary" onClick={ () => navigate( `/codes/${ id }/edit` ) }>
						Edit code
					</Button>
					<Button variant="tertiary" onClick={ () => navigate( '/codes' ) }>
						← Back
					</Button>
				</div>
			</div>

			{ /* ── Totals ── */ }
			<div className="qrjump-stats-grid" style={ { marginBottom: 24 } }>
				<StatCard label="Total scans"  value={ stats.total        } />
				<StatCard label="Unique"        value={ stats.unique_scans } />
				<StatCard label="Repeat"        value={ stats.repeat_scans } />
				<StatCard
					label="Last scan"
					value={ stats.last_scanned_at
						? new Date( stats.last_scanned_at + 'Z' ).toLocaleDateString()
						: 'Never'
					}
					small
				/>
			</div>

			{ /* ── 30-day chart ── */ }
			<div className="qrjump-card" style={ { marginBottom: 20 } }>
				<div className="qrjump-card__header">
					<h2 className="qrjump-card__title">Daily scans — last 30 days</h2>
				</div>
				<div className="qrjump-card__content">
					{ stats.daily && stats.daily.length > 0
						? <ScanChart data={ stats.daily } height={ 120 } />
						: <p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No scan data yet.</p>
					}
				</div>
			</div>

			<div className="qrjump-dashboard-grid">

				{ /* ── Hour of day ── */ }
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">Scans by hour of day</h2>
					</div>
					<div className="qrjump-card__content">
						{ stats.hourly && stats.hourly.length > 0 ? (
							<HourChart data={ stats.hourly } />
						) : (
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No data yet.</p>
						) }
					</div>
				</div>

				{ /* ── Top referrers ── */ }
				<div className="qrjump-card">
					<div className="qrjump-card__header">
						<h2 className="qrjump-card__title">Top referrers</h2>
					</div>
					{ stats.referrers && stats.referrers.length > 0 ? (
						<table className="qrjump-table">
							<thead>
								<tr>
									<th>Referrer</th>
									<th style={ { textAlign: 'right' } }>Scans</th>
								</tr>
							</thead>
							<tbody>
								{ stats.referrers.map( ( r, i ) => (
									<tr key={ i }>
										<td style={ { fontSize: 12, wordBreak: 'break-all' } }>
											{ r.referrer || <em style={ { color: 'var(--qrjump-text-muted)' } }>Direct / unknown</em> }
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( r.scans ).toLocaleString() }
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					) : (
						<div className="qrjump-card__content">
							<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No referrer data yet.</p>
						</div>
					) }
				</div>

			</div>
		</>
	);
}

function StatCard( { label, value, small = false } ) {
	return (
		<div className="qrjump-stat-card">
			<div className="qrjump-stat-card__label">{ label }</div>
			<div className="qrjump-stat-card__value" style={ small ? { fontSize: 16 } : {} }>
				{ typeof value === 'number' ? Number( value ).toLocaleString() : value }
			</div>
		</div>
	);
}

/** Simple horizontal bar chart for 24-hour breakdown. */
function HourChart( { data } ) {
	const filled = Array.from( { length: 24 }, ( _, h ) => {
		const found = data.find( d => Number( d.hour ) === h );
		return { hour: h, scans: found ? Number( found.scans ) : 0 };
	} );

	const max = Math.max( ...filled.map( d => d.scans ), 1 );

	return (
		<div className="qrjump-hour-chart">
			{ filled.map( ( { hour, scans } ) => (
				<div key={ hour } className="qrjump-hour-chart__row">
					<span className="qrjump-hour-chart__label">
						{ String( hour ).padStart( 2, '0' ) }:00
					</span>
					<div className="qrjump-hour-chart__bar-wrap">
						<div
							className="qrjump-hour-chart__bar"
							style={ { width: `${ ( scans / max ) * 100 }%` } }
						/>
					</div>
					<span className="qrjump-hour-chart__count">{ scans || '' }</span>
				</div>
			) ) }
		</div>
	);
}
