import { useState, useCallback, useRef, useEffect } from 'react';

export function SearchBar({ placeholder = 'Search...', onSearch, delay = 300, value: controlledValue }) {
  const [value, setValue] = useState(controlledValue ?? '');
  const timer = useRef(null);

  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== value) {
      clearTimeout(timer.current);
      setValue(controlledValue);
    }
  }, [controlledValue]);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

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
        aria-label={placeholder}
        className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-steel focus:ring-1 focus:ring-steel transition-colors"
      />
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }) {
  const safePageSize = Math.max(1, Number(pageSize) || 25);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.max(1, Math.min(Number(page) || 1, totalPages));
  if (safeTotal === 0) {
    return <div className="px-1 py-3 text-xs text-text-secondary">No results found</div>;
  }
  const from = (safePage - 1) * safePageSize + 1;
  const to = Math.min(safePage * safePageSize, safeTotal);

  const startPage = Math.max(1, Math.min(safePage - 2, totalPages - 4));
  const endPage = Math.min(totalPages, startPage + 4);
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-xs text-text-secondary">
      <span>Showing <strong className="text-text">{from}-{to}</strong> of <strong className="text-text">{safeTotal.toLocaleString()}</strong></span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}
          className="px-2 py-1 rounded border border-border disabled:opacity-30 hover:bg-surface-alt">Prev</button>
        {startPage > 1 && (
          <>
            <button onClick={() => onPageChange(1)}
              className="px-2.5 py-1 rounded text-xs font-medium border border-border hover:bg-surface-alt">1</button>
            {startPage > 2 && <span className="px-1">...</span>}
          </>
        )}
        {pageNumbers.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${p === safePage ? 'bg-navy text-white' : 'border border-border hover:bg-surface-alt'}`}>
            {p}
          </button>
        ))}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1">...</span>}
            <button onClick={() => onPageChange(totalPages)}
              className="px-2.5 py-1 rounded border border-border hover:bg-surface-alt text-xs">{totalPages}</button>
          </>
        )}
        <button onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}
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

export function ConfirmDialog({ open = true, title, message, confirmLabel = 'Confirm', danger = false, destructive = false, onConfirm, onCancel }) {
  const isDanger = danger || destructive;
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length) (isDanger ? first : last).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (e.key === 'Enter') {
        if (e.target?.closest?.('button')) return;
        e.preventDefault();
        onConfirm?.();
        return;
      }
      if (e.key === 'Tab' && focusable.length) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [open, isDanger, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
      role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
      onClick={onCancel} ref={dialogRef}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-text mb-2">{title || 'Confirm'}</h3>
        <p className="text-sm text-text-secondary mb-6">{message || 'Are you sure?'}</p>
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
      {(filters || []).map(f => (
        <button key={f.key} onClick={() => onRemove(f.key)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8EEF5] text-steel hover:bg-[#D0DFF0] transition-colors">
          {f.label}
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      ))}
      {(filters || []).length > 0 && (
        <button onClick={() => (filters || []).forEach(f => onRemove(f.key))}
          className="text-xs text-steel hover:underline">Clear All</button>
      )}
    </div>
  );
}
