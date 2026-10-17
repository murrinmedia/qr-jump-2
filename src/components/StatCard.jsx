/**
 * Stat tile with an optional change indicator versus the previous period.
 */

/**
 * @param {{
 *   label: string,
 *   value: number|string,
 *   small?: boolean,
 *   previous?: number|null,   Previous-period value; omit/null for no indicator.
 *   previousLabel?: string,   Tooltip, e.g. "previous 30 days".
 * }} props
 */
export default function StatCard( { label, value, small = false, previous = null, previousLabel = 'previous period' } ) {
	return (
		<div className="qrjump-stat-card">
			<div className="qrjump-stat-card__label">{ label }</div>
			<div className="qrjump-stat-card__value" style={ small ? { fontSize: 16 } : {} }>
				{ typeof value === 'number' ? Number( value ).toLocaleString() : value }
			</div>
			{ typeof value === 'number' && previous !== null && previous !== undefined && (
				<Delta value={ value } previous={ previous } previousLabel={ previousLabel } />
			) }
		</div>
	);
}

function Delta( { value, previous, previousLabel } ) {
	const title = `${ Number( previous ).toLocaleString() } in the ${ previousLabel }`;

	if ( previous === 0 && value === 0 ) {
		return null;
	}

	if ( previous === 0 ) {
		return <div className="qrjump-stat-card__delta qrjump-stat-card__delta--up" title={ title }>▲ New</div>;
	}

	const pct = Math.round( ( ( value - previous ) / previous ) * 100 );

	if ( pct === 0 ) {
		return <div className="qrjump-stat-card__delta qrjump-stat-card__delta--flat" title={ title }>– No change</div>;
	}

	return (
		<div
			className={ `qrjump-stat-card__delta qrjump-stat-card__delta--${ pct > 0 ? 'up' : 'down' }` }
			title={ title }
		>
			{ pct > 0 ? '▲' : '▼' } { Math.abs( pct ) }% <span>vs { previousLabel }</span>
		</div>
	);
}
