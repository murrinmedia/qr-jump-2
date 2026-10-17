/**
 * Stat tile with an optional change indicator versus the previous period.
 */

/**
 * @param {{
 *   label: string,
 *   value: number|string,
 *   small?: boolean,
 *   note?: string,            Muted line under the value (e.g. "of 4 codes").
 *   previous?: number|null,   Previous-period value; omit/null for no indicator.
 *   previousLabel?: string,   e.g. "previous 30 days".
 * }} props
 */
export default function StatCard( { label, value, small = false, note = '', previous = null, previousLabel = 'previous period' } ) {
	return (
		<div className="qrjump-stat-card">
			<div className="qrjump-stat-card__label">{ label }</div>
			<div className="qrjump-stat-card__value" style={ small ? { fontSize: 18 } : {} }>
				{ typeof value === 'number' ? Number( value ).toLocaleString() : value }
			</div>
			{ note && <div className="qrjump-stat-card__note">{ note }</div> }
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

	let tone = 'flat';
	let text = 'No change';

	if ( previous === 0 ) {
		tone = 'up';
		text = '▲ New';
	} else {
		const pct = Math.round( ( ( value - previous ) / previous ) * 100 );
		if ( pct > 0 ) {
			tone = 'up';
			text = `▲ ${ pct }%`;
		} else if ( pct < 0 ) {
			tone = 'down';
			text = `▼ ${ Math.abs( pct ) }%`;
		}
	}

	return (
		<div className="qrjump-stat-card__delta" title={ title }>
			<span className={ `qrjump-stat-card__pill qrjump-stat-card__pill--${ tone }` }>{ text }</span>
			<span className="qrjump-stat-card__delta-label">vs { previousLabel }</span>
		</div>
	);
}
