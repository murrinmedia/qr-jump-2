/**
 * Bulk Create QR Codes modal.
 *
 * Shows a row-based table UI. Each row has Title + Destination.
 * Rows are validated individually; invalid rows show inline errors and are
 * skipped. Completely empty rows are silently ignored.
 * Uses api.codes.create() — no new backend endpoint required.
 */

import { useState, useRef } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { api } from '../api/client';

const DEFAULT_ROW = () => ( { title: '', destination: '', titleError: '', destError: '' } );
const INITIAL_ROWS = 4;

function isValidUrl( str ) {
	try {
		const u = new URL( str );
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

export default function BulkCreate( { onClose, onCreated } ) {
	const [ rows,       setRows       ] = useState( () => Array.from( { length: INITIAL_ROWS }, DEFAULT_ROW ) );
	const [ submitting, setSubmitting ] = useState( false );
	const [ summary,    setSummary    ] = useState( null ); // { created, errors }
	const addRowRef = useRef( null );

	// ── Row helpers ───────────────────────────────────────────────────────────

	function updateRow( index, field, value ) {
		setRows( prev => prev.map( ( r, i ) =>
			i === index
				? { ...r, [ field ]: value, [ field + 'Error' ]: '' }
				: r
		) );
	}

	function addRow() {
		setRows( prev => [ ...prev, DEFAULT_ROW() ] );
		// Focus the new title input after render.
		setTimeout( () => {
			const inputs = document.querySelectorAll( '.qrjump-bulk-row__title-input' );
			inputs[ inputs.length - 1 ]?.focus();
		}, 50 );
	}

	function removeRow( index ) {
		setRows( prev => prev.length === 1 ? [ DEFAULT_ROW() ] : prev.filter( ( _, i ) => i !== index ) );
	}

	// ── Submit ────────────────────────────────────────────────────────────────

	async function handleSubmit() {
		// Validate all rows up-front.
		let hasErrors = false;
		const validated = rows.map( row => {
			const isEmpty = ! row.title.trim() && ! row.destination.trim();
			if ( isEmpty ) return { ...row, _skip: true };

			const titleError = row.title.trim() ? '' : 'Title is required.';
			const destError  = ! row.destination.trim()
				? 'Destination is required.'
				: ! isValidUrl( row.destination.trim() )
					? 'Enter a valid URL (https://…).'
					: '';

			if ( titleError || destError ) hasErrors = true;
			return { ...row, titleError, destError, _skip: false };
		} );

		setRows( validated );
		if ( hasErrors ) return;

		// Create codes — run in parallel but collect results.
		setSubmitting( true );
		setSummary( null );

		const toCreate = validated.filter( r => ! r._skip );
		if ( toCreate.length === 0 ) {
			setSubmitting( false );
			return;
		}

		const results = await Promise.allSettled(
			toCreate.map( row =>
				api.codes.create( {
					title:           row.title.trim(),
					destination_url: row.destination.trim(),
				} )
			)
		);

		const created = results.filter( r => r.status === 'fulfilled' ).length;
		const errors  = results.filter( r => r.status === 'rejected' ).length;

		setSubmitting( false );
		setSummary( { created, errors } );

		if ( created > 0 ) {
			onCreated(); // Refresh the list.
		}
	}

	// ── Keyboard shortcut: Enter in last destination → add row ────────────────

	function handleDestKeyDown( e, index ) {
		if ( e.key === 'Enter' && index === rows.length - 1 ) {
			e.preventDefault();
			addRow();
		}
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const allEmpty = rows.every( r => ! r.title.trim() && ! r.destination.trim() );

	return (
		<div className="qrjump-bulk-overlay" onClick={ e => { if ( e.target === e.currentTarget ) onClose(); } }>
			<div className="qrjump-bulk-modal" role="dialog" aria-modal="true" aria-label="Bulk Create QR Codes">

				{ /* Header */ }
				<div className="qrjump-bulk-modal__header">
					<h2 className="qrjump-bulk-modal__title">Bulk Create QR Codes</h2>
					<button type="button" className="qrjump-bulk-modal__close" onClick={ onClose } aria-label="Close">✕</button>
				</div>

				{ /* Summary banner */ }
				{ summary && (
					<div className={ `qrjump-bulk-summary qrjump-bulk-summary--${ summary.errors > 0 ? 'partial' : 'success' }` }>
						{ summary.created > 0 && (
							<span>✓ { summary.created } QR code{ summary.created !== 1 ? 's' : '' } created successfully.</span>
						) }
						{ summary.errors > 0 && (
							<span> { summary.errors } row{ summary.errors !== 1 ? 's' : '' } failed.</span>
						) }
						{ summary.created > 0 && summary.errors === 0 && (
							<button type="button" className="qrjump-bulk-summary__close-btn" onClick={ onClose }>Close</button>
						) }
					</div>
				) }

				{ /* Table header */ }
				<div className="qrjump-bulk-table">
					<div className="qrjump-bulk-table__head">
						<div className="qrjump-bulk-col qrjump-bulk-col--title">Title <span className="qrjump-bulk-required">*</span></div>
						<div className="qrjump-bulk-col qrjump-bulk-col--dest">Destination URL <span className="qrjump-bulk-required">*</span></div>
						<div className="qrjump-bulk-col qrjump-bulk-col--remove" />
					</div>

					{ /* Rows */ }
					<div className="qrjump-bulk-table__body">
						{ rows.map( ( row, i ) => (
							<div
								key={ i }
								className={ `qrjump-bulk-row${ row.titleError || row.destError ? ' qrjump-bulk-row--error' : '' }` }
							>
								<div className="qrjump-bulk-col qrjump-bulk-col--title">
									<input
										type="text"
										className={ `qrjump-bulk-row__input qrjump-bulk-row__title-input${ row.titleError ? ' qrjump-bulk-row__input--invalid' : '' }` }
										placeholder="e.g. Summer Campaign"
										value={ row.title }
										onChange={ e => updateRow( i, 'title', e.target.value ) }
										disabled={ submitting }
										aria-label={ `Row ${ i + 1 } title` }
									/>
									{ row.titleError && <span className="qrjump-bulk-row__error">{ row.titleError }</span> }
								</div>
								<div className="qrjump-bulk-col qrjump-bulk-col--dest">
									<input
										type="url"
										className={ `qrjump-bulk-row__input${ row.destError ? ' qrjump-bulk-row__input--invalid' : '' }` }
										placeholder="https://example.com"
										value={ row.destination }
										onChange={ e => updateRow( i, 'destination', e.target.value ) }
										onKeyDown={ e => handleDestKeyDown( e, i ) }
										disabled={ submitting }
										aria-label={ `Row ${ i + 1 } destination` }
									/>
									{ row.destError && <span className="qrjump-bulk-row__error">{ row.destError }</span> }
								</div>
								<div className="qrjump-bulk-col qrjump-bulk-col--remove">
									<button
										type="button"
										className="qrjump-bulk-row__remove"
										onClick={ () => removeRow( i ) }
										disabled={ submitting }
										aria-label={ `Remove row ${ i + 1 }` }
									>
										×
									</button>
								</div>
							</div>
						) ) }
					</div>
				</div>

				{ /* Add row */ }
				<button
					ref={ addRowRef }
					type="button"
					className="qrjump-bulk-add-row"
					onClick={ addRow }
					disabled={ submitting }
				>
					+ Add Row
				</button>

				{ /* Footer */ }
				<div className="qrjump-bulk-modal__footer">
					<p className="qrjump-bulk-hint">
						Slugs are auto-generated. Leave any row blank to skip it.
					</p>
					<div className="qrjump-bulk-modal__footer-actions">
						<Button variant="tertiary" onClick={ onClose } disabled={ submitting }>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={ handleSubmit }
							isBusy={ submitting }
							disabled={ submitting || allEmpty }
						>
							{ submitting ? 'Creating…' : 'Create Codes' }
						</Button>
					</div>
				</div>

			</div>
		</div>
	);
}
