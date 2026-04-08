/**
 * QR Codes list page.
 *
 * Features:
 *  - Click anywhere on a row to open the edit screen.
 *  - Checkboxes + bulk actions (delete, activate, deactivate).
 *  - Duplicate button per row.
 *  - Status filter, search, sortable columns, pagination.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Spinner, SelectControl } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Pagination from '../components/Pagination';

const PER_PAGE = 20;

export default function QRList() {
	const navigate = useNavigate();

	const [ codes,       setCodes       ] = useState( [] );
	const [ total,       setTotal       ] = useState( 0 );
	const [ totalPages,  setTotalPages  ] = useState( 1 );
	const [ page,        setPage        ] = useState( 1 );
	const [ search,      setSearch      ] = useState( '' );
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ status,      setStatus      ] = useState( '' );
	const [ orderby,     setOrderby     ] = useState( 'created_at' );
	const [ order,       setOrder       ] = useState( 'DESC' );
	const [ loading,     setLoading     ] = useState( true );
	const [ error,       setError       ] = useState( null );
	const [ selected,    setSelected    ] = useState( [] );   // checked IDs
	const [ bulkAction,  setBulkAction  ] = useState( '' );
	const [ bulkWorking, setBulkWorking ] = useState( false );


	const fetchCodes = useCallback( () => {
		setLoading( true );
		setError( null );
		setSelected( [] );

		const params = { page, per_page: PER_PAGE, orderby, order };
		if ( search ) params.search = search;
		if ( status !== '' ) params.status = status;

		api.codes
			.list( params )
			.then( ( { data, total: t, totalPages: tp } ) => {
				setCodes( data );
				setTotal( t );
				setTotalPages( tp );
			} )
			.catch( err => setError( err.message ) )
			.finally( () => setLoading( false ) );
	}, [ page, search, status, orderby, order ] );

	useEffect( () => { fetchCodes(); }, [ fetchCodes ] );

	function handleSort( col ) {
		if ( col === orderby ) {
			setOrder( prev => prev === 'ASC' ? 'DESC' : 'ASC' );
		} else {
			setOrderby( col );
			setOrder( 'DESC' );
		}
		setPage( 1 );
	}

	function handleSearchKeyDown( e ) {
		if ( e.key === 'Enter' ) { setSearch( searchInput ); setPage( 1 ); }
	}

	function handleSearchBlur() {
		if ( searchInput !== search ) { setSearch( searchInput ); setPage( 1 ); }
	}

	// ── Selection ─────────────────────────────────────────────────────────────

	const allSelected = codes.length > 0 && selected.length === codes.length;

	function toggleAll( e ) {
		setSelected( e.target.checked ? codes.map( c => c.id ) : [] );
	}

	function toggleOne( id ) {
		setSelected( prev =>
			prev.includes( id ) ? prev.filter( x => x !== id ) : [ ...prev, id ]
		);
	}

	// ── Bulk action ───────────────────────────────────────────────────────────

	async function handleBulkApply() {
		if ( ! bulkAction || selected.length === 0 ) return;

		if ( bulkAction === 'delete' ) {
			if ( ! window.confirm( `Delete ${ selected.length } QR code(s) and all their scan history? This cannot be undone.` ) ) return;
		}

		setBulkWorking( true );
		try {
			await api.codes.bulk( bulkAction, selected );
			fetchCodes();
			setBulkAction( '' );
		} catch ( err ) {
			setError( err.message );
		} finally {
			setBulkWorking( false );
		}
	}

	// ── Per-row actions ───────────────────────────────────────────────────────

	async function handleDuplicate( e, id ) {
		e.stopPropagation();
		const copy = await api.codes.duplicate( id );
		navigate( `/codes/${ copy.id }/edit` );
	}

	async function handleDelete( e, id, title ) {
		e.stopPropagation();
		const name = title ? `"${ title }"` : 'this QR code';
		if ( ! window.confirm( `Delete ${ name } and all its scan history? This cannot be undone.` ) ) return;
		await api.codes.delete( id );
		fetchCodes();
	}

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">
					QR Codes
					{ total > 0 && <span className="qrjump-page-header__count">{ total }</span> }
				</h1>
				<Button variant="primary" onClick={ () => navigate( '/codes/new' ) }>
					Add New
				</Button>
			</div>

			{ /* ── Filters bar ── */ }
			<div className="qrjump-filters">
				<div className="qrjump-filters__search">
					<input
						type="search"
						className="qrjump-search-input"
						placeholder="Search by title, slug, or URL…"
						value={ searchInput }
						onChange={ e => setSearchInput( e.target.value ) }
						onKeyDown={ handleSearchKeyDown }
						onBlur={ handleSearchBlur }
						aria-label="Search QR codes"
					/>
				</div>
				<div className="qrjump-filters__status">
					<SelectControl
						value={ status }
						options={ [
							{ label: 'All statuses', value: '' },
							{ label: 'Active',       value: '1' },
							{ label: 'Inactive',     value: '0' },
						] }
						onChange={ val => { setStatus( val ); setPage( 1 ); } }
						__nextHasNoMarginBottom
					/>
				</div>
			</div>

			{ /* ── Bulk action bar ── */ }
			{ selected.length > 0 && (
				<div className="qrjump-bulk-bar">
					<span className="qrjump-bulk-bar__count">
						{ selected.length } selected
					</span>
					<SelectControl
						value={ bulkAction }
						options={ [
							{ label: 'Bulk action…', value: ''           },
							{ label: 'Activate',     value: 'activate'   },
							{ label: 'Deactivate',   value: 'deactivate' },
							{ label: 'Delete',       value: 'delete'     },
						] }
						onChange={ setBulkAction }
						__nextHasNoMarginBottom
					/>
					<Button
						variant="secondary"
						onClick={ handleBulkApply }
						isBusy={ bulkWorking }
						disabled={ ! bulkAction || bulkWorking }
					>
						Apply
					</Button>
					<Button variant="tertiary" onClick={ () => setSelected( [] ) }>
						Clear
					</Button>
				</div>
			) }

			{ error && (
				<div className="qrjump-notice qrjump-notice--error" style={ { marginBottom: 16 } }>
					{ error }
				</div>
			) }

			<div className="qrjump-table-wrap">
				{ loading ? (
					<div className="qrjump-spinner-wrap"><Spinner /></div>
				) : codes.length === 0 ? (
					<div className="qrjump-empty">
						{ search || status !== '' ? (
							<>
								<p>No QR codes match your filters.</p>
								<Button
									variant="secondary"
									onClick={ () => { setSearch( '' ); setSearchInput( '' ); setStatus( '' ); setPage( 1 ); } }
								>
									Clear filters
								</Button>
							</>
						) : (
							<>
								<p>No QR codes yet.</p>
								<Button variant="primary" onClick={ () => navigate( '/codes/new' ) }>
									Create your first QR code
								</Button>
							</>
						) }
					</div>
				) : (
					<table className="qrjump-table">
						<thead>
							<tr>
								<th style={ { width: 36 } }>
									<input
										type="checkbox"
										checked={ allSelected }
										onChange={ toggleAll }
										aria-label="Select all"
									/>
								</th>
								<SortHeader col="title"      label="Title"    current={ orderby } dir={ order } onSort={ handleSort } />
								<th>Destination</th>
								<th style={ { textAlign: 'right' } }>Today</th>
								<th style={ { textAlign: 'right' } }>Week</th>
								<th style={ { textAlign: 'right' } }>Month</th>
								<th style={ { textAlign: 'right' } }>Last 30</th>
								<SortHeader col="status"      label="Status"  current={ orderby } dir={ order } onSort={ handleSort } />
								<SortHeader col="created_at"  label="Created" current={ orderby } dir={ order } onSort={ handleSort } />
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{ codes.map( code => {
								return (
									<tr
										key={ code.id }
										onClick={ () => navigate( `/codes/${ code.id }/edit` ) }
										style={ { cursor: 'pointer' } }
										className={ selected.includes( code.id ) ? 'qrjump-table__row--selected' : '' }
									>
										<td onClick={ e => { e.stopPropagation(); toggleOne( code.id ); } }>
											<input
												type="checkbox"
												checked={ selected.includes( code.id ) }
												onChange={ () => toggleOne( code.id ) }
												aria-label={ `Select ${ code.title || code.slug }` }
											/>
										</td>
										<td>
											<strong style={ { display: 'block' } }>{ code.title || '—' }</strong>
											<span style={ { fontSize: 11, color: 'var(--qrjump-text-muted)', fontFamily: 'monospace' } }>
												{ code.slug }
											</span>
										</td>
										<td className="qrjump-table__destination" onClick={ e => e.stopPropagation() }>
											<a href={ code.destination_url } target="_blank" rel="noreferrer" title={ code.destination_url }>
												{ code.destination_url }
											</a>
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( code.scans_today ).toLocaleString() }
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( code.scans_week ).toLocaleString() }
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( code.scans_month ).toLocaleString() }
										</td>
										<td style={ { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }>
											{ Number( code.scans_30d ).toLocaleString() }
										</td>
										<td>
											<span className={ `qrjump-badge qrjump-badge--${ code.status ? 'active' : 'inactive' }` }>
												{ code.status ? 'Active' : 'Inactive' }
											</span>
										</td>
										<td style={ { whiteSpace: 'nowrap', color: 'var(--qrjump-text-muted)', fontSize: 12 } }>
											{ code.created_at ? code.created_at.slice( 0, 10 ) : '—' }
										</td>
										<td style={ { whiteSpace: 'nowrap' } } onClick={ e => e.stopPropagation() }>
											<Button
												variant="secondary"
												size="small"
												onClick={ e => handleDuplicate( e, code.id ) }
												style={ { marginRight: 6 } }
												title="Duplicate"
											>
												⧉
											</Button>
											<Button
												variant="tertiary"
												size="small"
												isDestructive
												onClick={ e => handleDelete( e, code.id, code.title ) }
											>
												Delete
											</Button>
										</td>
									</tr>
								);
							} ) }
						</tbody>
					</table>
				) }
			</div>

			{ totalPages > 1 && (
				<div style={ { marginTop: 16 } }>
					<Pagination
						currentPage={ page }
						totalPages={ totalPages }
						onPageChange={ p => setPage( p ) }
					/>
				</div>
			) }
		</>
	);
}

function SortHeader( { col, label, current, dir, onSort } ) {
	const active = col === current;
	return (
		<th className="sortable" onClick={ () => onSort( col ) }>
			{ label }
			<span className={ `qrjump-sort-icon ${ active ? 'qrjump-sort-icon--active' : '' }` }>
				{ active ? ( dir === 'ASC' ? ' ↑' : ' ↓' ) : ' ↕' }
			</span>
		</th>
	);
}
