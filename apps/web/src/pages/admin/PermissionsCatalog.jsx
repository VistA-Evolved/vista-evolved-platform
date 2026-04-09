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

// columns are built inside the component to access handlers

export default function PermissionsCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPerm, setSelectedPerm] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
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
          setAssignError(`Cannot assign ${keyToAssign}: user already holds ${conflict}. ORES and ORELSE are mutually exclusive.`);
          return;
        }
      } catch { /* proceed — backend will also validate */ }
    }
    setAssigning(true);
    try {
      await assignPermission(duz, { keyName: assignModal.vistaKey || assignModal.name });
      setAssignModal(null);
      loadData();
    } catch (err) {
      // Surface the real backend error (e.g. mutual-exclusion conflict,
      // missing user, VistA unreachable) instead of silently closing.
      setAssignError(err?.message || 'Failed to assign permission');
    } finally { setAssigning(false); }
  };

  const columns = [
    { key: 'displayName', label: 'Permission', bold: true, render: (val, row) => (
      <div>
        <div className="font-medium text-sm">{val}</div>
        <div className="text-[10px] font-mono text-text-muted">{row.name}</div>
      </div>
    )},
    { key: 'module', label: 'Category' },
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
          description: k.description || '',
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
    if (categoryFilter === 'Orphaned') return k.holderCount === 0;
    if (categoryFilter !== 'All' && k.module !== categoryFilter) return false;
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return k.name.toLowerCase().includes(s) || k.displayName.toLowerCase().includes(s) || k.module.toLowerCase().includes(s) || k.description.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Category counts for badges — build dynamic list from actual data
  const categoryCounts = {};
  allKeys.forEach(k => { categoryCounts[k.module] = (categoryCounts[k.module] || 0) + 1; });
  const orphanedCount = allKeys.filter(k => k.holderCount === 0).length;

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
        <div className={`p-6 ${selectedPerm ? 'w-[60%]' : 'w-full'} overflow-auto`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[28px] font-bold text-text">Permissions Catalog</h1>
              <p className="text-sm text-text-secondary mt-1">
                {loading ? 'Loading permissions from VistA...' : `${allKeys.length} permissions loaded from live VistA. Permissions are system-defined and cannot be created manually.`}
              </p>
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
          <div className="w-[40%] border-l border-border bg-surface-alt p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text">{selectedPerm.displayName}</h2>
              <button onClick={() => setSelectedPerm(null)} className="text-text-muted hover:text-text">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <DetailRow label="Category" value={selectedPerm.module} />
              <DetailRow label="Description" value={selectedPerm.description || 'No description available'} />
              <DetailRow label="Staff with This Permission" value={`${selectedPerm.holderCount} staff members`} />

              <div className="bg-white rounded-md p-3 border border-border">
                <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">System Reference (Admin Only)</div>
                <div className="text-sm font-mono text-text-secondary">{selectedPerm.vistaKey}</div>
              </div>

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
                    } catch { /* non-fatal, keep the stale value */ }
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
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-text">Staff with this permission</h3>
                <div className="text-xs text-text-secondary mt-0.5">{holdersModal.displayName || holdersModal.name}</div>
              </div>
              <button onClick={() => setHoldersModal(null)} className="text-text-muted hover:text-text">
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
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-text">Assign permission</h3>
                <div className="text-xs text-text-secondary mt-0.5">{assignModal.displayName || assignModal.name}</div>
              </div>
              <button onClick={() => setAssignModal(null)} className="text-text-muted hover:text-text">
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
                      <button key={s.duz} onClick={() => handleAssign(s.duz)} disabled={assigning}
                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-alt text-sm disabled:opacity-50">
                        <span className="text-text">{s.name}</span>
                        <span className="text-[11px] text-steel font-medium">Assign</span>
                      </button>
                    ))}
                  {staffList.length === 0 && <p className="text-sm text-text-muted text-center py-6">No staff members found.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
