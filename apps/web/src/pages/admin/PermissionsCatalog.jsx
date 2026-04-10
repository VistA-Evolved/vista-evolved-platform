import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination } from '../../components/shared/SharedComponents';
import { getPermissions, getPermissionHolders, assignPermission, getStaff, getUserPermissions } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Permissions Catalog — live SECURITY KEY #19.1 inventory.
 *
 * Live: GET /key-inventory → each row carries displayName, packageName,
 * description, holderCount from the server-side enrichment layer (live
 * PACKAGE #9.4 prefix lookup + VistA word-processing description text).
 */

const TASK_KEY_MAP = {
  'write orders': ['ORES'],
  'enter orders': ['ORES'],
  'clinical orders': ['ORES'],
  'verbal orders': ['ORELSE'],
  'cosign orders': ['ORCL-SIGN-NOTES'],
  'sign notes': ['ORCL-SIGN-NOTES'],
  'chart access': ['OR CPRS GUI CHART'],
  'open patient chart': ['OR CPRS GUI CHART'],
  'patient chart': ['OR CPRS GUI CHART'],
  'dispense medications': ['PSDISPENSE'],
  'pharmacy dispense': ['PSDISPENSE'],
  'controlled substances': ['PSORPH-CS'],
  'cancel orders': ['ORCANCEL'],
  'verify orders': ['ORES'],
  'radiology orders': ['RA TECHNOLOGIST'],
  'lab results': ['LRLAB'],
  'diet orders': ['FH ENTER/EDIT DATA'],
  'schedule appointments': ['SD SUPERVISOR'],
  'admit patients': ['DG SUPERVISOR'],
  'manage users': ['XUMGR'],
};

// columns are built inside the component to access handlers

export default function PermissionsCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPerm, setSelectedPerm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState('standard'); // standard: ~150 important keys, advanced: all 689
  const [allKeys, setAllKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Assign modal state
  const [assignModal, setAssignModal] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Multi-select state for batch assign
  const [selectedStaff, setSelectedStaff] = useState(new Set());

  // Holders modal state
  const [holdersModal, setHoldersModal] = useState(null);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [holdersData, setHoldersData] = useState([]);

  const PAGE_SIZE = 25;

  const handleViewStaff = async (row) => {
    setHoldersModal(row);
    setHoldersLoading(true);
    try {
      const res = await getPermissionHolders(row.vistaKey || row.name);
      setHoldersData(res?.data || []);
    } catch { setHoldersData([]); }
    finally { setHoldersLoading(false); }
  };

  const handleOpenAssign = async (row) => {
    setAssignModal(row);
    setStaffSearch('');
    setAssignError('');
    setSelectedStaff(new Set());
    if (staffList.length === 0) {
      setStaffLoading(true);
      try {
        const res = await getStaff();
        setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
      } catch { setStaffList([]); }
      finally { setStaffLoading(false); }
    }
  };

  const handleAssign = async (duz) => {
    if (!assignModal) return;
    setAssignError('');
    const keyToAssign = (assignModal.vistaKey || assignModal.name || '').toUpperCase();
    // ORES/ORELSE mutual exclusion check
    if (keyToAssign === 'ORES' || keyToAssign === 'ORELSE') {
      try {
        const conflict = keyToAssign === 'ORES' ? 'ORELSE' : 'ORES';
        const res = await getUserPermissions(duz);
        const existing = (res?.data || []).map(k => (k.name || '').toUpperCase());
        if (existing.includes(conflict)) {
          const keyLabel = keyToAssign === 'ORES' ? 'Write clinical orders' : 'Enter verbal orders';
          const conflictLabel = conflict === 'ORES' ? 'Write clinical orders' : 'Enter verbal orders';
          setAssignError(`Cannot assign "${keyLabel}": this staff member already holds "${conflictLabel}". These permissions are mutually exclusive.`);
          return;
        }
      } catch { /* proceed — backend will also validate */ }
    }
    setAssigning(true);
    try {
      await assignPermission(duz, { keyName: assignModal.vistaKey || assignModal.name });
      setAssignModal(null);
      setSelectedStaff(new Set());
      loadData();
    } catch (err) {
      // Surface the real backend error (e.g. mutual-exclusion conflict,
      // missing user, VistA unreachable) instead of silently closing.
      setAssignError(err?.message || 'Failed to assign permission');
    } finally { setAssigning(false); }
  };

  const handleBatchAssign = async () => {
    if (!assignModal || selectedStaff.size === 0) return;
    setAssigning(true);
    setAssignError('');
    const errors = [];
    for (const duz of selectedStaff) {
      try {
        await assignPermission(duz, { keyName: assignModal.vistaKey || assignModal.name });
      } catch (err) {
        const staff = staffList.find(s => s.duz === duz);
        errors.push(`${staff?.name || duz}: ${err?.message || 'failed'}`);
      }
    }
    setAssigning(false);
    if (errors.length > 0) {
      setAssignError(`Failed for ${errors.length} staff: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}`);
    } else {
      setAssignModal(null);
      setSelectedStaff(new Set());
      loadData();
    }
  };

  const columns = [
    { key: 'displayName', label: 'Permission', bold: true, render: (val, row) => (
      <div>
        <div className="font-medium text-sm">{val}</div>
      </div>
    )},
    { key: 'department', label: 'Department' },
    { key: 'description', label: 'Description', render: (val) => <span className="text-xs text-text-secondary line-clamp-1">{val || '—'}</span> },
    {
      key: 'holderCount', label: 'Staff', align: 'center',
      render: (val) => <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-[#E8EEF5] text-steel text-[11px] font-bold font-mono">{val}</span>,
    },
    {
      key: '_actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {row.holderCount > 0 && (
            <button onClick={() => handleViewStaff(row)} className="text-steel hover:underline text-xs font-medium">View Staff</button>
          )}
          <button onClick={() => handleOpenAssign(row)} className="text-steel hover:underline text-xs font-medium">Assign</button>
        </div>
      ),
    },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPermissions();
      const keys = (res?.data || []).map(k => {
        // Holder count comes from the ^XUSEC scan inside the M routine
        // (canonical source). The holders array may be empty in the list
        // response; the per-key detail endpoint fills it in on click.
        const holderCount = k.holderCount || 0;
        return {
          id: k.vistaGrounding?.file19_1Ien || k.keyName,
          name: k.keyName,
          // displayName and packageName are always populated by the server
          // humanizer (enrichKey) — no client-side fallback needed.
          displayName: k.displayName || k.keyName,
          vistaKey: k.vistaKey || k.keyName,
          module: k.packageName || 'General',
          department: k.department || k.packageName || 'General',
          description: k.description || '',
          visibility: k.visibility || 'advanced',
          holderCount,
          holders: k.holders || [],
        };
      });
      setAllKeys(keys);
    } catch (err) {
      setError(err.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Deep-link support: if the URL has ?assign=KEYNAME or ?view=KEYNAME,
  // auto-open the matching modal once the catalog has loaded. This powers
  // the cross-page "Assign to staff" / "View staff with this role" buttons
  // on RoleTemplates so the admin never hits a blank destination page.
  useEffect(() => {
    if (allKeys.length === 0) return;
    const assignKey = searchParams.get('assign');
    const viewKey = searchParams.get('view');
    const target = assignKey || viewKey;
    if (!target) return;
    const row = allKeys.find(k => k.name === target || k.vistaKey === target);
    if (!row) return;
    setSelectedPerm(row);
    if (assignKey) {
      handleOpenAssign(row);
    } else if (viewKey) {
      handleViewStaff(row);
    }
    // Clear the query so the deep-link only fires once.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys]);

  const filtered = allKeys.filter(k => {
    // Standard/Advanced filter
    if (viewMode === 'standard' && k.visibility === 'advanced') return false;
    if (categoryFilter === 'Orphaned') return k.holderCount === 0;
    if (categoryFilter !== 'All' && k.department !== categoryFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return k.name.toLowerCase().includes(s) || k.displayName.toLowerCase().includes(s) || k.department.toLowerCase().includes(s) || k.description.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Category counts for badges — build dynamic list from actual data
  const categoryCounts = {};
  const filteredByMode = viewMode === 'standard' ? allKeys.filter(k => k.visibility !== 'advanced') : allKeys;
  filteredByMode.forEach(k => { categoryCounts[k.department] = (categoryCounts[k.department] || 0) + 1; });
  const orphanedCount = filteredByMode.filter(k => k.holderCount === 0).length;

  // Build categories dynamically from whatever package labels the live
  // /key-inventory response returned. No hardcoded fallback — if nothing
  // loaded yet, the only filter option is "All".
  const dynamicModules = Object.keys(categoryCounts).sort();
  const CATEGORIES = dynamicModules.length > 0
    ? ['All', ...dynamicModules, 'Orphaned']
    : ['All'];

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Permissions Catalog">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Permissions Catalog">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 ${selectedPerm ? 'w-full xl:w-[60%]' : 'w-full'} overflow-auto`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-text">Permissions Catalog</h1>
              <p className="text-sm text-text-secondary mt-1">
                {loading ? 'Loading permissions...' : `${filtered.length} of ${allKeys.length} permissions shown. Permissions are system-defined.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setViewMode('standard'); setPage(1); setCategoryFilter('All'); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'standard' ? 'bg-[#1A1A2E] text-white' : 'border border-[#E2E4E8] text-[#666] hover:bg-[#F5F8FB]'}`}>
                Standard
              </button>
              <button onClick={() => { setViewMode('advanced'); setPage(1); setCategoryFilter('All'); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'advanced' ? 'bg-[#1A1A2E] text-white' : 'border border-[#E2E4E8] text-[#666] hover:bg-[#F5F8FB]'}`}>
                Advanced ({allKeys.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <SearchBar placeholder="Search permissions by name, module, or description..." onSearch={(v) => { setSearchText(v); setPage(1); }} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => { setCategoryFilter(cat); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    categoryFilter === cat ? 'bg-navy text-white' : 'bg-surface-alt text-text-secondary hover:bg-[#E8EEF5]'
                  }`}>
                  {cat}
                  {cat === 'Orphaned' && orphanedCount > 0 ? ` (${orphanedCount})` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Task search suggestions */}
          {(() => {
            if (!searchText) return null;
            const s = searchText.toLowerCase();
            const matchedKeys = new Set();
            Object.entries(TASK_KEY_MAP).forEach(([task, keys]) => {
              if (task.includes(s)) keys.forEach(k => matchedKeys.add(k));
            });
            const taskMatches = [...matchedKeys].map(k => allKeys.find(ak => ak.name === k || ak.vistaKey === k)).filter(Boolean);
            if (taskMatches.length === 0) return null;
            return (
              <div className="mb-4 p-3 bg-[#E8F5E9] rounded-lg">
                <div className="text-[11px] font-semibold text-[#2D6A4F] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                  Suggested keys for this task
                </div>
                <div className="flex flex-wrap gap-2">
                  {taskMatches.map(match => (
                    <button key={match.id} onClick={() => setSelectedPerm(match)}
                      className="px-3 py-1.5 text-xs font-medium bg-white rounded-md border border-[#C8E6C9] hover:bg-[#F1F8F2] text-[#2D6A4F]">
                      {match.displayName}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {loading ? <TableSkeleton rows={10} cols={5} /> : (
            <>
              <DataTable
                columns={columns}
                data={pageSlice}
                idField="id"
                selectedId={selectedPerm?.id}
                onRowClick={setSelectedPerm}
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
            </>
          )}
        </div>

        {selectedPerm && (
          <div className="hidden xl:block w-[40%] border-l border-border bg-surface-alt p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text">{selectedPerm.displayName}</h2>
              <button onClick={() => setSelectedPerm(null)} className="text-text-muted hover:text-text" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <DetailRow label="Department" value={selectedPerm.department} />
              <DetailRow label="Description" value={selectedPerm.description || 'No description available'} />
              <DetailRow label="Staff with This Permission" value={`${selectedPerm.holderCount} staff members`} />

              <details className="bg-white rounded-md p-3 border border-border">
                <summary className="text-[10px] font-medium text-text-muted uppercase tracking-wider cursor-pointer">System Reference</summary>
                <div className="text-sm font-mono text-text-secondary mt-2">{selectedPerm.vistaKey}</div>
              </details>

              {selectedPerm._holderError && (
                <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-md text-xs text-[#CC3333] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {selectedPerm._holderError}
                </div>
              )}
              {selectedPerm.holders?.length > 0 && (
                <div className="bg-white rounded-md p-3 border border-border">
                  <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                    Staff Holding This Permission ({selectedPerm.holderCount})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {selectedPerm.holders.slice(0, 10).map((h, i) => {
                      const name = typeof h === 'string' ? h : (h.name || '');
                      if (!name) return null;
                      return (
                        <div key={h.duz || i} className="text-[11px] text-text-secondary">{name}</div>
                      );
                    })}
                    {selectedPerm.holderCount > 10 && (
                      <button
                        type="button"
                        onClick={() => handleViewStaff(selectedPerm)}
                        className="text-[10px] text-steel cursor-pointer hover:underline block mt-1">
                        View all {selectedPerm.holderCount} staff members…
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-2">
                <button
                  onClick={() => handleOpenAssign(selectedPerm)}
                  className="w-full text-left px-3 py-2 text-sm text-steel hover:bg-white rounded-md transition-colors">
                  <span className="material-symbols-outlined text-[16px] mr-2 align-middle">person_add</span>
                  Assign to a staff member
                </button>
                <button
                  onClick={async () => {
                    // Refresh the holders list from the server. Uses the
                    // authoritative ^XUSEC-backed /key-holders endpoint.
                    try {
                      const res = await getPermissionHolders(selectedPerm.vistaKey || selectedPerm.name);
                      const holders = res?.holders || res?.data || [];
                      setSelectedPerm(prev => ({ ...prev, holders, holderCount: holders.length }));
                    } catch (err) {
                      setSelectedPerm(prev => ({ ...prev, _holderError: err?.message || 'Failed to load holders' }));
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-steel hover:bg-white rounded-md transition-colors">
                  <span className="material-symbols-outlined text-[16px] mr-2 align-middle">group</span>
                  Load full holder list
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Staff Holders Modal */}
      {holdersModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setHoldersModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Staff with this permission" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-text">Staff with this permission</h3>
                <div className="text-xs text-text-secondary mt-0.5">{holdersModal.displayName || holdersModal.name}</div>
              </div>
              <button onClick={() => setHoldersModal(null)} className="text-text-muted hover:text-text" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {holdersLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 animate-pulse bg-[#E2E4E8] rounded" />)}</div>
              ) : holdersData.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">No staff members hold this permission.</p>
              ) : (
                <div className="space-y-1">
                  {holdersData.map((h, i) => {
                    const name = typeof h === 'string' ? h : (h.name || '');
                    if (!name) return null;
                    const duz = typeof h === 'object' ? h.duz : null;
                    return (
                      <div key={duz || i} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-alt text-sm">
                        <span className="text-text">{name}</span>
                        {duz && (
                          <button onClick={() => { setHoldersModal(null); navigate(`/admin/staff/${duz}/edit`); }}
                            className="text-[11px] text-steel hover:underline">View</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Permission Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Assign permission" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-text">Assign permission</h3>
                <div className="text-xs text-text-secondary mt-0.5">{assignModal.displayName || assignModal.name}</div>
              </div>
              <button onClick={() => setAssignModal(null)} className="text-text-muted hover:text-text" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-5 pt-3">
              <input type="text" value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff by name..."
                className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
              {assignError && (
                <div className="mt-2 p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-md text-[11px] text-[#CC3333] flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0">error</span>
                  <span>{assignError}</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-5">
              {staffLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 animate-pulse bg-[#E2E4E8] rounded" />)}</div>
              ) : (
                <div className="space-y-1">
                  {staffList
                    .filter(s => !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()))
                    .slice(0, 50)
                    .map(s => (
                      <label key={s.duz}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-alt text-sm cursor-pointer ${selectedStaff.has(s.duz) ? 'bg-[#E8F5E9]' : ''}`}>
                        <input type="checkbox" checked={selectedStaff.has(s.duz)}
                          onChange={() => {
                            setSelectedStaff(prev => {
                              const next = new Set(prev);
                              next.has(s.duz) ? next.delete(s.duz) : next.add(s.duz);
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 accent-[#1B7D3A]" />
                        <span className="text-text flex-1">{s.name}</span>
                        <span className="text-[10px] text-[#999]">DUZ {s.duz}</span>
                      </label>
                    ))}
                  {staffList.length === 0 && <p className="text-sm text-text-muted text-center py-6">No staff members found.</p>}
                </div>
              )}
            </div>
          </div>
          {selectedStaff.size > 0 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-[#666]">{selectedStaff.size} staff selected</span>
              <button onClick={handleBatchAssign} disabled={assigning}
                className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                {assigning ? 'Assigning…' : `Assign to ${selectedStaff.size} Selected`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Terminal Reference */}
      <details className="mx-6 mt-4 mb-2">
        <summary className="text-[10px] text-[#BBB] cursor-pointer hover:text-[#888]">📖 Terminal Reference</summary>
        <div className="mt-2 p-3 bg-[#FAFAFA] rounded-lg text-[11px] text-[#888] leading-relaxed space-y-1">
          <p>This page replaces: <strong>EVE → Menu Management → Key Management</strong> and the key-related portions of <strong>User Management → Edit User → Keys tab</strong>.</p>
          <p className="font-mono text-[10px] text-[#AAA]">Key data is sourced from SECURITY KEY file (#19.1). Holder counts come from ^XUSEC global cross-references.</p>
          <p>Assigning a key here is equivalent to: <span className="font-mono text-[10px] text-[#AAA]">D ALLOCATE^XUSKEYP</span></p>
        </div>
      </details>
    </AppShell>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  );
}
