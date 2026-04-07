/**
 * Slug input with live availability checking.
 *
 * Cleans the value to the allowed character set on every keystroke, then
 * debounces before hitting the /slugs/validate endpoint.
 */

import { useState, useEffect } from '@wordpress/element';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../api/client';

const STATUS = {
	IDLE:      'idle',
	CHECKING:  'checking',
	AVAILABLE: 'available',
	TAKEN:     'taken',
	INVALID:   'invalid',
};

/**
 * @param {{
 *   value:      string,
 *   onChange:   (slug: string) => void,
 *   excludeId?: number,
 *   disabled?:  boolean
 * }} props
 */
export default function SlugInput( { value, onChange, excludeId = 0, disabled = false } ) {
	const [ status, setStatus ] = useState( STATUS.IDLE );
	const debounced = useDebounce( value, 450 );

	// Clean value: lowercase, allowed chars, max 32.
	function handleChange( e ) {
		const cleaned = e.target.value
			.toLowerCase()
			.replace( /[^a-z0-9-]/g, '' )
			.slice( 0, 32 );
		onChange( cleaned );
	}

	useEffect( () => {
		if ( ! debounced ) {
			setStatus( STATUS.IDLE );
			return;
		}

		if ( debounced.length < 1 ) {
			setStatus( STATUS.INVALID );
			return;
		}

		setStatus( STATUS.CHECKING );
		let cancelled = false;

		api.slugs
			.validate( debounced, excludeId )
			.then( res => {
				if ( ! cancelled ) {
					setStatus( res.valid ? STATUS.AVAILABLE : STATUS.TAKEN );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) setStatus( STATUS.IDLE );
			} );

		return () => { cancelled = true; };
	}, [ debounced, excludeId ] );

	const hint = {
		[ STATUS.IDLE      ]: 'Lowercase letters, numbers, and hyphens only. Max 32 characters.',
		[ STATUS.CHECKING  ]: 'Checking availability…',
		[ STATUS.AVAILABLE ]: '✓ Available',
		[ STATUS.TAKEN     ]: '✗ This slug is already in use.',
		[ STATUS.INVALID   ]: 'Must contain at least one valid character.',
	}[ status ];

	const hintClass = {
		[ STATUS.AVAILABLE ]: 'qrjump-slug-input__hint--ok',
		[ STATUS.TAKEN     ]: 'qrjump-slug-input__hint--error',
		[ STATUS.INVALID   ]: 'qrjump-slug-input__hint--error',
	}[ status ] || '';

	return (
		<div className="qrjump-slug-input">
			<div className="qrjump-slug-input__field-wrap">
				<input
					type="text"
					value={ value }
					onChange={ handleChange }
					disabled={ disabled }
					className={ `qrjump-slug-input__field ${ status === STATUS.TAKEN ? 'qrjump-slug-input__field--error' : '' }` }
					placeholder="e.g. summer-sale"
					maxLength={ 32 }
					spellCheck={ false }
					autoComplete="off"
				/>
				{ status === STATUS.CHECKING && (
					<span className="qrjump-slug-input__spinner" aria-hidden="true" />
				) }
			</div>
			<p className={ `qrjump-slug-input__hint ${ hintClass }` }>{ hint }</p>
		</div>
	);
}
