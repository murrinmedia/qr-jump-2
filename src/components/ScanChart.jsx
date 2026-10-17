/**
 * Daily scans line chart with gridlines, date labels and a hover tooltip.
 *
 * The last data point is drawn with a dashed segment to show that "today"
 * is still in progress. Sized to its container.
 */

import { useState } from '@wordpress/element';
import {
	CHART_ACCENT,
	CHART_GRID,
	CHART_LABEL,
	cardinalPath,
	niceMax,
	useChartWidth,
	Tooltip,
} from './chartUtils';

const PAD_L = 40;   // space for Y-axis labels
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;   // space for X-axis labels

export default function ScanChart( { data = [], height = 240 } ) {
	const [ ref, W ]            = useChartWidth();
	const [ hover, setHover ]   = useState( null );

	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data yet.</p>
			</div>
		);
	}

	const H      = height;
	const PLOT_W = W - PAD_L - PAD_R;
	const PLOT_H = H - PAD_T - PAD_B;

	const values = data.map( d => Number( d.scans ) );
	const yMax   = niceMax( Math.max( ...values, 1 ) );
	const yTicks = [ 0, 0.25, 0.5, 0.75, 1 ].map( f => Math.round( f * yMax ) );

	// As many evenly spaced date labels as fit (~80px each).
	const maxLabels = Math.max( 2, Math.floor( PLOT_W / 80 ) );
	const step      = Math.max( 1, Math.ceil( data.length / maxLabels ) );

	const toX = i => PAD_L + ( i / Math.max( data.length - 1, 1 ) ) * PLOT_W;
	const toY = v => PAD_T + ( 1 - v / yMax ) * PLOT_H;

	const pts       = values.map( ( v, i ) => ( { x: toX( i ), y: toY( v ) } ) );
	const solidPath = cardinalPath( pts.length > 1 ? pts.slice( 0, -1 ) : pts );
	const bottom    = PAD_T + PLOT_H;
	const fillPath  = `${ cardinalPath( pts ) } L ${ pts[ pts.length - 1 ].x } ${ bottom } L ${ pts[0].x } ${ bottom } Z`;
	const lastSolid = pts[ pts.length - 2 ] || pts[0];
	const lastPt    = pts[ pts.length - 1 ];

	function onMove( e ) {
		const rect = e.currentTarget.getBoundingClientRect();
		const i    = Math.round( ( ( e.clientX - rect.left - PAD_L ) / PLOT_W ) * ( data.length - 1 ) );
		setHover( Math.min( Math.max( i, 0 ), data.length - 1 ) );
	}

	const active = hover !== null ? data[ hover ] : null;

	return (
		<div ref={ ref } className="qrjump-chart">
			<svg
				width={ W }
				height={ H }
				style={ { display: 'block', overflow: 'visible' } }
				role="img"
				aria-label="Scan activity chart"
				onMouseMove={ onMove }
				onMouseLeave={ () => setHover( null ) }
			>
				<defs>
					<linearGradient id="qrjump-scan-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%"   stopColor={ CHART_ACCENT } stopOpacity="0.2" />
						<stop offset="100%" stopColor={ CHART_ACCENT } stopOpacity="0" />
					</linearGradient>
					<clipPath id="qrjump-scan-clip">
						<rect x={ PAD_L } y={ PAD_T - 2 } width={ PLOT_W } height={ PLOT_H + 4 } />
					</clipPath>
				</defs>

				{ yTicks.map( tick => {
					const y = toY( tick );
					return (
						<g key={ tick }>
							<line x1={ PAD_L } y1={ y } x2={ W - PAD_R } y2={ y } stroke={ CHART_GRID } strokeWidth="1" />
							<text x={ PAD_L - 10 } y={ y } textAnchor="end" dominantBaseline="middle" fontSize="12" fill={ CHART_LABEL }>
								{ tick }
							</text>
						</g>
					);
				} ) }

				{ data.map( ( d, i ) => {
					if ( i % step !== 0 && i !== data.length - 1 ) return null;
					// Skip the second-to-last tick when it would collide with the final label.
					if ( i !== data.length - 1 && data.length - 1 - i < step * 0.6 ) return null;
					return (
						<text key={ d.date } x={ toX( i ) } y={ H - PAD_B + 20 } textAnchor="middle" fontSize="12" fill={ CHART_LABEL }>
							{ fmtShort( d.date ) }
						</text>
					);
				} ) }

				<path d={ fillPath } fill="url(#qrjump-scan-fill)" clipPath="url(#qrjump-scan-clip)" />

				<path d={ solidPath } fill="none" stroke={ CHART_ACCENT } strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#qrjump-scan-clip)" />

				{ pts.length > 1 && (
					<line
						x1={ lastSolid.x } y1={ lastSolid.y }
						x2={ lastPt.x }    y2={ lastPt.y }
						stroke={ CHART_ACCENT } strokeWidth="2.5"
						strokeDasharray="5 4" strokeLinecap="round"
						clipPath="url(#qrjump-scan-clip)"
					/>
				) }

				{ active && (
					<g>
						<line x1={ pts[ hover ].x } y1={ PAD_T } x2={ pts[ hover ].x } y2={ bottom } stroke={ CHART_ACCENT } strokeOpacity="0.25" strokeWidth="1" />
						<circle cx={ pts[ hover ].x } cy={ pts[ hover ].y } r="5" fill="#fff" stroke={ CHART_ACCENT } strokeWidth="2.5" />
						<Tooltip
							x={ pts[ hover ].x }
							y={ pts[ hover ].y }
							width={ W }
							lines={ [
								fmtLong( active.date ),
								`${ Number( active.scans ).toLocaleString() } scan${ Number( active.scans ) === 1 ? '' : 's' }`,
							] }
						/>
					</g>
				) }
			</svg>
		</div>
	);
}

function fmtShort( dateStr ) {
	return new Date( dateStr + 'T00:00:00' ).toLocaleDateString( 'en', { day: 'numeric', month: 'short' } );
}

function fmtLong( dateStr ) {
	return new Date( dateStr + 'T00:00:00' ).toLocaleDateString( 'en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } );
}
