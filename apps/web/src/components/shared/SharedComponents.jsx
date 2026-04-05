import { useState, useCallback, useRef } from 'react';

export function SearchBar({ placeholder = 'Search...', onSearch, delay = 300 }) {
  const [value, setValue] = useState('');
  const timer = useRef(null);

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch?.(v), delay);
  }, [onSearch, delay]);

  return (
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">search</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-steel focus:ring-1 focus:ring-steel transition-colors"
      />
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (total === 0) {
    return <div className="px-1 py-3 text-xs text-text-secondary">No results found</div>;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-xs text-text-secondary">
      <span>Showing <strong className="text-text">{from}-{to}</strong> of <strong className="text-text">{total.toLocaleString()}</strong></span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="px-2 py-1 rounded border border-border disabled:opacity-30 hover:bg-surface-alt">Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${p === page ? 'bg-navy text-white' : 'border border-border hover:bg-surface-alt'}`}>
            {p}
          </button>
        ))}
        {totalPages > 5 && <span className="px-1">...</span>}
        {totalPages > 5 && (
          <button onClick={() => onPageChange(totalPages)}
            className="px-2.5 py-1 rounded border border-border hover:bg-surface-alt text-xs">{totalPages}</button>
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2 py-1 rounded border border-border disabled:opacity-30 hover:bg-surface-alt">Next</button>
      </div>
    </div>
  );
}

export function CautionBanner({ children }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-warning-bg border-l-4 border-warning rounded-r-md mb-6">
      <span className="material-symbols-outlined text-warning text-[20px] mt-0.5">warning</span>
      <p className="text-sm text-text/80">{children}</p>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, destructive = false, onConfirm, onCancel }) {
  const isDanger = danger || destructive;
  if (open === false) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">Cancel</button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-md ${isDanger ? 'bg-danger hover:bg-[#B02020]' : 'bg-navy hover:bg-steel'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FilterChips({ filters, onRemove }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Filters:</span>
      {filters.map(f => (
        <button key={f.key} onClick={() => onRemove(f.key)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8EEF5] text-steel hover:bg-[#D0DFF0] transition-colors">
          {f.label}
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      ))}
      {filters.length > 0 && (
        <button onClick={() => filters.forEach(f => onRemove(f.key))}
          className="text-xs text-steel hover:underline">Clear All</button>
      )}
    </div>
  );
}
