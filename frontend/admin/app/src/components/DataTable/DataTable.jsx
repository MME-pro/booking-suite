/**
 * DataTable — generic table.
 *
 * Columns describe what to render; the table knows nothing about apartments or
 * any other entity.
 *
 * column = {
 *   key:     string                    unique, also the default row accessor
 *   header:  node                      column heading
 *   render?: ( row ) => node           custom cell
 *   align?:  'start' | 'center' | 'end'
 *   width?:  string                    any CSS width
 * }
 */

import './DataTable.css';

export default function DataTable( {
	columns,
	rows,
	getRowKey = ( row, index ) => row.id ?? index,
	onRowClick = null,
	emptyContent = null,
	className = '',
} ) {
	const classes = [ 'bks-data-table', className ]
		.filter( Boolean )
		.join( ' ' );

	if ( ! rows.length && emptyContent ) {
		return <div className="bks-data-table__empty">{ emptyContent }</div>;
	}

	return (
		<div className={ classes }>
			<table className="bks-data-table__table">
				<thead>
					<tr>
						{ columns.map( ( column ) => (
							<th
								key={ column.key }
								scope="col"
								style={
									column.width
										? { width: column.width }
										: undefined
								}
								className={ `bks-data-table__cell bks-data-table__cell--${
									column.align ?? 'start'
								}` }
							>
								{ column.header }
							</th>
						) ) }
					</tr>
				</thead>
				<tbody>
					{ rows.map( ( row, index ) => (
						<tr
							key={ getRowKey( row, index ) }
							className={
								onRowClick
									? 'bks-data-table__row--clickable'
									: ''
							}
							/*
							 * A row is not a native control, so it needs an
							 * explicit role and key handling to stay reachable
							 * without a mouse.
							 */
							role={ onRowClick ? 'button' : undefined }
							tabIndex={ onRowClick ? 0 : undefined }
							onClick={
								onRowClick ? () => onRowClick( row ) : undefined
							}
							onKeyDown={
								onRowClick
									? ( event ) => {
											if (
												'Enter' === event.key ||
												' ' === event.key
											) {
												event.preventDefault();
												onRowClick( row );
											}
									  }
									: undefined
							}
						>
							{ columns.map( ( column ) => (
								<td
									key={ column.key }
									className={ `bks-data-table__cell bks-data-table__cell--${
										column.align ?? 'start'
									}` }
								>
									{ column.render
										? column.render( row )
										: row[ column.key ] }
								</td>
							) ) }
						</tr>
					) ) }
				</tbody>
			</table>
		</div>
	);
}
