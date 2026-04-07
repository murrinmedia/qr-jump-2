/**
 * Returns a debounced version of `value` that only updates after `delay` ms
 * of inactivity.  Used to throttle API calls on fast-typing inputs (slug
 * availability check, live QR preview).
 */

import { useState, useEffect } from '@wordpress/element';

/**
 * @param {*}      value  The value to debounce.
 * @param {number} delay  Debounce delay in milliseconds.
 * @returns {*}           The debounced value.
 */
export function useDebounce( value, delay = 400 ) {
	const [ debounced, setDebounced ] = useState( value );

	useEffect( () => {
		const timer = setTimeout( () => setDebounced( value ), delay );
		return () => clearTimeout( timer );
	}, [ value, delay ] );

	return debounced;
}
