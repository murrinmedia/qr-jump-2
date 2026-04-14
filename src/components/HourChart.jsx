/**
 * Line chart for scans by hour of day (0–23).
 * Same style as ScanChart — axes, gridlines, gradient fill.
 */

const W      = 700;
const H      = 160;
const PAD_L  = 38;
const PAD_R  = 12;
const PAD_T  = 12;
const PAD_B  = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export default function HourChart( { data = [] } ) {
	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data yet.</p>
			</div>
		);
	}

	const values = Array.from( { length: 24 }, ( _, h ) => {
		const found = data.find( d => Number( d.hour ) === h );
		return found ? Number( found.scans ) : 0;
	} );

	const yMax   = niceMax( Math.max( ...values, 1 ) );
	const yTicks = [ 0, 0.5, 1 ].map( f => Math.round( f * yMax ) );

	const toX = i => PAD_L + ( i / 23 ) * PLOT_W;
	const toY = v => PAD_T + ( 1 - v / yMax ) * PLOT_H;

	const pts      = values.map( ( v, i ) => ( { x: toX( i ), y: toY( v ) } ) );
	const linePath = cardinalPath( pts );
	const bottom   = PAD_T + PLOT_H;
	const fillPath = `${ linePath } L ${ pts[23].x } ${ bottom } L ${ pts[0].x } ${ bottom } Z`;

	const xLabels = [ 0, 6, 12, 18, 23 ];

	return (
		<svg
			viewBox={ `0 0 ${ W } ${ H }` }
			width="100%"
			style={ { display: 'block' } }
			role="img"
			aria-label="Scans by hour of day"
		>
			<defs>
				<linearGradient id="qrjump-hour-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%"   stopColor="#2271b1" stopOpacity="0.13" />
					<stop offset="100%" stopColor="#2271b1" stopOpacity="0.01" />
				</linearGradient>
				<clipPath id="qrjump-hour-clip">
					<rect x={ PAD_L } y={ PAD_T } width={ PLOT_W } height={ PLOT_H } />
				</clipPath>
			</defs>

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

			{ xLabels.map( h => (
				<text key={ h } x={ toX( h ) } y={ H - PAD_B + 16 } textAnchor="middle" fontSize="11" fill="#9ca3af">
					{ String( h ).padStart( 2, '0' ) }:00
				</text>
			) ) }

			<path d={ fillPath } fill="url(#qrjump-hour-fill)" clipPath="url(#qrjump-hour-clip)" />
			<path d={ linePath } fill="none" stroke="#2271b1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#qrjump-hour-clip)" />
		</svg>
	);
}

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
