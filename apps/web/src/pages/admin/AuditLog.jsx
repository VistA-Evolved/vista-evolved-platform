import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { Pagination } from '../../components/shared/SharedComponents';
import { ActionBadge } from '../../components/shared/StatusBadge';
import { getAuditFileMan, getAuditSignonLog, getAuditErrorLog, getAuditFailedAccess, getAuditProgrammerMode } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';
import { fmDateToDate, formatDateTime } from '../../utils/transforms';

/**
 * Audit Log Viewer — merges 4 live VistA audit sources
 * @vista FileMan audit, sign-on log, error log, failed access
 *
 * Live endpoints:
 *   GET /audit/fileman      → FileMan data audit trail
 *   GET /audit/signon-log   → Sign-on/sign-off events
 *   GET /audit/error-log    → Error trap entries
 *   GET /audit/failed-access → Failed login attempts
 */

const ACTION_TYPES = ['All', 'Sign-On', 'Sign-Off', 'Error', 'Failed Access', 'Data Change', 'Programmer Mode'];
const AUDIT_SOURCES = [
  { id: 'all', label: 'All Sources' },
  { id: 'signon', label: 'Sign-On Log' },
  { id: 'fileman', label: 'Data Audit' },
  { id: 'error', label: 'Error Log' },
  { id: 'failed', label: 'Failed Access' },
  { id: 'programmer', label: 'Programmer Mode' },
];
const columns = [
  { key: 'timestamp', label: 'Timestamp', render: (val) => <span className="font-mono text-[11px]">{val}</span> },
  { key: 'user', label: 'Staff Member' },
  { key: 'action', label: 'Action', align: 'center', render: (val, row) => <ActionBadge type={row.actionColor || 'read'} label={val} /> },
  { key: 'source', label: 'Source' },
  { key: 'detail', label: 'Detail', render: (val) => <span className="text-xs text-text-secondary line-clamp-2">{val}</span> },
];

function toSortableTime(fmDateVal) {
  const d = fmDateToDate(fmDateVal);
  return d ? d.getTime() : 0;
}

let auditSeq = 0;
function normalizeAuditEntry(raw, source) {
  const seq = ++auditSeq;
  if (source === 'signon') {
    const iso = fmDateToDate(raw.signOnDateTime)?.toISOString();
    return {
      id: `signon-${raw.ien || seq}`,
      timestamp: iso ? formatDateTime(iso) : raw.signOnDateTime || '',
      _sortTime: toSortableTime(raw.signOnDateTime),
      user: raw.userName || 'Staff Member',
      action: raw.signOffDateTime ? 'Sign-Off' : 'Sign-On',
      actionColor: 'create',
      source: 'Sign-On Log',
      detail: raw.deviceUsed || '',
      raw,
    };
  }
  if (source === 'error') {
    const iso = fmDateToDate(raw.mostRecentDateTime)?.toISOString();
    return {
      id: `error-${raw.ien || seq}`,
      timestamp: iso ? formatDateTime(iso) : '',
      _sortTime: toSortableTime(raw.mostRecentDateTime),
      user: 'System',
      action: 'Error',
      actionColor: 'delete',
      source: 'Error Trap',
      detail: raw.errorText || '',
      raw,
    };
  }
  if (source === 'failed') {
    const iso = fmDateToDate(raw.dateTime)?.toISOString();
    return {
      id: `failed-${raw.ien || seq}`,
      timestamp: iso ? formatDateTime(iso) : '',
      _sortTime: toSortableTime(raw.dateTime),
      user: raw.userName || 'Unknown',
      action: 'Failed Access',
      actionColor: 'delete',
      source: 'Failed Access',
      detail: raw.reason || '',
      raw,
    };
  }
  if (source === 'programmer') {
    const iso = fmDateToDate(raw.dateTime || raw.signOnDateTime)?.toISOString();
    return {
      id: `prog-${raw.ien || seq}`,
      timestamp: iso ? formatDateTime(iso) : '',
      _sortTime: toSortableTime(raw.dateTime || raw.signOnDateTime),
      user: raw.userName || 'Staff Member',
      action: 'Programmer Mode',
      actionColor: 'delete',
      source: 'Programmer Mode',
      detail: raw.routine || raw.description || 'Programmer mode access',
      raw,
    };
  }
  const iso = fmDateToDate(raw.dateTime)?.toISOString();
  return {
    id: `fm-${raw.ien || seq}`,
    timestamp: iso ? formatDateTime(iso) : '',
    _sortTime: toSortableTime(raw.dateTime),
    user: raw.userName || 'Staff Member',
    action: 'Data Change',
    actionColor: 'update',
    source: 'Data Audit',
    detail: raw.fieldChanged ? `File ${raw.fileNumber || ''} field ${raw.fieldChanged}: ${raw.oldValue || ''} → ${raw.newValue || ''}` : (raw.description || ''),
    raw,
  };
}

