/**
 * Reporting-period selector (7 / 30 / 90 days / all time).
 *
 * The chosen period is remembered across pages and visits in localStorage
 * (best-effort — it works without it).
 */

import { useState, useCallback } from '@wordpress/element';

const STORAGE_KEY = 'qrjump_range_days';
const VALID       = [ 7, 30, 90, 0 ];

export const RANGE_OPTIONS = [
	{ days: 7,  label: '7 days'   },
	{ days: 30, label: '30 days'  },
	{ days: 90, label: '90 days'  },
	{ days: 0,  label: 'All time' },
];

function readStored() {
	try {
		const stored = window.localStorage.getItem( STORAGE_KEY );
		const days   = stored === null ? 30 : parseInt( stored, 10 );
		return VALID.includes( days ) ? days : 30;
	} catch ( e ) {
		return 30;
	}
}

/** [ days, setDays ] — persisted selection, default 30. */
export function useRangeDays() {
	const [ days, setDaysState ] = useState( readStored );

	const setDays = useCallback( value => {
		setDaysState( value );
		try {
			window.localStorage.setItem( STORAGE_KEY, String( value ) );
		} catch ( e ) {
			// Storage unavailable — selection just won't persist.
		}
	}, [] );

	return [ days, setDays ];
}

/** Human label for a period, e.g. "last 30 days" / "all time". */
export function rangeLabel( days ) {
	return days > 0 ? `last ${ days } days` : 'all time';
}

export default function RangeSelect( { value, onChange } ) {
	return (
		<div className="qrjump-range-select" role="group" aria-label="Reporting period">
			{ RANGE_OPTIONS.map( opt => (
				<button
					key={ opt.days }
					type="button"
					className={ `qrjump-range-select__btn${ value === opt.days ? ' qrjump-range-select__btn--active' : '' }` }
					aria-pressed={ value === opt.days }
					onClick={ () => onChange( opt.days ) }
				>
					{ opt.label }
				</button>
			) ) }
		</div>
	);
}
