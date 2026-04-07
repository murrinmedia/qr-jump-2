/**
 * Simple SVG bar chart for scan activity.
 *
 * Renders one bar per day from the `daily` array returned by the REST API.
 * No external chart library — uses inline SVG with native browser tooltips.
 */

/**
 * @param {{
 *   data:    Array<{ date: string, scans: string|number }>,
 *   height?: number
 * }} props
 */
export default function ScanChart( { data = [], height = 72 } ) {
	if ( ! data || data.length === 0 ) {
		return (
			<div className="qrjump-chart qrjump-chart--empty">
				<p>No scan data in the past 30 days.</p>
			</div>
		);
	}

	const BAR_W   = 8;
	const GAP     = 3;
	const RADIUS  = 2;
	const W       = data.length * ( BAR_W + GAP );
	const maxVal  = Math.max( ...data.map( d => Number( d.scans ) ), 1 );

	return (
		<div className="qrjump-chart" aria-label="30-day scan activity chart" role="img">
			<svg
				width="100%"
				height={ height }
				viewBox={ `0 0 ${ W } ${ height }` }
				preserveAspectRatio="none"
				style={ { display: 'block' } }
			>
				{ data.map( ( d, i ) => {
					const scans     = Number( d.scans );
					const barH      = Math.max( RADIUS * 2, ( scans / maxVal ) * ( height - 4 ) );
					const x         = i * ( BAR_W + GAP );
					const y         = height - barH;

					return (
						<g key={ d.date }>
							<title>{ `${ d.date }: ${ scans } scan${ scans !== 1 ? 's' : '' }` }</title>
							<rect
								x={ x }
								y={ y }
								width={ BAR_W }
								height={ barH }
								fill="var(--qrjump-accent, #2271b1)"
								rx={ RADIUS }
								opacity={ 0.85 }
							/>
						</g>
					);
				} ) }
			</svg>
		</div>
	);
}
