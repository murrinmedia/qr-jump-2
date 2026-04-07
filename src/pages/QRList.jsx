/**
 * QR Codes list page.
 *
 * Paginated, searchable, sortable table of all QR codes.
 * Full implementation (inline stats, bulk actions, filters) in Phase 3.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Spinner, SearchControl } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const PER_PAGE = 20;

export default function QRList() {
	const navigate = useNavigate();

	const [ codes,      setCodes      ] = useState( [] );
	const [ total,      setTotal      ] = useState( 0 );
	const [ page,       setPage       ] = useState( 1 );
	const [ search,     setSearch     ] = useState( '' );
	const [ orderby,    setOrderby    ] = useState( 'created_at' );
	const [ order,      setOrder      ] = useState( 'DESC' );
	const [ loading,    setLoading    ] = useState( true );
	const [ error,      setError      ] = useState( null );

	const fetchCodes = useCallback( () => {
		setLoading( true );
		api.codes
			.list( { page, per_page: PER_PAGE, search, orderby, order } )
			.then( ( { data, total: t } ) => {
				setCodes( data );
				setTotal( t );
			} )
			.catch( err => setError( err.message ) )
			.finally( () => setLoading( false ) );
	}, [ page, search, orderby, order ] );

	useEffect( () => {
		fetchCodes();
	}, [ fetchCodes ] );

	function handleSort( col ) {
		if ( col === orderby ) {
			setOrder( prev => ( prev === 'ASC' ? 'DESC' : 'ASC' ) );
		} else {
			setOrderby( col );
			setOrder( 'DESC' );
		}
		setPage( 1 );
	}

	function handleDelete( id ) {
		if ( ! window.confirm( 'Delete this QR code and all its scan history?' ) ) return;
		api.codes.delete( id ).then( fetchCodes );
	}

	return (
		<>
			<div className="qrjump-page-header">
				<h1 className="qrjump-page-header__title">
					QR Codes{ total > 0 && <span style={ { fontSize: 14, fontWeight: 400, marginLeft: 8, color: '#757575' } }>{ total }</span> }
				</h1>
				<Button variant="primary" onClick={ () => navigate( '/codes/new' ) }>
					Add New
				</Button>
			</div>

			<div style={ { marginBottom: 16 } }>
				<SearchControl
					value={ search }
					onChange={ val => { setSearch( val ); setPage( 1 ); } }
					placeholder="Search by title, slug, or URL…"
				/>
			</div>

			{ error && <p style={ { color: 'red' } }>{ error }</p> }

			<div className="qrjump-table-wrap">
				{ loading
					? <div className="qrjump-spinner-wrap"><Spinner /></div>
					: codes.length === 0
						? (
							<div className="qrjump-empty">
								<p>No QR codes found.</p>
								<Button variant="primary" onClick={ () => navigate( '/codes/new' ) }>
									Create your first QR code
								</Button>
							</div>
						)
						: (
							<table className="qrjump-table">
								<thead>
									<tr>
										<SortHeader col="title"      label="Title"        current={ orderby } dir={ order } onSort={ handleSort } />
										<SortHeader col="slug"       label="Slug"         current={ orderby } dir={ order } onSort={ handleSort } />
										<th>Destination</th>
										<th>Scans</th>
										<SortHeader col="status"     label="Status"       current={ orderby } dir={ order } onSort={ handleSort } />
										<SortHeader col="created_at" label="Created"      current={ orderby } dir={ order } onSort={ handleSort } />
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{ codes.map( code => (
										<tr key={ code.id }>
											<td><strong>{ code.title || '—' }</strong></td>
											<td><code style={ { fontSize: 12 } }>{ code.slug }</code></td>
											<td style={ { maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
												<a href={ code.destination_url } target="_blank" rel="noreferrer" style={ { color: '#2271b1' } }>
													{ code.destination_url }
												</a>
											</td>
											<td>{ Number( code.total_scans ).toLocaleString() }</td>
											<td>
												<span className={ `qrjump-badge qrjump-badge--${ code.status ? 'active' : 'inactive' }` }>
													{ code.status ? 'Active' : 'Inactive' }
												</span>
											</td>
											<td style={ { whiteSpace: 'nowrap', color: '#757575', fontSize: 12 } }>
												{ code.created_at ? code.created_at.slice( 0, 10 ) : '—' }
											</td>
											<td>
												<Button
													variant="secondary"
													isSmall
													onClick={ () => navigate( `/codes/${ code.id }/edit` ) }
													style={ { marginRight: 6 } }
												>
													Edit
												</Button>
												<Button
													variant="tertiary"
													isSmall
													isDestructive
													onClick={ () => handleDelete( code.id ) }
												>
													Delete
												</Button>
											</td>
										</tr>
									) ) }
								</tbody>
							</table>
						)
				}
			</div>

			{ /* Phase 3: pagination controls here */ }
		</>
	);
}

function SortHeader( { col, label, current, dir, onSort } ) {
	const active = col === current;
	const arrow  = active ? ( dir === 'ASC' ? ' ↑' : ' ↓' ) : '';
	return (
		<th onClick={ () => onSort( col ) } style={ { cursor: 'pointer' } }>
			{ label }{ arrow }
		</th>
	);
}
