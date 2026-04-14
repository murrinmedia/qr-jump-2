/**
 * Create / Edit QR code page.
 *
 * For saved codes, full scan stats (totals, 30-day line chart, hour-of-day
 * breakdown, top referrers) are loaded and displayed below the form — no
 * separate stats screen required.
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
import ScanChart from '../components/ScanChart';
import HourChart from '../components/HourChart';
import CopyButton from '../components/CopyButton';
import VCardBuilder, { EMPTY_VCARD_DATA } from '../components/VCardBuilder';

const DEFAULTS = {
	title:           '',
	slug:            '',
	destination_url: '',
	status:          1,
	redirect_type:   302,
	fg_colour:       window.qrJumpData?.brandFgColour || '#000000',
	bg_colour:       window.qrJumpData?.brandBgColour || '#ffffff',
	notes:           '',
	settings: {
		destination_type:          'url',
		vcard_mode:                'raw',
		vcard_data:                { ...EMPTY_VCARD_DATA },
		notify_on_scan:            false,
		notify_email:              '',
		notify_rate_limit_minutes: 5,
		notify_every_x_scans:      1,
		active_from:               '',
		active_until:              '',
		max_scans:                 0,
		max_scans_message:         '',
	},
};

export default function QREdit() {
	const { id }   = useParams();
	const navigate = useNavigate();
	const isNew    = ! id;

	const [ form,        setForm        ] = useState( DEFAULTS );
	const [ slugManual,  setSlugManual  ] = useState( false );
	// Preserves destination content when switching types so nothing is lost.
	const [ destBackup,  setDestBackup  ] = useState( { url: '', vcard: '' } );
	const [ loading,     setLoading     ] = useState( ! isNew );
	const [ saving,      setSaving      ] = useState( false );
	const [ notice,      setNotice      ] = useState( null );
	const [ stats,       setStats       ] = useState( null );   // inline totals
	const [ fullStats,   setFullStats   ] = useState( null );   // chart + hourly + referrers
	const [ statsLoading, setStatsLoading ] = useState( false );

	const prefix  = window.qrJumpData?.redirectPrefix || 'qr';
	const homeUrl = ( window.qrJumpData?.homeUrl || '' ).replace( /\/$/, '' );

	// ── Load code + detailed stats when editing ───────────────────────────────

	useEffect( () => {
		if ( isNew ) return;

		// Load code data.
		api.codes.get( id )
			.then( code => {
				setForm( {
					...DEFAULTS,
					...code,
					settings: { ...DEFAULTS.settings, ...( code.settings || {} ) },
				} );
				setSlugManual( true );

				if ( code.total_scans !== undefined ) {
					setStats( {
						total:        code.total_scans,
						unique:       code.unique_scans,
						repeat:       code.repeat_scans,
						last_scanned: code.last_scanned_at,
						today:        code.scans_today ?? 0,
						week:         code.scans_week  ?? 0,
						month:        code.scans_month ?? 0,
						scans_30d:    code.scans_30d   ?? 0,
					} );
				}
			} )
			.catch( () => setNotice( { type: 'error', message: 'Failed to load QR code.' } ) )
			.finally( () => setLoading( false ) );

		// Load detailed stats separately so they don't block the form.
		setStatsLoading( true );
		api.codes.stats( id )
			.then( setFullStats )
			.finally( () => setStatsLoading( false ) );
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

	// ── Reset scans ───────────────────────────────────────────────────────────

	async function handleResetScans() {
		if ( ! window.confirm( 'Reset all scan data for this code? This cannot be undone.' ) ) return;
		await api.codes.resetScans( Number( id ) );
		setStats( { total: 0, unique: 0, repeat: 0, last_scanned: null, today: 0, week: 0, month: 0, scans_30d: 0 } );
		setFullStats( prev => prev ? { ...prev, total: 0, unique_scans: 0, repeat_scans: 0, daily: [], hourly: [], referrers: [] } : null );
	}

	// ── Loading state ─────────────────────────────────────────────────────────

	if ( loading ) {
		return <div className="qrjump-spinner-wrap"><Spinner /></div>;
	}

	// ── Derived values ────────────────────────────────────────────────────────

	const shortUrl        = form.slug ? `${ homeUrl }/${ prefix }/${ form.slug }` : null;
	const previewCodeId   = isNew ? null : Number( id );
	const previewShortUrl = isNew ? shortUrl : null;

	return (
		<div className="qrjump-edit-layout">

			{ /* ── Left: form + stats ── */ }
			<div className="qrjump-edit-layout__form">

				<div className="qrjump-page-header">
					<div style={ { display: 'flex', alignItems: 'center', gap: 12 } }>
						<h1 className="qrjump-page-header__title">
							{ isNew ? 'New QR Code' : ( form.title || 'Edit QR Code' ) }
						</h1>
						{ /* Active toggle lives in sidebar for saved codes */ }
					</div>
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

				{ /* ── Inline stat totals ── */ }
				{ ! isNew && stats && (
					<div className="qrjump-edit-stats">
						<div className="qrjump-edit-stats__grid">
							{ [
								{ label: 'Total Scans',  value: stats.total    },
								{ label: 'Unique',       value: stats.unique   },
								{ label: 'Repeat',       value: stats.repeat   },
								{ label: 'Today',        value: stats.today    },
								{ label: 'Last 7 Days',  value: stats.week     },
								{ label: 'This Month',   value: stats.month    },
								{ label: 'Last 30 Days', value: stats.scans_30d },
							].map( ( { label, value } ) => (
								<div key={ label } className="qrjump-edit-stat">
									<span className="qrjump-edit-stat__label">{ label }</span>
									<span className="qrjump-edit-stat__value">
										{ Number( value ).toLocaleString() }
									</span>
								</div>
							) ) }
						</div>
						<div className="qrjump-edit-stats__meta">
							<span className="qrjump-edit-stats__last-scan">
								{ stats.last_scanned
									? <>Last scan: <strong>{ new Date( stats.last_scanned + 'Z' ).toLocaleString() }</strong></>
									: 'No scans yet'
								}
							</span>
						</div>
					</div>
				) }

				{ /* ── Form ── */ }
				<form id="qrjump-code-form" className="qrjump-form" onSubmit={ handleSubmit }>

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
								<SelectControl
									label="Destination type"
									value={ form.settings.destination_type }
									options={ [
										{ label: 'URL (redirect)',     value: 'url'   },
										{ label: 'vCard / Plain text', value: 'vcard' },
									] }
									onChange={ newType => {
										const curType = form.settings.destination_type;
										const curVal  = form.destination_url;
										setDestBackup( prev => ( { ...prev, [ curType ]: curVal } ) );
										setField( 'destination_url', destBackup[ newType ] || '' );
										setSetting( 'destination_type', newType );
									} }
									__nextHasNoMarginBottom
								/>
							</div>

							{ form.settings.destination_type === 'vcard' ? (
								<div className="qrjump-vcard-editor">

									{ /* ── Mode switcher ── */ }
									<div className="qrjump-vcard-mode-bar">
										<button
											type="button"
											className={ `qrjump-vcard-mode-btn${ form.settings.vcard_mode === 'builder' ? ' qrjump-vcard-mode-btn--active' : '' }` }
											onClick={ () => {
												if ( form.settings.vcard_mode === 'builder' ) return;
												// Raw → Builder: warn if raw content exists.
												if (
													form.destination_url.trim() &&
													! window.confirm(
														'Switching to Builder mode will replace your raw vCard content with the structured fields.\n\nYour existing raw text will be lost. Continue?'
													)
												) return;
												setSetting( 'vcard_mode', 'builder' );
											} }
										>
											Builder
										</button>
										<button
											type="button"
											className={ `qrjump-vcard-mode-btn${ form.settings.vcard_mode !== 'builder' ? ' qrjump-vcard-mode-btn--active' : '' }` }
											onClick={ () => {
												if ( form.settings.vcard_mode !== 'builder' ) return;
												// Builder → Raw: pre-populate textarea with current preview.
												setField( 'destination_url', generateVCardPreview( form.settings.vcard_data ) );
												setSetting( 'vcard_mode', 'raw' );
											} }
										>
											Raw
										</button>
									</div>

									{ form.settings.vcard_mode === 'builder' ? (
										<VCardBuilder
											data={ form.settings.vcard_data }
											onChange={ newData => setSetting( 'vcard_data', newData ) }
										/>
									) : (
										<div className="qrjump-form-row">
											<TextareaControl
												label="vCard / Text content"
												value={ form.destination_url }
												onChange={ val => setField( 'destination_url', val ) }
												rows={ 8 }
												placeholder={ 'BEGIN:VCARD\nVERSION:3.0\nFN:Jane Smith\nTEL:+61400000000\nEMAIL:jane@example.com\nEND:VCARD' }
												help="Paste your vCard text here. Scanning the QR code downloads it as a .vcf file. Scan analytics still work."
												__nextHasNoMarginBottom
											/>
										</div>
									) }
								</div>
							) : (
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
							) }
						</div>
					</div>

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
								<>
									<p className="qrjump-help-text">
										The slug is permanent and cannot be changed after creation.
									</p>
									{ shortUrl && (
										<div className="qrjump-short-url-preview">
											<span className="qrjump-short-url-preview__label">Short URL</span>
											<strong className="qrjump-short-url-preview__url">{ shortUrl }</strong>
											<CopyButton text={ shortUrl } label="Copy" />
										</div>
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
										<div className="qrjump-short-url-preview">
											<span className="qrjump-short-url-preview__label">Short URL</span>
											<strong className="qrjump-short-url-preview__url">{ shortUrl }</strong>
											<CopyButton text={ shortUrl } label="Copy" />
										</div>
									) }
								</>
							) : (
								<p className="qrjump-help-text">
									A unique slug will be generated automatically when you save.
								</p>
							) }
						</div>
					</div>

					<div className="qrjump-form-section">
						<div className="qrjump-form-section__header">
							<h2 className="qrjump-form-section__title">Schedule &amp; Limits</h2>
						</div>
						<div className="qrjump-form-section__body">
							<p className="qrjump-help-text">Leave schedule fields blank for no restriction. Set max scans to 0 for unlimited.</p>
							<div className="qrjump-form-row qrjump-form-row--cols-3">
								<div>
									<label className="qrjump-label">Active from</label>
									<input
										type="datetime-local"
										className="qrjump-datetime-input"
										value={ form.settings.active_from }
										onChange={ e => setSetting( 'active_from', e.target.value ) }
									/>
								</div>
								<div>
									<label className="qrjump-label">Active until (expiry)</label>
									<input
										type="datetime-local"
										className="qrjump-datetime-input"
										value={ form.settings.active_until }
										onChange={ e => setSetting( 'active_until', e.target.value ) }
									/>
								</div>
								<div>
									<TextControl
										label="Max scans (0 = unlimited)"
										value={ String( form.settings.max_scans ) }
										onChange={ val => setSetting( 'max_scans', Math.max( 0, parseInt( val ) || 0 ) ) }
										type="number"
										min={ 0 }
										__nextHasNoMarginBottom
									/>
								</div>
							</div>
							{ form.settings.max_scans > 0 && (
								<div className="qrjump-form-row" style={ { marginTop: 14 } }>
									<TextareaControl
										label="Message shown when limit is reached"
										value={ form.settings.max_scans_message }
										onChange={ val => setSetting( 'max_scans_message', val ) }
										rows={ 2 }
										placeholder="This QR code has reached its scan limit."
										__nextHasNoMarginBottom
									/>
								</div>
							) }
						</div>
					</div>

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
										label="Notify every X scans"
										value={ String( form.settings.notify_every_x_scans ) }
										onChange={ val =>
											setSetting( 'notify_every_x_scans', Math.max( 1, parseInt( val ) || 1 ) )
										}
										type="number"
										min={ 1 }
										help="Set to 1 to be notified on every scan, 10 to be notified every 10th scan, etc."
										__nextHasNoMarginBottom
									/>
								</div>
								{ form.settings.notify_every_x_scans <= 1 && (
									<div className="qrjump-form-row">
										<TextControl
											label="Rate limit (minutes between emails)"
											value={ String( form.settings.notify_rate_limit_minutes ) }
											onChange={ val =>
												setSetting( 'notify_rate_limit_minutes', Math.max( 1, parseInt( val ) || 1 ) )
											}
											type="number"
											min={ 1 }
											help="Only used when notifying on every scan. Overrides the global default set in Settings."
											__nextHasNoMarginBottom
										/>
									</div>
								) }
							</div>
						) }
					</div>

				</form>

				{ /* ── Full stats (below form, saved codes only) ── */ }
				{ ! isNew && (
					<div className="qrjump-dashboard-grid" style={ { marginTop: 24 } }>

						{ /* 30-day line chart */ }
						<div className="qrjump-card">
							<div className="qrjump-card__header">
								<h2 className="qrjump-card__title">Daily scans — last 30 days</h2>
							</div>
							<div className="qrjump-card__content">
								{ statsLoading ? (
									<div style={ { display: 'flex', justifyContent: 'center', padding: 24 } }>
										<Spinner />
									</div>
								) : fullStats?.daily?.length > 0 ? (
									<ScanChart data={ fullStats.daily } />
								) : (
									<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No scan data yet.</p>
								) }
							</div>
						</div>

						{ /* Hour of day */ }
						<div className="qrjump-card">
							<div className="qrjump-card__header">
								<h2 className="qrjump-card__title">Scans by hour of day</h2>
							</div>
							<div className="qrjump-card__content">
								{ statsLoading ? (
									<div style={ { display: 'flex', justifyContent: 'center', padding: 16 } }><Spinner /></div>
								) : fullStats?.hourly?.length > 0 ? (
									<HourChart data={ fullStats.hourly } />
								) : (
									<p style={ { color: 'var(--qrjump-text-muted)', margin: 0 } }>No data yet.</p>
								) }
							</div>
						</div>

					</div>
				) }

			</div>

			{ /* ── Right: control panel (sticky) ── */ }
			<div className="qrjump-edit-layout__preview">

				{ /* QR Preview */ }
				<QRPreview
					codeId={ previewCodeId }
					shortUrl={ previewShortUrl }
					fgColour={ form.fg_colour }
					bgColour={ form.bg_colour }
					slug={ form.slug || 'qr-code' }
				/>

				{ /* Save / Delete */ }
				<div className="qrjump-sidebar-panel">
					<Button
						variant="primary"
						type="submit"
						form="qrjump-code-form"
						isBusy={ saving }
						disabled={ saving }
						style={ { width: '100%', justifyContent: 'center' } }
					>
						{ saving ? 'Saving…' : isNew ? 'Create QR Code' : 'Save Changes' }
					</Button>
					{ ! isNew && (
						<Button
							variant="tertiary"
							isDestructive
							style={ { width: '100%', justifyContent: 'center', marginTop: 8 } }
							onClick={ async () => {
								if ( ! window.confirm( 'Delete this QR code and all its scan history? This cannot be undone.' ) ) return;
								await api.codes.delete( Number( id ) );
								navigate( '/codes' );
							} }
						>
							Delete code
						</Button>
					) }
				</div>

				{ ! isNew && (
					<>
						{ /* Status */ }
						<div className="qrjump-sidebar-panel">
							<h3 className="qrjump-sidebar-panel__title">Status</h3>
							<div className="qrjump-sidebar-status">
								<span className={ `qrjump-sidebar-status__badge qrjump-sidebar-status__badge--${ form.status ? 'active' : 'inactive' }` }>
									{ form.status ? 'Active' : 'Inactive' }
								</span>
								<ToggleControl
									label=""
									checked={ !! form.status }
									onChange={ val => setField( 'status', val ? 1 : 0 ) }
									__nextHasNoMarginBottom
								/>
							</div>
						</div>

						{ /* Quick Stats */ }
						{ stats && (
							<div className="qrjump-sidebar-panel">
								<h3 className="qrjump-sidebar-panel__title">Quick Stats</h3>
								<div className="qrjump-sidebar-stats">
									<div className="qrjump-sidebar-stat">
										<span className="qrjump-sidebar-stat__label">Total scans</span>
										<span className="qrjump-sidebar-stat__value">{ Number( stats.total ).toLocaleString() }</span>
									</div>
									<div className="qrjump-sidebar-stat">
										<span className="qrjump-sidebar-stat__label">Unique</span>
										<span className="qrjump-sidebar-stat__value">{ Number( stats.unique ).toLocaleString() }</span>
									</div>
									<div className="qrjump-sidebar-stat">
										<span className="qrjump-sidebar-stat__label">Last scan</span>
										<span className="qrjump-sidebar-stat__value qrjump-sidebar-stat__value--small">
											{ stats.last_scanned
												? new Date( stats.last_scanned + 'Z' ).toLocaleString( [], { dateStyle: 'medium', timeStyle: 'short' } )
												: '—'
											}
										</span>
									</div>
								</div>
							</div>
						) }

						{ /* Actions */ }
						{ shortUrl && (
							<div className="qrjump-sidebar-panel">
								<h3 className="qrjump-sidebar-panel__title">Actions</h3>
								<div className="qrjump-sidebar-actions">
									<CopyButton text={ shortUrl } label="Copy Short URL" className="qrjump-sidebar-action-btn" />
									<Button
										variant="secondary"
										style={ { width: '100%', justifyContent: 'center' } }
										onClick={ () => window.open( form.destination_url, '_blank', 'noreferrer' ) }
										disabled={ ! form.destination_url }
									>
										Open Destination ↗
									</Button>
									<Button
										variant="tertiary"
										isDestructive
										style={ { width: '100%', justifyContent: 'center' } }
										onClick={ handleResetScans }
									>
										Reset Stats
									</Button>
								</div>
							</div>
						) }
					</>
				) }

			</div>

		</div>
	);
}

