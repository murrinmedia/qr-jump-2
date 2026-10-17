/**
 * Shared helpers for the SVG charts.
 */

import { useRef, useState, useEffect } from '@wordpress/element';

export const CHART_ACCENT = '#3924b2';
export const CHART_GRID   = '#eef0f5';
export const CHART_LABEL  = '#667085';

/**
 * Measure a container's width so the SVG can be drawn 1:1 (text stays a
 * readable 12px instead of scaling down with a viewBox).
 *
 * @param {number} fallback Width used before the first measurement.
 * @returns {[ import('react').RefObject, number ]}
 */
export function useChartWidth( fallback = 640 ) {
	const ref               = useRef( null );
	const [ width, setWidth ] = useState( fallback );

	useEffect( () => {
		const el = ref.current;
		if ( ! el ) return undefined;

		const update = () => setWidth( Math.max( 260, Math.floor( el.getBoundingClientRect().width ) ) );
		update();

		if ( typeof ResizeObserver === 'undefined' ) {
			window.addEventListener( 'resize', update );
			return () => window.removeEventListener( 'resize', update );
		}

		const observer = new ResizeObserver( update );
		observer.observe( el );
		return () => observer.disconnect();
	}, [] );

	return [ ref, width ];
}

/** Smooth path through points (cardinal spline, tension 0.35). */
export function cardinalPath( points ) {
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

/** Round a maximum up to a "nice" axis value (1, 2, 5 × 10ⁿ). */
export function niceMax( v ) {
	if ( v <= 0 ) return 5;
	const mag  = Math.pow( 10, Math.floor( Math.log10( v ) ) );
	const norm = v / mag;
	const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
	return nice * mag;
}

/**
 * Dark tooltip drawn inside the SVG, kept within [0, width].
 *
 * @param {{ x: number, y: number, width: number, lines: string[] }} props
 */
export function Tooltip( { x, y, width, lines } ) {
	const boxW = Math.max( ...lines.map( l => l.length ) ) * 6.6 + 24;
	const boxH = lines.length * 18 + 14;
	const left = Math.min( Math.max( x - boxW / 2, 4 ), width - boxW - 4 );
	const top  = Math.max( y - boxH - 12, 2 );

	return (
		<g pointerEvents="none">
			<rect x={ left } y={ top } width={ boxW } height={ boxH } rx="8" fill="#101828" opacity="0.94" />
			{ lines.map( ( line, i ) => (
				<text
					key={ i }
					x={ left + 12 }
					y={ top + 19 + i * 18 }
					fontSize="12"
					fontWeight={ i === 0 ? 600 : 400 }
					fill={ i === 0 ? '#ffffff' : '#d0d5dd' }
				>
					{ line }
				</text>
			) ) }
		</g>
	);
}
