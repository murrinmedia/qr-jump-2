/**
 * Create / Edit QR code page.
 *
 * Handles both create (/codes/new) and update (/codes/:id/edit).
 * Includes:
 *  - Live QR preview (QRPreview component) for both new and saved codes.
 *  - Live slug availability check (SlugInput component).
 *  - Colour pickers (ColourPicker component) wired to the live preview.
 *  - Inline scan stats for saved codes.
 *  - Scan notification settings per code.
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
import QRPreview from '../components/QRPreview';
import ColourPicker from '../components/ColourPicker';
import SlugInput from '../components/SlugInput';

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
	const { id }   = useParams();
	const navigate = useNavigate();
	const isNew    = ! id;

	const [ form,       setForm       ] = useState( DEFAULTS );
	const [ slugManual, setSlugManual ] = useState( false );
	const [ loading,    setLoading    ] = useState( ! isNew );
	const [ saving,     setSaving     ] = useState( false );
	const [ notice,     setNotice     ] = useState( null );   // { type, message }
	const [ stats,      setStats      ] = useState( null );   // scan stats for saved codes

	const prefix  = window.qrJumpData?.redirectPrefix || 'go';
	const homeUrl = ( window.qrJumpData?.homeUrl || '' ).replace( /\/$/, '' );

	// ── Load existing code when editing ──────────────────────────────────────

	useEffect( () => {
		if ( isNew ) return;

		api.codes.get( id )
			.then( code => {
				setForm( {
					...DEFAULTS,
					...code,
					settings: { ...DEFAULTS.settings, ...( code.settings || {} ) },
				} );
				setSlugManual( true );

				// Inline stats returned by GET /codes/{id}.
				if ( code.total_scans !== undefined ) {
					setStats( {
						total:        code.total_scans,
						unique:       code.unique_scans,
						repeat:       code.repeat_scans,
						last_scanned: code.last_scanned_at,
					} );
				}
			} )
			.catch( () => setNotice( { type: 'error', message: 'Failed to load QR code.' } ) )
			.finally( () => setLoading( false ) );
	}, [ id, isNew ] );

	// ── Field helpers ─────────────────────────────────────────────────────────

	function setField( key, value ) {
		setForm( prev => ( { ...prev, [ key ]: value } ) );
	}

	function setSetting( key, value ) {
		setForm( prev => ( {
			...prev,
			settings: { ...prev.settings, [ key ]: value },
		} ) );
	}

	// ── Form submit ───────────────────────────────────────────────────────────

	async function handleSubmit( e ) {
		e.preventDefault();
		setSaving( true );
		setNotice( null );

		try {
			const payload = { ...form };
			// When auto-slug mode, omit slug so the server generates one.
			if ( ! slugManual ) delete payload.slug;

			if ( isNew ) {
				const created = await api.codes.create( payload );
				navigate( `/codes/${ created.id }/edit` );
			} else {
				await api.codes.update( Number( id ), payload );
				setNotice( { type: 'success', message: 'QR code saved.' } );
				window.scrollTo( { top: 0, behavior: 'smooth' } );
			}
		} catch ( err ) {
			setNotice( { type: 'error', message: err.message } );
			window.scrollTo( { top: 0, behavior: 'smooth' } );
		} finally {
			setSaving( false );
		}
	}

	// ── Loading state ─────────────────────────────────────────────────────────

	if ( loading ) {
		return <div className="qrjump-spinner-wrap"><Spinner /></div>;
	}

	// ── Derived values ────────────────────────────────────────────────────────

	const shortUrl = form.slug ? `${ homeUrl }/${ prefix }/${ form.slug }` : null;

	// For saved codes pass the ID; for new codes pass the short URL for preview.
	const previewCodeId   = isNew ? null : Number( id );
	const previewShortUrl = isNew ? shortUrl : null;

	return (
		<div className="qrjump-edit-layout">

			{ /* ── Left: form ── */ }
			<div className="qrjump-edit-layout__form">

				<div className="qrjump-page-header">
					<h1 className="qrjump-page-header__title">
						{ isNew ? 'New QR Code' : ( form.title || 'Edit QR Code' ) }
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

				{ /* ── Scan stats (saved codes only) ── */ }
				{ ! isNew && stats && (
					<div className="qrjump-edit-stats">
						<div className="qrjump-edit-stat">
							<span className="qrjump-edit-stat__label">Total scans</span>
							<span className="qrjump-edit-stat__value">
								{ Number( stats.total ).toLocaleString() }
							</span>
						</div>
						<div className="qrjump-edit-stat">
							<span className="qrjump-edit-stat__label">Unique</span>
							<span className="qrjump-edit-stat__value">
								{ Number( stats.unique ).toLocaleString() }
							</span>
						</div>
						<div className="qrjump-edit-stat">
							<span className="qrjump-edit-stat__label">Repeat</span>
							<span className="qrjump-edit-stat__value">
								{ Number( stats.repeat ).toLocaleString() }
							</span>
						</div>
						<div className="qrjump-edit-stat qrjump-edit-stat--wide">
							<span className="qrjump-edit-stat__label">Last scan</span>
							<span className="qrjump-edit-stat__value">
								{ stats.last_scanned
									? new Date( stats.last_scanned + 'Z' ).toLocaleString()
									: 'Never'
								}
							</span>
						</div>
						<div className="qrjump-edit-stat qrjump-edit-stat--actions">
							<Button
								variant="secondary"
								size="small"
								onClick={ () => navigate( `/codes/${ id }/stats` ) }
							>
								View stats
							</Button>
							<Button
								variant="tertiary"
								size="small"
								isDestructive
								onClick={ async () => {
									if ( ! window.confirm( 'Reset all scan data for this code? This cannot be undone.' ) ) return;
									await api.codes.resetScans( Number( id ) );
									setStats( { total: 0, unique: 0, repeat: 0, last_scanned: null } );
								} }
							>
								Reset stats
							</Button>
						</div>
					</div>
				) }

				<form className="qrjump-form" onSubmit={ handleSubmit }>

					{ /* ── Basic info ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Basic Info</h2>
						</div>
						<div className="qrjump-form-section__body">
							<div className="qrjump-form-row">
								<TextControl
									label="Title"
									value={ form.title }
									onChange={ val => setField( 'title', val ) }
									placeholder="e.g. Summer campaign flyer"
									__nextHasNoMarginBottom
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
									__nextHasNoMarginBottom
								/>
							</div>
						</div>
					</div>

					{ /* ── Slug ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Short URL</h2>
							{ isNew && (
								<ToggleControl
									label="Set slug manually"
									checked={ slugManual }
									onChange={ val => {
										setSlugManual( val );
										if ( ! val ) setField( 'slug', '' );
									} }
									__nextHasNoMarginBottom
								/>
							) }
						</div>
						<div className="qrjump-form-section__body">
							{ ! isNew ? (
								// Editing: slug is locked — changing it would break printed QR codes.
								<>
									<p className="qrjump-help-text">
										The slug is permanent and cannot be changed after creation.
										Changing it would break any printed QR codes pointing to this URL.
									</p>
									{ shortUrl && (
										<p className="qrjump-short-url-preview">
											<span className="qrjump-short-url-preview__label">Short URL:</span>
											{ ' ' }
											<a href={ shortUrl } target="_blank" rel="noreferrer">
												{ shortUrl }
											</a>
										</p>
									) }
								</>
							) : slugManual ? (
								<>
									<div className="qrjump-form-row">
										<label className="qrjump-label">Slug</label>
										<SlugInput
											value={ form.slug }
											onChange={ val => setField( 'slug', val ) }
											excludeId={ 0 }
										/>
									</div>
									{ shortUrl && (
										<p className="qrjump-short-url-preview">
											<span className="qrjump-short-url-preview__label">Short URL:</span>
											{ ' ' }
											<a href={ shortUrl } target="_blank" rel="noreferrer">
												{ shortUrl }
											</a>
										</p>
									) }
								</>
							) : (
								<p className="qrjump-help-text">
									A unique slug will be generated automatically when you save.
								</p>
							) }
						</div>
					</div>

					{ /* ── Behaviour ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Behaviour</h2>
						</div>
						<div className="qrjump-form-section__body">
							<div className="qrjump-form-row qrjump-form-row--cols-2">
								<SelectControl
									label="Status"
									value={ String( form.status ) }
									options={ [
										{ label: 'Active',   value: '1' },
										{ label: 'Inactive', value: '0' },
									] }
									onChange={ val => setField( 'status', Number( val ) ) }
									__nextHasNoMarginBottom
								/>
								<SelectControl
									label="Redirect type"
									value={ String( form.redirect_type ) }
									options={ [
										{ label: '302 — Temporary (recommended)', value: '302' },
										{ label: '301 — Permanent',              value: '301' },
									] }
									onChange={ val => setField( 'redirect_type', Number( val ) ) }
									__nextHasNoMarginBottom
								/>
							</div>
						</div>
					</div>

					{ /* ── Appearance ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">QR Appearance</h2>
						</div>
						<div className="qrjump-form-section__body">
							<p className="qrjump-help-text">
								Colour changes are reflected in the preview panel.
							</p>
							<div className="qrjump-form-row qrjump-form-row--cols-2">
								<ColourPicker
									label="Foreground colour"
									value={ form.fg_colour }
									onChange={ val => setField( 'fg_colour', val ) }
									id="qrjump-fg"
								/>
								<ColourPicker
									label="Background colour"
									value={ form.bg_colour }
									onChange={ val => setField( 'bg_colour', val ) }
									id="qrjump-bg"
								/>
							</div>
						</div>
					</div>

					{ /* ── Notes ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Notes</h2>
						</div>
						<div className="qrjump-form-section__body">
							<TextareaControl
								label="Internal notes"
								value={ form.notes }
								onChange={ val => setField( 'notes', val ) }
								rows={ 3 }
								placeholder="Internal notes about this QR code…"
								__nextHasNoMarginBottom
							/>
						</div>
					</div>

					{ /* ── Scan notifications ── */ }
					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Scan Notifications</h2>
							<ToggleControl
								label="Email me on scan"
								checked={ form.settings.notify_on_scan }
								onChange={ val => setSetting( 'notify_on_scan', val ) }
								__nextHasNoMarginBottom
							/>
						</div>
						{ form.settings.notify_on_scan && (
							<div className="qrjump-form-section__body">
								<div className="qrjump-form-row">
									<TextControl
										label="Notification email"
										value={ form.settings.notify_email }
										onChange={ val => setSetting( 'notify_email', val ) }
										type="email"
										placeholder="Leave blank to use site admin email"
										__nextHasNoMarginBottom
									/>
								</div>
								<div className="qrjump-form-row">
									<TextControl
										label="Rate limit (minutes between emails)"
										value={ String( form.settings.notify_rate_limit_minutes ) }
										onChange={ val =>
											setSetting( 'notify_rate_limit_minutes', Math.max( 1, parseInt( val ) || 1 ) )
										}
										type="number"
										min={ 1 }
										help="Overrides the global default set in Settings."
										__nextHasNoMarginBottom
									/>
								</div>
							</div>
						) }
					</div>

					{ /* ── Submit ── */ }
					<div className="qrjump-form-actions">
						<Button
							variant="primary"
							type="submit"
							isBusy={ saving }
							disabled={ saving }
						>
							{ saving
								? 'Saving…'
								: isNew
									? 'Create QR Code'
									: 'Save Changes'
							}
						</Button>

						{ ! isNew && (
							<Button
								variant="tertiary"
								isDestructive
								onClick={ async () => {
									if ( ! window.confirm(
										'Delete this QR code and all its scan history? This cannot be undone.'
									) ) return;
									await api.codes.delete( Number( id ) );
									navigate( '/codes' );
								} }
							>
								Delete code
							</Button>
						) }
					</div>

				</form>
			</div>

			{ /* ── Right: QR preview (sticky) ── */ }
			<div className="qrjump-edit-layout__preview">
				<QRPreview
					codeId={ previewCodeId }
					shortUrl={ previewShortUrl }
					fgColour={ form.fg_colour }
					bgColour={ form.bg_colour }
					slug={ form.slug || 'qr-code' }
				/>
			</div>

		</div>
	);
}
