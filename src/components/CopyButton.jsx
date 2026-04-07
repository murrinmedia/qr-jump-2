/**
 * Copies `text` to the clipboard on click and briefly shows "Copied!".
 */

import { useState } from '@wordpress/element';

/**
 * @param {{ text: string, label?: string, className?: string }} props
 */
export default function CopyButton( { text, label = 'Copy', className = '' } ) {
	const [ copied, setCopied ] = useState( false );

	function handleClick( e ) {
		e.preventDefault();
		e.stopPropagation();

		if ( ! navigator.clipboard ) return;

		navigator.clipboard.writeText( text ).then( () => {
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} );
	}

	return (
		<button
			type="button"
			onClick={ handleClick }
			className={ `qrjump-copy-btn ${ copied ? 'qrjump-copy-btn--copied' : '' } ${ className }`.trim() }
			title={ `Copy: ${ text }` }
			aria-label={ copied ? 'Copied!' : label }
		>
			{ copied ? '✓ Copied' : label }
		</button>
	);
}
