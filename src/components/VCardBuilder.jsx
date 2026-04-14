/**
 * Structured vCard builder UI.
 *
 * Renders form fields for all vcard_data fields. Changes are propagated
 * upward via onChange(newData). Server-side generation from this data
 * happens in VCard_Builder::generate() on every save.
 */

import { useState } from '@wordpress/element';
import { TextControl, TextareaControl, Button } from '@wordpress/components';

export const EMPTY_VCARD_DATA = {
	first_name:   '',
	last_name:    '',
	full_name:    '',
	org:          '',
	title:        '',
	phone_mobile: '',
	phone_work:   '',
	email:        '',
	website:      '',
	address:      '',
	notes:        '',
	photo_id:     0,
	photo_url:    '',
};

export default function VCardBuilder( { data = {}, onChange } ) {
	const d = { ...EMPTY_VCARD_DATA, ...data };

	// Track whether the user has manually set full_name so auto-derive stops.
	const [ fullNameManual, setFullNameManual ] = useState(
		!! d.full_name && d.full_name !== ( d.first_name + ' ' + d.last_name ).trim()
	);

	function set( key, value ) {
		const next = { ...d, [ key ]: value };
		// Auto-derive full name from first + last unless user has overridden it.
		if ( ( key === 'first_name' || key === 'last_name' ) && ! fullNameManual ) {
			next.full_name = ( next.first_name + ' ' + next.last_name ).trim();
		}
		onChange( next );
	}

	function handleFullNameChange( value ) {
		setFullNameManual( true );
		onChange( { ...d, full_name: value } );
	}

	function openMediaPicker() {
		if ( ! window.wp?.media ) return;
		const frame = window.wp.media( {
			title:    'Select Contact Photo',
			button:   { text: 'Use this photo' },
			multiple: false,
			library:  { type: 'image' },
		} );
		frame.on( 'select', () => {
			const att = frame.state().get( 'selection' ).first().toJSON();
			onChange( { ...d, photo_id: att.id, photo_url: att.url } );
		} );
		frame.open();
	}

	function removePhoto() {
		onChange( { ...d, photo_id: 0, photo_url: '' } );
	}

	const preview = generatePreview( d );

	return (
		<div className="qrjump-vcard-builder">

			{ /* ── Name ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Name</span>
				<div className="qrjump-form-row--cols-3">
					<TextControl
						label="First name"
						value={ d.first_name }
						onChange={ v => set( 'first_name', v ) }
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Last name"
						value={ d.last_name }
						onChange={ v => set( 'last_name', v ) }
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Display name"
						value={ d.full_name }
						onChange={ handleFullNameChange }
						help={ fullNameManual ? '' : 'Auto-derived from first + last' }
						__nextHasNoMarginBottom
					/>
				</div>
			</div>

			{ /* ── Work ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Work</span>
				<div className="qrjump-form-row--cols-2">
					<TextControl
						label="Company / Organisation"
						value={ d.org }
						onChange={ v => set( 'org', v ) }
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Job title"
						value={ d.title }
						onChange={ v => set( 'title', v ) }
						__nextHasNoMarginBottom
					/>
				</div>
			</div>

			{ /* ── Contact ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Contact</span>
				<div className="qrjump-form-row--cols-2">
					<TextControl
						label="Mobile phone"
						value={ d.phone_mobile }
						onChange={ v => set( 'phone_mobile', v ) }
						type="tel"
						placeholder="+44 7700 000000"
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Work phone"
						value={ d.phone_work }
						onChange={ v => set( 'phone_work', v ) }
						type="tel"
						placeholder="+44 20 0000 0000"
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Email"
						value={ d.email }
						onChange={ v => set( 'email', v ) }
						type="email"
						placeholder="name@example.com"
						__nextHasNoMarginBottom
					/>
					<TextControl
						label="Website"
						value={ d.website }
						onChange={ v => set( 'website', v ) }
						type="url"
						placeholder="https://example.com"
						__nextHasNoMarginBottom
					/>
				</div>
			</div>

			{ /* ── Address ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Address</span>
				<TextareaControl
					label="Address"
					value={ d.address }
					onChange={ v => set( 'address', v ) }
					rows={ 2 }
					placeholder="123 Main Street, London, EC1A 1BB"
					__nextHasNoMarginBottom
				/>
			</div>

			{ /* ── Notes ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Notes</span>
				<TextareaControl
					label="Notes"
					value={ d.notes }
					onChange={ v => set( 'notes', v ) }
					rows={ 2 }
					__nextHasNoMarginBottom
				/>
			</div>

			{ /* ── Photo ── */ }
			<div className="qrjump-vcard-section">
				<span className="qrjump-vcard-section__title">Photo</span>
				<div className="qrjump-vcard-photo">
					{ d.photo_url ? (
						<div className="qrjump-vcard-photo__preview">
							<img src={ d.photo_url } alt="Contact photo" />
						</div>
					) : (
						<div className="qrjump-vcard-photo__empty">
							<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<circle cx="12" cy="8" r="4" />
								<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
							</svg>
							<span>No photo selected</span>
						</div>
					) }
					<div className="qrjump-vcard-photo__actions">
						<Button variant="secondary" onClick={ openMediaPicker }>
							{ d.photo_url ? 'Change photo' : 'Select from media library' }
						</Button>
						{ d.photo_url && (
							<Button variant="tertiary" isDestructive onClick={ removePhoto }>
								Remove
							</Button>
						) }
					</div>
					<p className="qrjump-help-text">
						Photo is embedded in the .vcf file when you save. For best results use a <strong>square JPEG under 30KB</strong> (e.g. 300×300px). The server automatically uses a resized version — if the image is still too large after resizing it will be omitted from the vCard.
					</p>
				</div>
			</div>

			{ /* ── Generated preview ── */ }
			<div className="qrjump-vcard-section qrjump-vcard-section--preview">
				<span className="qrjump-vcard-section__title">Generated vCard preview</span>
				<textarea
					className="qrjump-vcard-preview"
					readOnly
					value={ preview }
					rows={ Math.min( 12, preview.split( '\n' ).length + 1 ) }
					aria-label="Generated vCard preview"
				/>
				<p className="qrjump-help-text">
					Read-only preview. Photo data is embedded by the server on save — it will not appear here.
				</p>
			</div>

		</div>
	);
}

