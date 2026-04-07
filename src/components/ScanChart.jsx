/**
 * SVG line chart for scan activity.
 *
 * Accepts the `daily` array from the REST API and renders a smooth line
 * with a gradient fill beneath it.  No external library required.
 *
 * @param {{
 *   data:    Array<{ date: string, scans: string|number }>,
 *   height?: number
 * }} props
 */
export default function ScanChart( { data = [], height = 120 } ) {
	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data in the past 30 days.</p>
			</div>
		);
	}

	const W      = 600;   // internal viewBox width — scales to 100% via CSS
	const H      = height;
	const PAD_X  = 2;
	const PAD_Y  = 8;
	const points = data.map( d => Number( d.scans ) );
	const maxVal = Math.max( ...points, 1 );

	// Map each data point to an (x, y) coordinate.
	const coords = points.map( ( val, i ) => {
		const x = PAD_X + ( i / ( points.length - 1 ) ) * ( W - PAD_X * 2 );
		const y = H - PAD_Y - ( val / maxVal ) * ( H - PAD_Y * 2 );
		return [ x, y ];
	} );

	// Build a smooth polyline using cubic bezier curves.
	function buildPath( pts ) {
		if ( pts.length === 1 ) {
			return `M ${ pts[0][0] } ${ pts[0][1] }`;
		}

		let d = `M ${ pts[0][0] } ${ pts[0][1] }`;

		for ( let i = 0; i < pts.length - 1; i++ ) {
			const [ x0, y0 ] = pts[ i ];
			const [ x1, y1 ] = pts[ i + 1 ];
			const cpX = ( x0 + x1 ) / 2;
			d += ` C ${ cpX } ${ y0 }, ${ cpX } ${ y1 }, ${ x1 } ${ y1 }`;
		}

		return d;
	}

	const linePath = buildPath( coords );

	// Close the path along the bottom to create the fill area.
	const fillPath = `${ linePath } L ${ coords[ coords.length - 1 ][0] } ${ H } L ${ coords[0][0] } ${ H } Z`;

	const gradId = 'qrjump-chart-grad';

	return (
		<div className="qrjump-chart" aria-label="30-day scan activity chart" role="img">
			<svg
				width="100%"
				height={ H }
				viewBox={ `0 0 ${ W } ${ H }` }
				preserveAspectRatio="none"
				style={ { display: 'block', overflow: 'visible' } }
			>
				<defs>
					<linearGradient id={ gradId } x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%"   stopColor="var(--qrjump-accent, #2271b1)" stopOpacity="0.25" />
						<stop offset="100%" stopColor="var(--qrjump-accent, #2271b1)" stopOpacity="0.02" />
					</linearGradient>
				</defs>

				{ /* Fill area */ }
				<path
					d={ fillPath }
					fill={ `url(#${ gradId })` }
				/>

				{ /* Line */ }
				<path
					d={ linePath }
					fill="none"
					stroke="var(--qrjump-accent, #2271b1)"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{ /* Data point dots + tooltips */ }
				{ coords.map( ( [ x, y ], i ) => {
					const scans = points[ i ];
					return (
						<g key={ data[ i ].date }>
							<title>{ `${ data[ i ].date }: ${ scans } scan${ scans !== 1 ? 's' : '' }` }</title>
							<circle
								cx={ x }
								cy={ y }
								r={ 3 }
								fill="var(--qrjump-accent, #2271b1)"
								opacity={ 0.9 }
							/>
						</g>
					);
				} ) }
			</svg>
		</div>
	);
}