/**
 * Generate a client-side vCard preview string from structured builder data.
 * Used for display and for pre-populating Raw mode on switch.
 * Photo embedding is server-side only.
 */
function generateVCardPreview( data = {} ) {
	const lines = [ 'BEGIN:VCARD', 'VERSION:3.0' ];
	const fn = data.full_name || [ data.first_name, data.last_name ].filter( Boolean ).join( ' ' );
	lines.push( 'FN:' + ( fn || 'Unknown' ) );
	lines.push( 'N:' + ( data.last_name || '' ) + ';' + ( data.first_name || '' ) + ';;;' );
	if ( data.org )          lines.push( 'ORG:' + data.org );
	if ( data.title )        lines.push( 'TITLE:' + data.title );
	if ( data.phone_mobile ) lines.push( 'TEL;TYPE=CELL:' + data.phone_mobile );
	if ( data.phone_work )   lines.push( 'TEL;TYPE=WORK:' + data.phone_work );
	if ( data.email )        lines.push( 'EMAIL:' + data.email );
	if ( data.website )      lines.push( 'URL:' + data.website );
	if ( data.address )      lines.push( 'ADR;TYPE=WORK:;;' + data.address + ';;;;' );
	if ( data.notes )        lines.push( 'NOTE:' + data.notes );
	if ( data.photo_id )     lines.push( 'PHOTO;ENCODING=b;TYPE=JPEG:[photo embedded on save]' );
	lines.push( 'END:VCARD' );
	return lines.join( '\n' );
}
