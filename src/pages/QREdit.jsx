/**
 * Create / Edit QR code page.
 *
 * Handles both create (/codes/new) and update (/codes/:id/edit).
 * QR preview and colour pickers are Phase 3 additions.
 */

import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	TextControl,
	TextareaControl,
	SelectControl,
	ToggleControl,
	Spinner,
	Notice,
} from '@wordpress/components';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const DEFAULTS = {
	title:           '',
	slug:            '',
	destination_url: '',
	status:          1,
	redirect_type:   302,
	fg_colour:       '#000000',
	bg_colour:       '#ffffff',
	notes:           '',
	settings: {
		notify_on_scan:            false,
		notify_email:              '',
		notify_rate_limit_minutes: 5,
	},
};

export default function QREdit() {
	const { id }    = useParams();
	const navigate  = useNavigate();
	const isNew     = ! id;

	const [ form,         setForm         ] = useState( DEFAULTS );
	const [ slugManual,   setSlugManual   ] = useState( false );
	const [ slugStatus,   setSlugStatus   ] = useState( null );  // null | 'checking' | 'ok' | 'taken'
	const [ loading,      setLoading      ] = useState( ! isNew );
	const [ saving,       setSaving       ] = useState( false );
	const [ notice,       setNotice       ] = useState( null );  // { type, message }

	// Load existing code when editing.
	useEffect( () => {
		if ( isNew ) return;
		api.codes.get( id )
			.then( code => {
				setForm( {
					...DEFAULTS,
					...code,
					settings: { ...DEFAULTS.settings, ...code.settings },
				} );
				setSlugManual( true );
			} )
			.catch( () => setNotice( { type: 'error', message: 'Failed to load QR code.' } ) )
			.finally( () => setLoading( false ) );
	}, [ id, isNew ] );

	function setField( key, value ) {
		setForm( prev => ( { ...prev, [ key ]: value } ) );
	}

	function setSettings( key, value ) {
		setForm( prev => ( {
			...prev,
			settings: { ...prev.settings, [ key ]: value },
		} ) );
	}

	// Live slug validation.
	function handleSlugChange( value ) {
		const cleaned = value.toLowerCase().replace( /[^a-z0-9-]/g, '' ).slice( 0, 32 );
		setField( 'slug', cleaned );
		if ( ! cleaned ) { setSlugStatus( null ); return; }

		setSlugStatus( 'checking' );
		api.slugs.validate( cleaned, isNew ? 0 : Number( id ) )
			.then( res => setSlugStatus( res.valid ? 'ok' : 'taken' ) )
			.catch( () => setSlugStatus( null ) );
	}

	async function handleSubmit( e ) {
		e.preventDefault();
		setSaving( true );
		setNotice( null );

		try {
			const payload = { ...form };
			// If auto-slug mode, omit slug so the server generates one.
			if ( ! slugManual ) delete payload.slug;

			if ( isNew ) {
				const created = await api.codes.create( payload );
				navigate( `/codes/${ created.id }/edit` );
			} else {
				await api.codes.update( Number( id ), payload );
				setNotice( { type: 'success', message: 'QR code saved.' } );
			}
		} catch ( err ) {
			setNotice( { type: 'error', message: err.message } );
		} finally {
			setSaving( false );
		}
	}

	if ( loading ) {
		return <div className="qrjump-spinner-wrap"><Spinner /></div>;
	}

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">
					{ isNew ? 'New QR Code' : 'Edit QR Code' }
				</h1>
				<Button variant="tertiary" onClick={ () => navigate( '/codes' ) }>
					← Back
				</Button>
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
				{ /* ── Basic fields ── */ }
				<div className="qrjump-form-row">
					<TextControl
						label="Title"
						value={ form.title }
						onChange={ val => setField( 'title', val ) }
						placeholder="e.g. Summer campaign flyer"
					/>
				</div>

				<div className="qrjump-form-row">
					<TextControl
						label="Destination URL"
						value={ form.destination_url }
						onChange={ val => setField( 'destination_url', val ) }
						type="url"
						placeholder="https://example.com/landing-page"
						required
					/>
				</div>

				{ /* ── Slug ── */ }
				<div className="qrjump-form-row">
					<ToggleControl
						label="Set slug manually"
						checked={ slugManual }
						onChange={ setSlugManual }
					/>
					{ slugManual && (
						<>
							<TextControl
								label="Slug"
								value={ form.slug }
								onChange={ handleSlugChange }
								placeholder="e.g. summer-sale"
								help={ slugStatus === 'ok'       ? '✓ Available'
									: slugStatus === 'taken'     ? '✗ Already in use'
									: slugStatus === 'checking'  ? 'Checking…'
									: 'Lowercase letters, numbers, and hyphens only. Max 32 chars.' }
							/>
							{ form.slug && (
								<p style={ { fontSize: 12, color: '#757575', marginTop: 4 } }>
									Short URL: <code>{ window.qrJumpData?.homeUrl }/{ /* prefix from settings */ }go/{ form.slug }</code>
								</p>
							) }
						</>
					) }
				</div>

				{ /* ── Status & redirect type ── */ }
				<div className="qrjump-form-row" style={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } }>
					<SelectControl
						label="Status"
						value={ String( form.status ) }
						options={ [
							{ label: 'Active',   value: '1' },
							{ label: 'Inactive', value: '0' },
						] }
						onChange={ val => setField( 'status', Number( val ) ) }
					/>
					<SelectControl
						label="Redirect Type"
						value={ String( form.redirect_type ) }
						options={ [
							{ label: '302 — Temporary (recommended)', value: '302' },
							{ label: '301 — Permanent',              value: '301' },
						] }
						onChange={ val => setField( 'redirect_type', Number( val ) ) }
					/>
				</div>

				{ /* ── Colours ── (Phase 3 will add a colour picker) */ }
				<div className="qrjump-form-row" style={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } }>
					<TextControl
						label="Foreground colour"
						value={ form.fg_colour }
						onChange={ val => setField( 'fg_colour', val ) }
						type="color"
					/>
					<TextControl
						label="Background colour"
						value={ form.bg_colour }
						onChange={ val => setField( 'bg_colour', val ) }
						type="color"
					/>
				</div>

				{ /* ── Notes ── */ }
				<div className="qrjump-form-row">
					<TextareaControl
						label="Notes"
						value={ form.notes }
						onChange={ val => setField( 'notes', val ) }
						rows={ 3 }
						placeholder="Internal notes about this QR code…"
					/>
				</div>

				{ /* ── Notification settings ── */ }
				<div className="qrjump-form-row" style={ { borderTop: '1px solid #e0e0e0', paddingTop: 20 } }>
					<h3 style={ { marginBottom: 12, fontSize: 14 } }>Scan Notifications</h3>
					<ToggleControl
						label="Email me when this code is scanned"
						checked={ form.settings.notify_on_scan }
						onChange={ val => setSettings( 'notify_on_scan', val ) }
					/>
					{ form.settings.notify_on_scan && (
						<>
							<TextControl
								label="Notification email"
								value={ form.settings.notify_email }
								onChange={ val => setSettings( 'notify_email', val ) }
								type="email"
								placeholder="Leave blank to use site admin email"
							/>
							<TextControl
								label="Rate limit (minutes between emails)"
								value={ String( form.settings.notify_rate_limit_minutes ) }
								onChange={ val => setSettings( 'notify_rate_limit_minutes', Math.max( 1, parseInt( val ) || 1 ) ) }
								type="number"
								min={ 1 }
							/>
						</>
					) }
				</div>

				{ /* ── QR preview placeholder ── */ }
				{ ! isNew && (
					<div className="qrjump-form-row" style={ { borderTop: '1px solid #e0e0e0', paddingTop: 20 } }>
						<h3 style={ { marginBottom: 12, fontSize: 14 } }>QR Code</h3>
						<img
							src={ api.codes.qrUrl( id, { format: 'png', size: 300 } ) }
							alt="QR Code preview"
							style={ { display: 'block', width: 180, height: 180, border: '1px solid #e0e0e0', borderRadius: 4 } }
						/>
						<div style={ { marginTop: 12, display: 'flex', gap: 8 } }>
							<Button
								variant="secondary"
								href={ api.codes.qrUrl( id, { format: 'png', size: 1000, download: true } ) }
								download
							>
								Download PNG
							</Button>
							<Button
								variant="secondary"
								href={ api.codes.qrUrl( id, { format: 'svg', download: true } ) }
								download
							>
								Download SVG
							</Button>
						</div>
					</div>
				) }

				<div style={ { marginTop: 24 } }>
					<Button
						variant="primary"
						type="submit"
						isBusy={ saving }
						disabled={ saving }
					>
						{ saving ? 'Saving…' : isNew ? 'Create QR Code' : 'Save Changes' }
					</Button>
				</div>
			</form>
		</>
	);
}
