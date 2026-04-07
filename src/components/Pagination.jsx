/**
 * Simple pagination control.  Renders nothing when there is only one page.
 */

/**
 * @param {{
 *   currentPage: number,
 *   totalPages:  number,
 *   onPageChange: (page: number) => void
 * }} props
 */
export default function Pagination( { currentPage, totalPages, onPageChange } ) {
	if ( totalPages <= 1 ) return null;

	// Show at most 5 page numbers centred around currentPage.
	const pages = [];
	const half = 2;
	let start = Math.max( 1, currentPage - half );
	let end   = Math.min( totalPages, currentPage + half );

	if ( end - start < 4 ) {
		if ( start === 1 ) end   = Math.min( totalPages, start + 4 );
		else               start = Math.max( 1, end - 4 );
	}

	for ( let i = start; i <= end; i++ ) {
		pages.push( i );
	}

	return (
		<nav className="qrjump-pagination" aria-label="Pagination">
			<button
				className="qrjump-pagination__btn"
				onClick={ () => onPageChange( currentPage - 1 ) }
				disabled={ currentPage <= 1 }
				aria-label="Previous page"
			>
				‹
			</button>

			{ start > 1 && (
				<>
					<button className="qrjump-pagination__btn" onClick={ () => onPageChange( 1 ) }>1</button>
					{ start > 2 && <span className="qrjump-pagination__ellipsis">…</span> }
				</>
			) }

			{ pages.map( p => (
				<button
					key={ p }
					className={ `qrjump-pagination__btn ${ p === currentPage ? 'qrjump-pagination__btn--active' : '' }` }
					onClick={ () => onPageChange( p ) }
					aria-current={ p === currentPage ? 'page' : undefined }
				>
					{ p }
				</button>
			) ) }

			{ end < totalPages && (
				<>
					{ end < totalPages - 1 && <span className="qrjump-pagination__ellipsis">…</span> }
					<button className="qrjump-pagination__btn" onClick={ () => onPageChange( totalPages ) }>{ totalPages }</button>
				</>
			) }

			<button
				className="qrjump-pagination__btn"
				onClick={ () => onPageChange( currentPage + 1 ) }
				disabled={ currentPage >= totalPages }
				aria-label="Next page"
			>
				›
			</button>
		</nav>
	);
}
