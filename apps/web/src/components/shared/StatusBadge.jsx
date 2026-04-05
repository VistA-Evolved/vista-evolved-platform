export function StatusBadge({ status, size = 'sm' }) {
  const styles = {
    active:   'bg-success-bg text-success',
    inactive: 'bg-[#F5F5F5] text-text-muted',
    locked:   'bg-danger-bg text-danger',
    pending:  'bg-info-bg text-info',
    warning:  'bg-warning-bg text-warning',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`
      inline-flex items-center rounded-full font-semibold uppercase tracking-wide
      ${size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'}
      ${styles[status.toLowerCase()] || styles.pending}
    `}>
      {label}
    </span>
  );
}

export function KeyCountBadge({ count }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-[#E8EEF5] text-steel text-[11px] font-bold font-mono">
      {String(count).padStart(2, '0')}
    </span>
  );
}

export function ActionBadge({ type, label }) {
  const styles = {
    create:   'bg-success-bg text-success',
    read:     'bg-info-bg text-info',
    update:   'bg-warning-bg text-warning',
    delete:   'bg-danger-bg text-danger',
    sign:     'bg-[#F3E5F5] text-[#7B1FA2]',
    override: 'bg-[#FFF3E0] text-[#E65100]',
  };
  return (
    <span className={`
      inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
      ${styles[(type || '').toLowerCase()] || styles.read}
    `}>
      {label || type}
    </span>
  );
}

export default StatusBadge;
