import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { StatusBadge, KeyCountBadge } from '../../components/shared/StatusBadge';
import { SearchBar, Pagination, FilterChips, ConfirmDialog } from '../../components/shared/SharedComponents';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStaff, getStaffMember, getESignatureStatus, getSites, getUserPermissions, deactivateStaffMember, reactivateStaffMember, setESignature } from '../../services/adminService';
import { TableSkeleton, KpiCardSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * AD-01 / ADM-01: Staff Directory
 * @see ADMIN-WORKSPACE.md Page 1
 * @vista NEW PERSON #200 via ZVE USER LIST + DDR GETS ENTRY DATA
 *
 * Live data sources:
 *   GET /users          → { data: [{ ien, name }] }
 *   GET /esig-status    → { data: [{ id, name, duz, status, esigStatus, hasCode, sigBlockName }] }
 *   GET /divisions      → { data: [{ ien, name, stationNumber, status }] }
 *   GET /users/:duz     → { data: { id, ien, name, title, status, vistaGrounding: { ... } } }
 *   GET /users/:duz/keys → { data: [{ ien, name }] }
 */

const SIG_STYLES = {
  active:     { label: 'Ready',      cls: 'bg-[#E8F5E9] text-[#2E7D32]' },
  ready:      { label: 'Ready',      cls: 'bg-[#E8F5E9] text-[#2E7D32]' },
  incomplete: { label: 'Incomplete', cls: 'bg-[#FFF3E0] text-[#E6A817]' },
  none:       { label: 'Incomplete', cls: 'bg-[#FFF3E0] text-[#E6A817]' },
  unknown:    { label: 'Unknown',    cls: 'bg-[#F5F5F5] text-[#999]' },
  na:         { label: 'N/A',        cls: 'bg-[#F5F5F5] text-[#999]' },
};

function SigReadinessBadge({ value }) {
  const s = SIG_STYLES[value] || SIG_STYLES.unknown;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
}

function ProviderBadge({ isProvider }) {
  return isProvider
    ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#E8EEF5] text-[#2E5984] uppercase">Yes</span>
    : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#F5F5F5] text-[#999] uppercase">No</span>;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function LastSignInCell({ value }) {
  if (!value) return <span className="text-[#CC3333] font-semibold text-xs">Never</span>;
  const days = daysSince(value);
  const display = new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  let cls = 'text-text-secondary';
  if (days > 90) cls = 'text-[#CC3333] font-semibold';
  else if (days > 30) cls = 'text-[#E6A817] font-semibold';
  return (
    <div className={`text-xs ${cls}`}>
      <div>{display}</div>
      <div className="text-[10px] opacity-75">{time}</div>
    </div>
  );
}

const baseColumns = [
  { key: 'name', label: 'Name', bold: true },
  { key: 'id', label: 'Staff ID', render: (val) => <span className="font-mono text-[11px] text-text-secondary">{val}</span> },
  { key: 'department', label: 'Department' },
  { key: 'site', label: 'Site' },
  { key: 'status', label: 'Status', align: 'center', render: (val) => <StatusBadge status={val} /> },
  { key: 'esigStatus', label: 'E-Signature', align: 'center', render: (val) => <SigReadinessBadge value={val} /> },
  { key: 'permissionCount', label: 'Permissions', align: 'center', render: (val) => <KeyCountBadge count={val || 0} /> },
];

const STATUS_OPTIONS = ['All', 'Active', 'Inactive', 'Locked'];
const ESIG_OPTIONS = ['All', 'Ready', 'Incomplete'];

export default function StaffDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState(location.state?.filterRole || location.state?.assignRoleName || location.state?.assignKeyName || '');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('Active');
  const [siteFilter, setSiteFilter] = useState('All Sites');
  const [esigFilter, setEsigFilter] = useState('All');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [clearingEsig, setClearingEsig] = useState(false);

  // Live data state
  const [staffList, setStaffList] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail panel state (loaded on row click)
  const [detailData, setDetailData] = useState(null);
  const [detailKeys, setDetailKeys] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const columns = [
    ...baseColumns,
    {
      key: '_actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/admin/staff/${row.duz}/edit`)}
            className="text-steel hover:underline text-[11px] font-medium px-1">Edit</button>
          <button onClick={() => navigate(`/admin/permissions?user=${row.duz}`)}
            className="text-steel hover:underline text-[11px] font-medium px-1">Keys</button>
          <button onClick={() => navigate(`/admin/audit?user=${row.duz}`)}
            className="text-steel hover:underline text-[11px] font-medium px-1">Audit</button>
        </div>
      ),
    },
  ];

  const PAGE_SIZE = 25;

  // Fetch all staff + esig + sites in parallel
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, esigRes, sitesRes] = await Promise.all([
        getStaff(),
        getESignatureStatus(),
        getSites(),
      ]);

      const users = usersRes?.data || [];
      const esigList = esigRes?.data || [];
      const divisionList = sitesRes?.data || [];

      // Build lookup maps
      const esigMap = new Map(esigList.map(e => [e.id || e.duz, e]));
      const divMap = new Map(divisionList.map(d => [d.ien, d]));

      // Merge users with esig data
      const merged = users.map(u => {
        const esig = esigMap.get(u.ien) || {};
        return {
          id: `S-${u.ien}`,
          duz: u.ien,
          name: (u.name || esig.name || '').toUpperCase(),
          department: '', // not available in list view — shows on detail
          site: '', // would need division assignment
          status: esig.status || 'active',
          esigStatus: esig.hasCode ? 'active' : 'incomplete',
          hasEsig: esig.hasCode || false,
          sigBlockName: esig.sigBlockName || '',
          permissionCount: null, // loaded per-user on demand
        };
      });

      setStaffList(merged);
      setSites(divisionList.map(d => ({ id: d.ien, name: d.name, code: d.stationNumber })));
    } catch (err) {
      setError(err.message || 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load detail on row click
  const handleRowClick = async (row) => {
    setSelectedStaff(row);
    setDetailData(null);
    setDetailKeys([]);
    setDetailLoading(true);
    try {
      const [userRes, keysRes] = await Promise.all([
        getStaffMember(row.duz),
        getUserPermissions(row.duz),
      ]);
      const vg = userRes?.data?.vistaGrounding || {};
      const esig = vg.electronicSignature || {};
      setDetailData({
        ...row,
        title: userRes?.data?.title || vg.sigBlockTitle || '',
        department: vg.serviceSection || '',
        phone: vg.officePhone || '',
        email: vg.email || '',
        npi: vg.npi || '',
        dea: vg.dea || '',
        providerType: vg.providerType || '',
        isProvider: Boolean(vg.npi || vg.providerType || vg.authMeds),
        esigStatus: esig.hasCode ? 'active' : 'incomplete',
        sigBlockName: esig.sigBlockName || '',
        ssn: vg.ssn ? `***-**-${vg.ssn.slice(-4)}` : '',
        initials: vg.initials || '',
      });
      setDetailKeys(keysRes?.data || []);
    } catch {
      // Leave detail partially loaded
    } finally {
      setDetailLoading(false);
    }
  };

  // Filters (client-side since list endpoint only returns ien+name)
  const filtered = staffList.filter(u => {
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!u.name.toLowerCase().includes(s) && !u.id.toLowerCase().includes(s)) return false;
    }
    if (statusFilter !== 'All' && u.status !== statusFilter.toLowerCase()) return false;
    if (esigFilter === 'Ready' && !u.hasEsig) return false;
    if (esigFilter === 'Incomplete' && u.hasEsig) return false;
    return true;
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // KPI cards from full staff list
  const totalStaff = staffList.length;
  const activeCount = staffList.filter(u => u.status === 'active').length;
  const esigReadyCount = staffList.filter(u => u.hasEsig).length;
  const esigIncompleteCount = staffList.filter(u => !u.hasEsig).length;

  const activeFilters = [
    ...(statusFilter !== 'All' ? [{ key: 'status', label: `Status: ${statusFilter}` }] : []),
    ...(siteFilter !== 'All Sites' ? [{ key: 'site', label: `Site: ${siteFilter}` }] : []),
    ...(esigFilter !== 'All' ? [{ key: 'esig', label: `E-Signature: ${esigFilter}` }] : []),
  ];

  const removeFilter = (key) => {
    if (key === 'status') setStatusFilter('All');
    if (key === 'site') setSiteFilter('All Sites');
    if (key === 'esig') setEsigFilter('All');
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateStaffMember(deactivateTarget.duz);
      setDeactivateTarget(null);
      setSelectedStaff(null);
      loadData();
    } catch {
      setDeactivateTarget(null);
    }
  };

  const handleReactivate = async (duz) => {
    try {
      await reactivateStaffMember(duz);
      setSelectedStaff(null);
      loadData();
    } catch { /* handled by API layer */ }
  };

  const handleClearEsig = async (duz) => {
    if (!window.confirm('Clear this staff member\'s electronic signature? They will need to set a new one on next sign-in.')) return;
    setClearingEsig(true);
    try {
      await setESignature(duz, { action: 'clear' });
      if (detailData) setDetailData(prev => ({ ...prev, esigStatus: 'incomplete', sigBlockName: '' }));
      loadData();
    } catch { /* handled by API layer */ }
    finally { setClearingEsig(false); }
  };

  const siteOptions = ['All Sites', ...sites.map(s => `${s.name} (${s.code})`)];

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Staff Directory">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Staff Directory">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${selectedStaff ? 'w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[28px] font-bold text-[#222]">Staff Directory</h1>
                <p className="text-[15px] text-[#666] mt-1">
                  Manage staff members, roles, permissions, and provider configuration.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({totalStaff} staff from live VistA)</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const header = 'Name,DUZ,Status,Service,Division\n';
                    const csv = (staffList || []).map(r => `"${r.name}","${r.duz}","${r.status}","${r.service || ''}","${r.division || ''}"`).join('\n');
                    const blob = new Blob([header + csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export
                </button>
                <button
                  onClick={() => navigate('/admin/staff/new')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A2E] text-white text-[13px] font-medium rounded-md hover:bg-[#2E5984] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Add Staff Member
                </button>
              </div>
            </div>

            {loading ? <KpiCardSkeleton /> : (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard label="Total Staff" value={totalStaff} icon="badge" />
                <MetricCard label="Active" value={activeCount} icon="check_circle" color="text-[#2E7D32]" />
                <MetricCard label="E-Signature Ready" value={esigReadyCount} icon="draw" color="text-[#2E5984]" />
                <MetricCard label="E-Signature Incomplete" value={esigIncompleteCount} icon="warning" color="text-[#E6A817]" />
              </div>
            )}

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search by name or ID..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilterSelect label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              <FilterSelect label="Site" value={siteFilter} options={siteOptions} onChange={(v) => { setSiteFilter(v); setPage(1); }} />
              <FilterSelect label="E-Signature" value={esigFilter} options={ESIG_OPTIONS} onChange={(v) => { setEsigFilter(v); setPage(1); }} />
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-4">
                <FilterChips filters={activeFilters} onRemove={removeFilter} />
              </div>
            )}

            {loading ? <TableSkeleton rows={10} cols={7} /> : (
              <DataTable
                columns={columns}
                data={pageSlice}
                idField="id"
                selectedId={selectedStaff?.id}
                onRowClick={handleRowClick}
              />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
          </div>
        </div>

        {selectedStaff && (
          <div className="w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{selectedStaff.name}</h2>
              <button onClick={() => { setSelectedStaff(null); setDetailData(null); }} className="text-[#999] hover:text-[#222]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {detailLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-[#E2E4E8] rounded" />)}
              </div>
            ) : detailData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Staff ID" value={detailData.id} mono />
                  <DetailField label="Title" value={detailData.title || '—'} />
                  <DetailField label="Department" value={detailData.department || '—'} />
                  <DetailField label="Phone" value={detailData.phone || '—'} />
                  <DetailField label="Email" value={detailData.email || '—'} />
                  <DetailField label="Status" value={<StatusBadge status={detailData.status} />} />
                  {detailData.ssn && <DetailField label="SSN (last 4)" value={detailData.ssn} mono />}
                  <DetailField label="Initials" value={detailData.initials || '—'} />
                </div>

                {detailData.isProvider && (
                  <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
                    <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">Provider Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="NPI" value={detailData.npi || '—'} mono />
                      <DetailField label="DEA#" value={detailData.dea || '—'} mono />
                      <DetailField label="Provider Type" value={detailData.providerType || '—'} />
                      <DetailField label="E-Signature" value={<SigReadinessBadge value={detailData.esigStatus} />} />
                    </div>
                  </div>
                )}

                {detailKeys.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
                    <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">
                      Permissions ({detailKeys.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detailKeys.slice(0, 8).map(k => (
                        <span key={k.ien} className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#E8EEF5] text-[#2E5984]">{k.name}</span>
                      ))}
                      {detailKeys.length > 8 && (
                        <span className="px-2 py-0.5 text-[10px] rounded bg-[#F5F5F5] text-[#999]">
                          +{detailKeys.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
                  <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">E-Signature Block</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Signature Block Name" value={detailData.sigBlockName || '—'} />
                    <DetailField label="Status" value={<SigReadinessBadge value={detailData.esigStatus} />} />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E4E8] space-y-2">
                  <button onClick={() => navigate(`/admin/staff/${detailData.duz}/edit`)}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">edit</span>
                    Edit Staff Member
                  </button>
                  <button onClick={() => navigate(`/admin/permissions?user=${detailData.duz}`)}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">key</span>
                    Assign Permissions
                  </button>
                  <button onClick={() => navigate(`/admin/roles`, { state: { assignToDuz: detailData.duz, assignToName: detailData.name } })}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">assignment_ind</span>
                    Assign Role
                  </button>
                  <button disabled={clearingEsig} onClick={() => handleClearEsig(detailData.duz)}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">backspace</span>
                    {clearingEsig ? 'Clearing E-Signature...' : 'Clear E-Signature'}
                  </button>
                  <button onClick={() => navigate(`/admin/audit?user=${detailData.duz}`)}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">history</span>
                    View Audit Trail
                  </button>
                  {detailData.status === 'active' && (
                    <button onClick={() => setDeactivateTarget(detailData)}
                      className="w-full text-left px-3 py-2 text-[13px] text-[#CC3333] hover:bg-[#FDE8E8] rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[16px] mr-2 align-middle">block</span>
                      Deactivate
                    </button>
                  )}
                  {detailData.status === 'inactive' && (
                    <button onClick={() => handleReactivate(detailData.duz)}
                      className="w-full text-left px-3 py-2 text-[13px] text-[#2E7D32] hover:bg-[#E8F5E9] rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[16px] mr-2 align-middle">check_circle</span>
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#999]">Click a staff member to view details.</p>
            )}
          </div>
        )}
      </div>

      {deactivateTarget && (
        <ConfirmDialog
          title="Deactivate Staff Member"
          message={`Deactivating ${deactivateTarget.name} will immediately prevent them from signing in. Their records will be preserved for audit purposes.`}
          confirmLabel="Deactivate"
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
          destructive
        />
      )}
    </AppShell>
  );
}

function MetricCard({ label, value, icon, color = 'text-[#222]' }) {
  return (
    <div className="bg-white border border-[#E2E4E8] rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-[#F5F8FB] ${color}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#222]">{value}</div>
        <div className="text-[11px] text-[#666]">{label}</div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 pl-3 pr-8 border border-[#E2E4E8] rounded-md text-[11px] text-[#222] bg-white focus:outline-none focus:border-[#2E5984]"
      aria-label={label}
    >
      {options.map(opt => <option key={opt} value={opt}>{label}: {opt}</option>)}
    </select>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider">{label}</div>
      <div className={`text-[13px] text-[#222] mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