export default function AuditLog() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [actionFilter, setActionFilter] = useState('All');
  const [userSearch, setUserSearch] = useState(searchParams.get('user') || '');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const PAGE_SIZE = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        getAuditSignonLog(),
        getAuditErrorLog(),
        getAuditFailedAccess(),
        getAuditFileMan(),
        getAuditProgrammerMode(),
      ]);

      const combined = [];
      const [signonRes, errorRes, failedRes, filemanRes, progRes] = results;

      if (signonRes.status === 'fulfilled' && signonRes.value?.data) {
        (Array.isArray(signonRes.value.data) ? signonRes.value.data : []).forEach(r => combined.push(normalizeAuditEntry(r, 'signon')));
      }
      if (errorRes.status === 'fulfilled' && errorRes.value?.data) {
        (Array.isArray(errorRes.value.data) ? errorRes.value.data : []).forEach(r => combined.push(normalizeAuditEntry(r, 'error')));
      }
      if (failedRes.status === 'fulfilled' && failedRes.value?.data) {
        (Array.isArray(failedRes.value.data) ? failedRes.value.data : []).forEach(r => combined.push(normalizeAuditEntry(r, 'failed')));
      }
      if (filemanRes.status === 'fulfilled' && filemanRes.value?.data) {
        (Array.isArray(filemanRes.value.data) ? filemanRes.value.data : []).forEach(r => combined.push(normalizeAuditEntry(r, 'fileman')));
      }
      if (progRes.status === 'fulfilled' && progRes.value?.data) {
        (Array.isArray(progRes.value.data) ? progRes.value.data : []).forEach(r => combined.push(normalizeAuditEntry(r, 'programmer')));
      }

      combined.sort((a, b) => (b._sortTime || 0) - (a._sortTime || 0));
      setAllEvents(combined);
    } catch (err) {
      setError(err.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const SOURCE_MAP = { signon: 'Sign-On Log', fileman: 'Data Audit', error: 'Error Trap', failed: 'Failed Access', programmer: 'Programmer Mode' };
  const filtered = allEvents.filter(e => {
    if (actionFilter !== 'All' && e.action !== actionFilter) return false;
    if (userSearch && !e.user.toLowerCase().includes(userSearch.toLowerCase())) return false;
    if (sourceFilter !== 'all' && e.source !== SOURCE_MAP[sourceFilter]) return false;
    if (dateFrom && e._sortTime && e._sortTime < new Date(dateFrom).getTime()) return false;
    if (dateTo && e._sortTime && e._sortTime > new Date(dateTo + 'T23:59:59').getTime()) return false;
    return true;
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const handleExportCSV = () => {
    const header = 'Timestamp,Staff Member,Action,Source,Detail\n';
    const rows = filtered.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.source}","${(e.detail || '').replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Audit Log">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Audit Log">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-text">Audit Log</h1>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? 'Loading audit data from VistA...' : `${allEvents.length} events from ${new Set(allEvents.map(e => e.source)).size} VistA audit sources.`}
            </p>
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>
        </div>

        {/* Audit Source Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-4">
          {AUDIT_SOURCES.map(src => (
            <button key={src.id} onClick={() => { setSourceFilter(src.id); setPage(1); }}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                sourceFilter === src.id ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
              }`}>
              {src.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-border rounded-lg p-4 mb-4">
          <div className="grid grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Staff Member</label>
              <input type="text" value={userSearch} onChange={e => { setUserSearch(e.target.value); setPage(1); }}
                placeholder="Search by name..." className="w-full h-8 px-3 text-xs border border-border rounded-md focus:outline-none focus:border-steel" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Action Type</label>
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full h-8 px-2 text-xs border border-border rounded-md focus:outline-none focus:border-steel">
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full h-8 px-2 text-xs border border-border rounded-md focus:outline-none focus:border-steel" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="w-full h-8 px-2 text-xs border border-border rounded-md focus:outline-none focus:border-steel" />
            </div>
            <div className="col-span-2 flex items-end gap-2">
              <button onClick={() => { setActionFilter('All'); setUserSearch(''); setSourceFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="h-8 px-4 text-xs border border-border rounded-md hover:bg-surface-alt">Clear Filters</button>
              <button onClick={loadData}
                className="h-8 px-4 text-xs font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors">Refresh</button>
            </div>
          </div>
        </div>

        {loading ? <TableSkeleton rows={10} cols={5} /> : (
          <>
            <DataTable columns={columns} data={pageSlice} idField="id"
              selectedId={expandedId} onRowClick={(row) => setExpandedId(expandedId === row.id ? null : row.id)}
              rowClassName={(row) => row.action === 'Programmer Mode' ? '!bg-[#FDE8E8]' : (row.action === 'Failed Access' || row.action === 'Error' ? '!bg-[#FFF8E1]' : '')} />

            {expandedId && (() => {
              const event = allEvents.find(e => e.id === expandedId);
              if (!event) return null;
              return (
                <div className="bg-surface-alt border border-border rounded-lg p-4 mt-2 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-text">Event Detail</h3>
                    <button onClick={() => setExpandedId(null)} className="text-text-muted hover:text-text">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-text-muted">Source:</span> {event.source}</div>
                    <div><span className="text-text-muted">Action:</span> {event.action}</div>
                    <div><span className="text-text-muted">User:</span> {event.user}</div>
                  </div>
                  <div className="mt-3 p-3 bg-white rounded-md border border-border text-xs">
                    <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Full Detail</div>
                    <div className="text-text whitespace-pre-wrap">{event.detail}</div>
                  </div>
                  {event.raw && (
                    <details className="mt-2 text-[10px] text-text-muted">
                      <summary className="cursor-pointer hover:text-text">Raw VistA Data</summary>
                      <pre className="mt-1 p-2 bg-white rounded text-[10px] font-mono overflow-auto max-h-40">{JSON.stringify(event.raw, null, 2)}</pre>
                    </details>
                  )}
                </div>
              );
            })()}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
          </>
        )}
      </div>
    </AppShell>
  );
}
