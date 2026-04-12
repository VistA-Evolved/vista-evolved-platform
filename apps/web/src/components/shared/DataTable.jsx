import { useState } from 'react';

export default function DataTable({ columns, data, onRowClick, selectedId, idField = 'id', rowClassName }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (colKey) => {
    if (sortCol === colKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  };

  const safeData = Array.isArray(data) ? data : [];
  const sorted = sortCol
    ? [...safeData].sort((a, b) => {
        const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : safeData;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                title={col.headerTitle}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                onKeyDown={(e) => { if (col.sortable !== false && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleSort(col.key); } }}
                tabIndex={col.sortable !== false ? 0 : undefined}
                aria-sort={sortCol === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={`
                  text-left px-3 py-2.5 text-white font-semibold text-xs uppercase tracking-wider
                  ${col.sortable !== false ? 'cursor-pointer hover:bg-[#2E3A5E] select-none' : ''}
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                `}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortCol === col.key && (
                    <span className="material-symbols-outlined text-[14px]">
                      {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isSelected = selectedId != null && row[idField] === selectedId;
            return (
              <tr
                key={row[idField] ?? i}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); } }}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                aria-selected={isSelected || undefined}
                className={`
                  border-t border-border transition-colors
                  ${onRowClick ? 'cursor-pointer' : ''}
                  ${isSelected
                    ? 'bg-[#E8EEF5] border-l-[3px] border-l-steel'
                    : i % 2 === 0 ? 'bg-white' : 'bg-surface-alt'}
                  ${!isSelected ? 'hover:bg-hover' : ''}
                  ${rowClassName ? rowClassName(row) : ''}
                `}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-3 py-2.5 text-[13px]
                      ${col.mono ? 'font-mono text-[12px]' : ''}
                      ${col.bold ? 'font-semibold text-text' : 'text-text'}
                      ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                    `}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-text-muted">
                <span className="material-symbols-outlined text-[32px] block mb-2">search_off</span>
                No records found matching your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {sorted.length > 0 && (
        <div className="px-3 py-2 text-xs text-[#6B7280] border-t border-border bg-[#FAFAFA]">
          Showing {sorted.length.toLocaleString()} {sorted.length === 1 ? 'record' : 'records'}
        </div>
      )}
    </div>
  );
}
