/**
 * Fixed top-right toast notification.
 *
 * Usage:
 *   const [ toast, setToast ] = useState( null );
 *   setToast( { message: 'Saved!', type: 'success' } );
 *   <Toast toast={ toast } onDismiss={ () => setToast( null ) } />
 *
 * Auto-dismisses after 2.5 s. Passing a new `toast` object resets the timer.
 */

import { useEffect } from '@wordpress/element';

export default function Toast( { toast, onDismiss } ) {
	useEffect( () => {
		if ( ! toast ) return;
		const t = setTimeout( onDismiss, 2500 );
		return () => clearTimeout( t );
	}, [ toast ] ); // eslint-disable-line react-hooks/exhaustive-deps

	if ( ! toast ) return null;

	const icon = toast.type === 'success' ? '✓' : '✕';

	return (
		<div
			className={ `qrjump-toast qrjump-toast--${ toast.type || 'success' }` }
			role="status"
			aria-live="polite"
		>
			<span className="qrjump-toast__icon">{ icon }</span>
			{ toast.message }
		</div>
	);
}