/**
 * Client-side vCard preview (no photo embedding — server handles that).
 * Used only for display; server-side VCard_Builder::generate() is authoritative.
 */
function generatePreview( d ) {
	const lines = [ 'BEGIN:VCARD', 'VERSION:3.0' ];

	const fn = d.full_name || [ d.first_name, d.last_name ].filter( Boolean ).join( ' ' );
	lines.push( 'FN:' + ( fn || 'Unknown' ) );
	lines.push( 'N:' + ( d.last_name || '' ) + ';' + ( d.first_name || '' ) + ';;;' );

	if ( d.org )          lines.push( 'ORG:' + d.org );
	if ( d.title )        lines.push( 'TITLE:' + d.title );
	if ( d.phone_mobile ) lines.push( 'TEL;TYPE=CELL:' + d.phone_mobile );
	if ( d.phone_work )   lines.push( 'TEL;TYPE=WORK:' + d.phone_work );
	if ( d.email )        lines.push( 'EMAIL:' + d.email );
	if ( d.website )      lines.push( 'URL:' + d.website );
	if ( d.address )      lines.push( 'ADR;TYPE=WORK:;;' + d.address + ';;;;' );
	if ( d.notes )        lines.push( 'NOTE:' + d.notes );
	if ( d.photo_id )     lines.push( 'PHOTO;ENCODING=b;TYPE=JPEG:[embedded on save]' );

	lines.push( 'END:VCARD' );
	return lines.join( '\n' );
}
