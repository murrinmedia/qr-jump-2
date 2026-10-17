/**
 * Scans by hour of day (0–23) as bars with a hover tooltip.
 * Hours are the site's local time. Sized to its container.
 */

import { useState } from '@wordpress/element';
import {
	CHART_ACCENT,
	CHART_GRID,
	CHART_LABEL,
	niceMax,
	useChartWidth,
	Tooltip,
} from './chartUtils';

const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;

export default function HourChart( { data = [], height = 240 } ) {
	const [ ref, W ]          = useChartWidth();
	const [ hover, setHover ] = useState( null );

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

	const values = Array.from( { length: 24 }, ( _, h ) => {
		const found = data.find( d => Number( d.hour ) === h );
		return found ? Number( found.scans ) : 0;
	} );

	const yMax   = niceMax( Math.max( ...values, 1 ) );
	const yTicks = [ 0, 0.5, 1 ].map( f => Math.round( f * yMax ) );

	const slot   = PLOT_W / 24;
	const barW   = Math.max( 4, slot * 0.62 );
	const toY    = v => PAD_T + ( 1 - v / yMax ) * PLOT_H;
	const bottom = PAD_T + PLOT_H;

	const xLabels = [ 0, 6, 12, 18 ];

	return (
		<div ref={ ref } className="qrjump-chart">
			<svg
				width={ W }
				height={ H }
				style={ { display: 'block', overflow: 'visible' } }
				role="img"
				aria-label="Scans by hour of day"
				onMouseLeave={ () => setHover( null ) }
			>
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

				{ values.map( ( v, h ) => {
					const x      = PAD_L + h * slot + ( slot - barW ) / 2;
					const barTop = v > 0 ? toY( v ) : bottom - 2;
					return (
						<g key={ h } onMouseEnter={ () => setHover( h ) }>
							{ /* Full-height hit area so thin bars are easy to hover. */ }
							<rect x={ PAD_L + h * slot } y={ PAD_T } width={ slot } height={ PLOT_H } fill="transparent" />
							<rect
								x={ x }
								y={ barTop }
								width={ barW }
								height={ bottom - barTop }
								rx={ Math.min( 4, barW / 2 ) }
								fill={ CHART_ACCENT }
								opacity={ hover === null ? ( v > 0 ? 0.85 : 0.18 ) : ( hover === h ? 1 : ( v > 0 ? 0.35 : 0.1 ) ) }
							/>
						</g>
					);
				} ) }

				{ xLabels.map( h => (
					<text key={ h } x={ PAD_L + h * slot + slot / 2 } y={ H - PAD_B + 20 } textAnchor="middle" fontSize="12" fill={ CHART_LABEL }>
						{ fmtHour( h ) }
					</text>
				) ) }

				{ hover !== null && (
					<Tooltip
						x={ PAD_L + hover * slot + slot / 2 }
						y={ values[ hover ] > 0 ? toY( values[ hover ] ) : bottom }
						width={ W }
						lines={ [
							`${ fmtHour( hover ) } – ${ fmtHour( ( hover + 1 ) % 24 ) }`,
							`${ values[ hover ].toLocaleString() } scan${ values[ hover ] === 1 ? '' : 's' }`,
						] }
					/>
				) }
			</svg>
		</div>
	);
}

function fmtHour( h ) {
	const suffix = h >= 12 ? 'pm' : 'am';
	const hour   = h % 12 === 0 ? 12 : h % 12;
	return `${ hour }${ suffix }`;
}
