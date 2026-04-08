/**
 * Line chart with Y-axis gridlines and X-axis date labels.
 *
 * The last data point is shown with a dashed segment to indicate
 * "today" is still in progress.
 */

const W     = 700;
const H     = 175;
const PAD_L = 38;   // space for Y-axis labels
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 32;   // space for X-axis labels

const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export default function ScanChart( { data = [] } ) {
	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data yet.</p>
			</div>
		);
	}

	const values = data.map( d => Number( d.scans ) );
	const yMax   = niceMax( Math.max( ...values, 1 ) );

	// 5 Y-axis gridlines including 0.
	const yTicks = [ 0, 0.25, 0.5, 0.75, 1 ].map( f => Math.round( f * yMax ) );

	// X-axis: show ~7 evenly-spaced date labels.
	const step = Math.max( 1, Math.ceil( data.length / 7 ) );

	const toX = i  => PAD_L + ( i / Math.max( data.length - 1, 1 ) ) * PLOT_W;
	const toY = v  => PAD_T + ( 1 - v / yMax ) * PLOT_H;

	const pts = values.map( ( v, i ) => ( { x: toX( i ), y: toY( v ) } ) );

	const solidPts = pts.length > 1 ? pts.slice( 0, -1 ) : pts;
	const solidPath = cardinalPath( solidPts );

	// Fill covers all points so the area under the dashed segment is also filled.
	const fullPath  = cardinalPath( pts );
	const bottom    = PAD_T + PLOT_H;
	const fillPath  = `${ fullPath } L ${ pts[ pts.length - 1 ].x } ${ bottom } L ${ pts[0].x } ${ bottom } Z`;

	const lastSolid = pts[ pts.length - 2 ] || pts[0];
	const lastPt    = pts[ pts.length - 1 ];

	return (
		<svg
			viewBox={ `0 0 ${ W } ${ H }` }
			width="100%"
			style={ { display: 'block' } }
			role="img"
			aria-label="Scan activity chart"
		>
			<defs>
				<linearGradient id="qrjump-scan-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%"   stopColor="#2271b1" stopOpacity="0.13" />
					<stop offset="100%" stopColor="#2271b1" stopOpacity="0.01" />
				</linearGradient>
				<clipPath id="qrjump-scan-clip">
					<rect x={ PAD_L } y={ PAD_T } width={ PLOT_W } height={ PLOT_H } />
				</clipPath>
			</defs>

			{ /* Y-axis gridlines + labels */ }
			{ yTicks.map( tick => {
				const y = toY( tick );
				return (
					<g key={ tick }>
						<line x1={ PAD_L } y1={ y } x2={ W - PAD_R } y2={ y } stroke="#e5e7eb" strokeWidth="1" />
						<text x={ PAD_L - 5 } y={ y } textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#9ca3af">
							{ tick }
						</text>
					</g>
				);
			} ) }

			{ /* X-axis date labels */ }
			{ data.map( ( d, i ) => {
				if ( i % step !== 0 && i !== data.length - 1 ) return null;
				return (
					<text key={ d.date } x={ toX( i ) } y={ H - PAD_B + 16 } textAnchor="middle" fontSize="11" fill="#9ca3af">
						{ fmtDate( d.date ) }
					</text>
				);
			} ) }

			{ /* Gradient fill */ }
			<path d={ fillPath } fill="url(#qrjump-scan-fill)" clipPath="url(#qrjump-scan-clip)" />

			{ /* Solid line (all segments except the last "today" segment) */ }
			{ pts.length > 0 && (
				<path d={ solidPath } fill="none" stroke="#2271b1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#qrjump-scan-clip)" />
			) }

			{ /* Dashed last segment = today (in progress) */ }
			{ pts.length > 1 && (
				<line
					x1={ lastSolid.x } y1={ lastSolid.y }
					x2={ lastPt.x }    y2={ lastPt.y }
					stroke="#2271b1" strokeWidth="2"
					strokeDasharray="5 4" strokeLinecap="round"
					clipPath="url(#qrjump-scan-clip)"
				/>
			) }
		</svg>
	);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function cardinalPath( points ) {
	if ( points.length === 0 ) return '';
	if ( points.length === 1 ) return `M ${ points[0].x } ${ points[0].y }`;
	const t = 0.35;
	let d = `M ${ points[0].x } ${ points[0].y }`;
	for ( let i = 0; i < points.length - 1; i++ ) {
		const p0 = points[ Math.max( i - 1, 0 ) ];
		const p1 = points[ i ];
		const p2 = points[ i + 1 ];
		const p3 = points[ Math.min( i + 2, points.length - 1 ) ];
		d += ` C ${ p1.x + ( p2.x - p0.x ) * t } ${ p1.y + ( p2.y - p0.y ) * t },${ p2.x - ( p3.x - p1.x ) * t } ${ p2.y - ( p3.y - p1.y ) * t },${ p2.x } ${ p2.y }`;
	}
	return d;
}

function niceMax( v ) {
	if ( v <= 0 ) return 5;
	const mag  = Math.pow( 10, Math.floor( Math.log10( v ) ) );
	const norm = v / mag;
	const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
	return nice * mag;
}

function fmtDate( dateStr ) {
	const d = new Date( dateStr + 'T00:00:00' );
	return d.toLocaleDateString( 'en', { day: 'numeric', month: 'short' } );
}
