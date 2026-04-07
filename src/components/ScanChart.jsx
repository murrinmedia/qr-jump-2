/**
 * SVG line chart for scan activity.
 *
 * Renders a smooth polyline connecting daily scan counts, with a soft
 * gradient fill beneath the line.
 */
export default function ScanChart( { data = [], height = 120 } ) {
	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data in the past 30 days.</p>
			</div>
		);
	}

	const W     = 800;
	const H     = height;
	const PAD_T = 10;   // top padding so the line isn't clipped
	const PAD_B = 4;    // bottom padding
	const PAD_X = 6;    // left/right padding

	const values = data.map( d => Number( d.scans ) );
	const maxVal = Math.max( ...values, 1 );

	// Map each data point to pixel coordinates.
	const pts = values.map( ( v, i ) => {
		const x = PAD_X + ( i / Math.max( values.length - 1, 1 ) ) * ( W - PAD_X * 2 );
		const y = PAD_T + ( 1 - v / maxVal ) * ( H - PAD_T - PAD_B );
		return { x, y, v, date: data[ i ].date };
	} );

	// Smooth line using cardinal spline tension (~0.4).
	// Each segment uses control points derived from neighbours.
	function cardinalPath( points ) {
		if ( points.length === 1 ) return `M ${ points[0].x } ${ points[0].y }`;

		const tension = 0.4;
		let d = `M ${ points[0].x } ${ points[0].y }`;

		for ( let i = 0; i < points.length - 1; i++ ) {
			const p0 = points[ Math.max( i - 1, 0 ) ];
			const p1 = points[ i ];
			const p2 = points[ i + 1 ];
			const p3 = points[ Math.min( i + 2, points.length - 1 ) ];

			const cp1x = p1.x + ( p2.x - p0.x ) * tension;
			const cp1y = p1.y + ( p2.y - p0.y ) * tension;
			const cp2x = p2.x - ( p3.x - p1.x ) * tension;
			const cp2y = p2.y - ( p3.y - p1.y ) * tension;

			d += ` C ${ cp1x } ${ cp1y }, ${ cp2x } ${ cp2y }, ${ p2.x } ${ p2.y }`;
		}

		return d;
	}

	const linePath = cardinalPath( pts );
	const first    = pts[ 0 ];
	const last     = pts[ pts.length - 1 ];
	const fillPath = `${ linePath } L ${ last.x } ${ H } L ${ first.x } ${ H } Z`;

	return (
		<div className="qrjump-chart" role="img" aria-label="30-day scan activity">
			<svg
				viewBox={ `0 0 ${ W } ${ H }` }
				width="100%"
				height={ H }
				style={ { display: 'block', overflow: 'visible' } }
			>
				<defs>
					<linearGradient id="qrjump-line-fill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%"   stopColor="var(--qrjump-accent,#2271b1)" stopOpacity="0.18" />
						<stop offset="100%" stopColor="var(--qrjump-accent,#2271b1)" stopOpacity="0"    />
					</linearGradient>
				</defs>

				{ /* Gradient fill */ }
				<path d={ fillPath } fill="url(#qrjump-line-fill)" />

				{ /* The line itself */ }
				<path
					d={ linePath }
					fill="none"
					stroke="var(--qrjump-accent,#2271b1)"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{ /* Dots + native tooltips */ }
				{ pts.map( ( { x, y, v, date } ) => (
					<g key={ date }>
						<title>{ `${ date }: ${ v } scan${ v !== 1 ? 's' : '' }` }</title>
						<circle cx={ x } cy={ y } r="3.5" fill="var(--qrjump-accent,#2271b1)" />
					</g>
				) ) }
			</svg>
		</div>
	);
}
