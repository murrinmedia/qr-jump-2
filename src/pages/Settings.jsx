/**
 * Plugin settings page.
 *
 * Sections:
 *  - Redirect (URL prefix)
 *  - Inactive codes behaviour
 *  - Scan notifications (global rate limit)
 *  - Scheduled reports
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
	const [ original, setOriginal ] = useState( null );
	const [ saving,   setSaving   ] = useState( false );
	const [ notice,   setNotice   ] = useState( null );

	useEffect( () => {
		api.settings.get().then( data => {
			setSettings( data );
			setOriginal( data );
		} );
	}, [] );

	function setField( key, value ) {
		setSettings( prev => ( { ...prev, [ key ]: value } ) );
	}

	const isDirty = settings && original &&
		JSON.stringify( settings ) !== JSON.stringify( original );

	async function handleSubmit( e ) {
		e.preventDefault();
		setSaving( true );
		setNotice( null );
		try {
			const saved = await api.settings.update( settings );
			setSettings( saved );
			setOriginal( saved );
			setNotice( { type: 'success', message: 'Settings saved.' } );
			window.scrollTo( { top: 0, behavior: 'smooth' } );
		} catch ( err ) {
			setNotice( { type: 'error', message: err.message } );
		} finally {
			setSaving( false );
		}
	}

	if ( ! settings ) {
		return <div className="qrjump-spinner-wrap"><Spinner /></div>;
	}

	const homeUrl = ( window.qrJumpData?.homeUrl || '' ).replace( /\/$/, '' );
	const prefix  = settings.redirect_prefix || 'go';

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
				<div className="qrjump-form-section">
					<div className="qrjump-form-section__header">
						<h2 className="qrjump-form-section__title">Redirect</h2>
					</div>
					<div className="qrjump-form-section__body">
						<p className="qrjump-help-text">
							Your QR codes use short URLs in the format:
						</p>
						<p className="qrjump-short-url-example">
							{ homeUrl }/<strong>{ prefix }</strong>/&lt;slug&gt;
						</p>
						<p className="qrjump-help-text" style={ { marginTop: 8 } }>
							The URL prefix is fixed at <strong>{ prefix }</strong> to prevent existing
							printed QR codes from breaking if it were changed.
						</p>
					</div>
				</div>

				{ /* ── Inactive codes ── */ }
				<div className="qrjump-form-section">
					<div className="qrjump-form-section__header">
						<h2 className="qrjump-form-section__title">Inactive Codes</h2>
					</div>
					<div className="qrjump-form-section__body">
						<p className="qrjump-help-text">
							Controls what visitors see when they scan a code that has been set to Inactive.
						</p>
						<div className="qrjump-form-row">
							<SelectControl
								label="When a QR code is inactive"
								value={ settings.disabled_behavior }
								options={ [
									{ label: 'Show a 404 error',        value: '404'     },
									{ label: 'Show a fallback message',  value: 'message' },
								] }
								onChange={ val => setField( 'disabled_behavior', val ) }
								__nextHasNoMarginBottom
							/>
						</div>
						{ settings.disabled_behavior === 'message' && (
							<div className="qrjump-form-row">
								<TextareaControl
									label="Fallback message"
									value={ settings.disabled_message }
									onChange={ val => setField( 'disabled_message', val ) }
									rows={ 3 }
									placeholder="This QR code is no longer active."
									__nextHasNoMarginBottom
								/>
							</div>
						) }
					</div>
				</div>

				{ /* ── Notifications ── */ }
				<div className="qrjump-form-section">
					<div className="qrjump-form-section__header">
						<h2 className="qrjump-form-section__title">Scan Notifications</h2>
					</div>
					<div className="qrjump-form-section__body">
						<p className="qrjump-help-text">
							Individual QR codes can override this default rate limit in their own settings.
						</p>
						<div className="qrjump-form-row">
							<TextControl
								label="Default rate limit (minutes between emails)"
								value={ String( settings.notify_rate_limit_minutes ) }
								onChange={ val =>
									setField( 'notify_rate_limit_minutes', Math.max( 1, parseInt( val ) || 1 ) )
								}
								type="number"
								min={ 1 }
								__nextHasNoMarginBottom
							/>
						</div>
					</div>
				</div>

				{ /* ── Scheduled reports ── */ }
				<div className="qrjump-form-section">
					<div className="qrjump-form-section__header">
						<h2 className="qrjump-form-section__title">Scheduled Reports</h2>
					</div>
					<div className="qrjump-form-section__body">
						<p className="qrjump-help-text">
							Receive periodic scan summaries by email. Reports run via WP-Cron.
						</p>
						<div className="qrjump-form-row">
							<SelectControl
								label="Report frequency"
								value={ settings.report_schedule }
								options={ [
									{ label: 'Disabled', value: 'none'    },
									{ label: 'Daily',    value: 'daily'   },
									{ label: 'Weekly',   value: 'weekly'  },
									{ label: 'Monthly',  value: 'monthly' },
								] }
								onChange={ val => setField( 'report_schedule', val ) }
								__nextHasNoMarginBottom
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
									__nextHasNoMarginBottom
								/>
							</div>
						) }
					</div>
				</div>

				{ /* ── Submit ── */ }
				<div className="qrjump-form-actions">
					<Button
						variant="primary"
						type="submit"
						isBusy={ saving }
						disabled={ saving || ! isDirty }
					>
						{ saving ? 'Saving…' : 'Save Settings' }
					</Button>
					{ isDirty && ! saving && (
						<span className="qrjump-unsaved-hint">You have unsaved changes.</span>
					) }
				</div>

			</form>
		</>
	);
}
