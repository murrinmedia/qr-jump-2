/**
 * Colour picker: a native <input type="color"> paired with a hex text input.
 * Lightweight and zero-dependency — works in all modern browsers.
 */

/**
 * @param {{
 *   label:    string,
 *   value:    string,
 *   onChange: (hex: string) => void,
 *   id?:      string
 * }} props
 */
export default function ColourPicker( { label, value, onChange, id } ) {
	const inputId = id || `qrjump-colour-${ label.replace( /\s+/g, '-' ).toLowerCase() }`;

	function handleHexChange( e ) {
		const raw = e.target.value;
		// Only propagate when it looks like a full hex colour.
		if ( /^#[0-9a-fA-F]{6}$/.test( raw ) ) {
			onChange( raw.toLowerCase() );
		} else {
			// Let the text input be partially typed without breaking state.
			e.target.value = raw;
		}
	}

	return (
		<div className="qrjump-colour-picker">
			<label htmlFor={ inputId } className="qrjump-colour-picker__label">
				{ label }
			</label>
			<div className="qrjump-colour-picker__row">
				<input
					type="color"
					id={ inputId }
					value={ value }
					onChange={ e => onChange( e.target.value.toLowerCase() ) }
					className="qrjump-colour-picker__swatch"
					aria-label={ `${ label } colour picker` }
				/>
				<input
					type="text"
					value={ value }
					onChange={ handleHexChange }
					className="qrjump-colour-picker__hex"
					placeholder="#000000"
					maxLength={ 7 }
					aria-label={ `${ label } hex value` }
					spellCheck={ false }
				/>
			</div>
		</div>
	);
}
