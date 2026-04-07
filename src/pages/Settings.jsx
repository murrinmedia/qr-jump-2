/**
 * Plugin settings page.
 */

import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	TextControl,
	TextareaControl,
	SelectControl,
	Spinner,
	Notice,
} from '@wordpress/components';
import { api } from '../api/client';

export default function Settings() {
	const [ settings, setSettings ] = useState( null );
	const [ saving,   setSaving   ] = useState( false );
	const [ notice,   setNotice   ] = useState( null );

	useEffect( () => {
		api.settings.get().then( setSettings );
	}, [] );

	function setField( key, value ) {
		setSettings( prev => ( { ...prev, [ key ]: value } ) );
	}

	async function handleSubmit( e ) {
		e.preventDefault();
		setSaving( true );
		setNotice( null );
		try {
			const saved = await api.settings.update( settings );
			setSettings( saved );
			setNotice( { type: 'success', message: 'Settings saved.' } );
		} catch ( err ) {
			setNotice( { type: 'error', message: err.message } );
		} finally {
			setSaving( false );
		}
	}

	if ( ! settings ) {
		return <div className="qrjump-spinner-wrap"><Spinner /></div>;
	}

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">Settings</h1>
			</div>

			{ notice && (
				<Notice
					status={ notice.type }
					isDismissible
					onRemove={ () => setNotice( null ) }
					style={ { marginBottom: 20 } }
				>
					{ notice.message }
				</Notice>
			) }

			<form className="qrjump-form" onSubmit={ handleSubmit }>

				{ /* ── Redirect ── */ }
				<h3 style={ { marginBottom: 12, fontSize: 14 } }>Redirect</h3>

				<div className="qrjump-form-row">
					<TextControl
						label="URL prefix"
						value={ settings.redirect_prefix }
						onChange={ val => setField( 'redirect_prefix', val ) }
						help={ `Your QR codes will use: ${ window.qrJumpData?.homeUrl }/${ settings.redirect_prefix }/<slug>` }
					/>
				</div>

				{ /* ── Disabled codes ── */ }
				<div className="qrjump-form-row">
					<SelectControl
						label="When a QR code is inactive"
						value={ settings.disabled_behavior }
						options={ [
							{ label: 'Show a 404 error',       value: '404'     },
							{ label: 'Show a fallback message', value: 'message' },
						] }
						onChange={ val => setField( 'disabled_behavior', val ) }
					/>
				</div>

				{ settings.disabled_behavior === 'message' && (
					<div className="qrjump-form-row">
						<TextareaControl
							label="Fallback message"
							value={ settings.disabled_message }
							onChange={ val => setField( 'disabled_message', val ) }
							rows={ 2 }
						/>
					</div>
				) }

				{ /* ── Notifications ── */ }
				<h3 style={ { marginTop: 24, marginBottom: 12, fontSize: 14, borderTop: '1px solid #e0e0e0', paddingTop: 20 } }>
					Notifications
				</h3>

				<div className="qrjump-form-row">
					<TextControl
						label="Default notification rate limit (minutes)"
						value={ String( settings.notify_rate_limit_minutes ) }
						onChange={ val => setField( 'notify_rate_limit_minutes', Math.max( 1, parseInt( val ) || 1 ) ) }
						type="number"
						min={ 1 }
						help="Maximum time between scan notification emails per QR code. Individual codes can override this."
					/>
				</div>

				{ /* ── Reports ── */ }
				<h3 style={ { marginTop: 24, marginBottom: 12, fontSize: 14, borderTop: '1px solid #e0e0e0', paddingTop: 20 } }>
					Scheduled Reports
				</h3>

				<div className="qrjump-form-row">
					<SelectControl
						label="Report frequency"
						value={ settings.report_schedule }
						options={ [
							{ label: 'Disabled',  value: 'none'    },
							{ label: 'Daily',     value: 'daily'   },
							{ label: 'Weekly',    value: 'weekly'  },
							{ label: 'Monthly',   value: 'monthly' },
						] }
						onChange={ val => setField( 'report_schedule', val ) }
					/>
				</div>

				{ settings.report_schedule !== 'none' && (
					<div className="qrjump-form-row">
						<TextControl
							label="Report recipient email"
							value={ settings.report_email }
							onChange={ val => setField( 'report_email', val ) }
							type="email"
							placeholder="Leave blank to use site admin email"
						/>
					</div>
				) }

				<div style={ { marginTop: 24 } }>
					<Button
						variant="primary"
						type="submit"
						isBusy={ saving }
						disabled={ saving }
					>
						{ saving ? 'Saving…' : 'Save Settings' }
					</Button>
				</div>
			</form>
		</>
	);
}
