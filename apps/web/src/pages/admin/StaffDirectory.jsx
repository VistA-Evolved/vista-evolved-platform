import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { StatusBadge, KeyCountBadge } from '../../components/shared/StatusBadge';
import { SearchBar, Pagination, FilterChips, ConfirmDialog } from '../../components/shared/SharedComponents';
import { useNavigate } from 'react-router-dom';
import { getStaff, getStaffMember, getESignatureStatus, getUserPermissions, deactivateStaffMember, reactivateStaffMember, setESignature, assignPermission, getPermissions, unlockUser } from '../../services/adminService';
import { TableSkeleton, KpiCardSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';
import { humanizeKeyName } from '../../utils/transforms';
import { KEY_TRANSLATIONS } from '../../utils/vocabulary';

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

function deriveTitleFromKeys(keys) {
  if (!keys || keys.length === 0) return '';
  const keySet = new Set(keys.map(k => (k || '').toUpperCase()));
  if (keySet.has('XUMGR')) return 'System Administrator';
  if (keySet.has('ORES') && keySet.has('PROVIDER')) return 'Provider';
  if (keySet.has('ORELSE') && keySet.has('PROVIDER')) return 'Nurse';
  if (keySet.has('PSJ PHARMACIST') || keySet.has('PSORPH')) return 'Pharmacist';
  if (keySet.has('LRLAB') || keySet.has('LRVERIFY')) return 'Lab Technologist';
  if (keySet.has('RA ALLOC')) return 'Radiology Technologist';
  if (keySet.has('SDMGR') || keySet.has('SD SUPERVISOR')) return 'Scheduling';
  if (keySet.has('DG REGISTER')) return 'Registration';
  if (keySet.has('PROVIDER')) return 'Clinical Staff';
  return '';
}

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

const baseColumns = [
  { key: 'name', label: 'Name', bold: true, render: (val, row) => row.isDuplicate ? <span>{val} <span className="text-[10px] text-text-secondary font-mono">({row.id})</span></span> : val },
  { key: 'id', label: 'Staff ID', render: (val) => <span className="font-mono text-[11px] text-text-secondary">{val}</span> },
  { key: 'title', label: 'Title' },
  { key: 'department', label: 'Department' },
  { key: 'site', label: 'Site' },
  { key: 'status', label: 'Status', align: 'center', render: (val) => <StatusBadge status={val} /> },
  { key: 'esigStatus', label: 'E-Signature', align: 'center', render: (val) => <SigReadinessBadge value={val} /> },
  { key: 'permissionCount', label: 'Permissions', align: 'center', render: (val) => <KeyCountBadge count={val || 0} /> },
];

const STATUS_OPTIONS = ['All', 'Active', 'Inactive', 'Terminated'];
const ESIG_OPTIONS = ['All', 'Ready', 'Incomplete'];

export default function StaffDirectory() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('Active');
  const [esigFilter, setEsigFilter] = useState('All');
  const [hideSystemAccounts, setHideSystemAccounts] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [clearEsigTarget, setClearEsigTarget] = useState(null);
  const [clearingEsig, setClearingEsig] = useState(false);

  // Live data state
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail panel state (loaded on row click)
  const [detailData, setDetailData] = useState(null);
  const [detailKeys, setDetailKeys] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Assign permissions modal state
  const [showAssignPermsModal, setShowAssignPermsModal] = useState(false);
  const [allPermissions, setAllPermissions] = useState([]);
  const [permSearchText, setPermSearchText] = useState('');
  const [assigningPerm, setAssigningPerm] = useState(false);

  const columns = [
    ...baseColumns,
    {
      key: '_actions', label: '', sortable: false,
      render: (_, row) => <ActionsMenu row={row} navigate={navigate} />,
    },
  ];

  const PAGE_SIZE = 25;

  // Fetch all staff + esig + sites in parallel
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, esigRes] = await Promise.all([
        getStaff(),
        getESignatureStatus(),
      ]);

      const users = usersRes?.data || [];
      const esigList = esigRes?.data || [];
      const esigMap = new Map(esigList.map(e => [e.id || e.duz, e]));

      // Merge users with esig data. The ZVE USER LIST row already carries
      // service (department) and keyCount — use them directly instead of
      // leaving the columns blank.
      const merged = users.map(u => {
        const esig = esigMap.get(u.ien) || {};
        const rawStatus = (u.status || esig.status || 'active').toLowerCase();
        return {
          id: `S-${u.ien}`,
          duz: u.ien,
          name: u.name || esig.name || '',
          title: u.title || '',
          department: u.service || '',
          site: u.division || '',
          status: rawStatus,
          esigStatus: esig.hasCode ? 'active' : 'incomplete',
          hasEsig: esig.hasCode || false,
          sigBlockName: esig.sigBlockName || '',
          permissionCount: u.keyCount || 0,
          lastLogin: u.lastLogin || '',
        };
      });

      // Disambiguate duplicate names by appending Staff ID suffix
      const nameCounts = {};
      for (const u of merged) nameCounts[u.name] = (nameCounts[u.name] || 0) + 1;
      for (const u of merged) {
        u.isDuplicate = nameCounts[u.name] > 1;
        u.displayName = u.isDuplicate ? `${u.name} (${u.id})` : u.name;
      }

      setStaffList(merged);
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
      const keys = (keysRes?.data || []).map(k => k.name);
      const derivedTitle = deriveTitleFromKeys(keys);
      setDetailData({
        ...row,
        title: userRes?.data?.title || vg.sigBlockTitle || derivedTitle,
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
    } catch (err) {
      setDetailData(prev => prev || { ...row, _loadError: err.message || 'Failed to load details' });
    } finally {
      setDetailLoading(false);
    }
  };

  // Filters (client-side since list endpoint only returns ien+name)
  const SYSTEM_ACCOUNT_PATTERNS = /^(POSTMASTER|TASKMAN|HL7|RPC BROKER|PATCH|AUTOP|XOBV|XWB|APPLICATION|PROXY|APITEST)/i;
  const filtered = staffList.filter(u => {
    if (hideSystemAccounts && SYSTEM_ACCOUNT_PATTERNS.test(u.name)) return false;
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
  const lockedCount = staffList.filter(u => u.status === 'locked').length;

  const activeFilters = [
    ...(statusFilter !== 'All' ? [{ key: 'status', label: `Status: ${statusFilter}` }] : []),
    ...(esigFilter !== 'All' ? [{ key: 'esig', label: `E-Signature: ${esigFilter}` }] : []),
  ];

  const removeFilter = (key) => {
    if (key === 'status') setStatusFilter('All');
    if (key === 'esig') setEsigFilter('All');
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateStaffMember(deactivateTarget.duz);
      setDeactivateTarget(null);
      setSelectedStaff(null);
      loadData();
    } catch (err) {
      setError(`Failed to deactivate: ${err.message}`);
      setDeactivateTarget(null);
    }
  };

  const handleReactivate = async (duz) => {
    try {
      await reactivateStaffMember(duz);
      setSelectedStaff(null);
      loadData();
    } catch (err) { setError(`Failed to reactivate: ${err.message}`); }
  };

  const handleClearEsig = async (duz) => {
    setClearEsigTarget(duz);
  };

  const confirmClearEsig = async () => {
    if (!clearEsigTarget) return;
    setClearingEsig(true);
    try {
      await setESignature(clearEsigTarget, { action: 'clear' });
      if (detailData) setDetailData(prev => ({ ...prev, esigStatus: 'incomplete', sigBlockName: '' }));
      loadData();
    } catch (err) { setError(err.message || 'Failed to clear e-signature'); }
    finally { setClearingEsig(false); setClearEsigTarget(null); }
  };

  const handleOpenAssignPerms = async () => {
    setShowAssignPermsModal(true);
    setPermSearchText('');
    if (allPermissions.length === 0) {
      try {
        const res = await getPermissions();
        // Preserve the server-side enrichment (displayName, packageName) so
        // the modal can show a human title, a package badge, and a real
        // sentence description without having to humanize client-side.
        setAllPermissions((res?.data || []).map(k => ({
          name: k.keyName,
          displayName: k.displayName || k.descriptiveName || '',
          packageName: k.packageName || '',
          description: k.description || '',
        })));
      } catch (err) { setAllPermissions([]); }
    }
  };

  const handleAssignPerm = async (keyName) => {
    if (!detailData) return;
    setAssigningPerm(true);
    try {
      await assignPermission(detailData.duz, { keyName });
      const keysRes = await getUserPermissions(detailData.duz);
      setDetailKeys(keysRes?.data || []);
    } catch (err) { setError(err.message || 'Failed to assign permission'); }
    finally { setAssigningPerm(false); }
  };

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
                <h1 className="text-[22px] font-bold text-[#222]">Staff Directory</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage staff members, roles, permissions, and provider configuration.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({totalStaff} staff members)</span>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const header = 'Name,Staff ID,Status,E-Signature,Department\n';
                    const csv = (staffList || []).map(r => `"${r.name}","${r.duz}","${r.status}","${r.hasEsig ? 'Ready' : 'Incomplete'}","${r.department || ''}"`).join('\n');
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
                <MetricCard label="Locked" value={lockedCount} icon="lock" color="text-[#CC3333]" />
              </div>
            )}

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search by name or ID..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilterSelect label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              <FilterSelect label="E-Signature" value={esigFilter} options={ESIG_OPTIONS} onChange={(v) => { setEsigFilter(v); setPage(1); }} />
              <label className="flex items-center gap-1.5 text-[11px] text-[#666] cursor-pointer ml-2">
                <input type="checkbox" checked={hideSystemAccounts} onChange={e => { setHideSystemAccounts(e.target.checked); setPage(1); }}
                  className="w-3.5 h-3.5 rounded border-[#E2E4E8]" />
                Hide system accounts
              </label>
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
              <button onClick={() => { setSelectedStaff(null); setDetailData(null); }} className="text-[#999] hover:text-[#222]" aria-label="Close">
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
                  <DetailField label="Title" value={detailData.title} />
                  <DetailField label="Department" value={detailData.department} />
                  <DetailField label="Phone" value={detailData.phone} />
                  <DetailField label="Email" value={detailData.email} />
                  <DetailField label="Status" value={<StatusBadge status={detailData.status} />} />
                  {detailData.ssn && <DetailField label="SSN (last 4)" value={detailData.ssn} mono />}
                  <DetailField label="Initials" value={detailData.initials} />
                  <DetailField label="Last Sign-In" value={detailData.lastLogin} />
                </div>

                {detailData.isProvider && (
                  <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
                    <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">Provider Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="NPI" value={detailData.npi} mono />
                      <DetailField label="DEA#" value={detailData.dea} mono />
                      <DetailField label="Provider Type" value={detailData.providerType} />
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
                        <span
                          key={k.ien || k.name}
                          title={`${k.name}${k.packageName ? ' — ' + k.packageName : ''}`}
                          className="px-2 py-0.5 text-[10px] rounded bg-[#E8EEF5] text-[#2E5984]"
                        >
                          {k.displayName || humanizeKeyName(k.name)}
                        </span>
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
                    <DetailField label="Signature Block Name" value={detailData.sigBlockName} />
                    <DetailField label="Status" value={<SigReadinessBadge value={detailData.esigStatus} />} />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E4E8] space-y-2">
                  <button onClick={() => navigate(`/admin/staff/${detailData.duz}/edit`)}
                    className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-[16px] mr-2 align-middle">edit</span>
                    Edit Staff Member
                  </button>
                  <button onClick={handleOpenAssignPerms}
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
                  <button onClick={() => navigate(`/admin/audit?user=${encodeURIComponent(detailData.name)}`)}
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
                  {detailData.status === 'locked' && (
                    <button onClick={async () => {
                      try {
                        await unlockUser(detailData.duz);
                        setSelectedStaff(null);
                        setDetailData(null);
                        loadData();
                      } catch (err) { setError(`Failed to unlock: ${err.message}`); }
                    }}
                      className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-[#E8EEF5] rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[16px] mr-2 align-middle">lock_open</span>
                      Unlock Account
                    </button>
                  )}
                  {(detailData.status === 'inactive' || detailData.status === 'terminated') && (
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

      {clearEsigTarget && (
        <ConfirmDialog
          title="Clear E-Signature"
          message="Clear this staff member's electronic signature? They will need to set a new one on next sign-in."
          confirmLabel="Clear E-Signature"
          onConfirm={confirmClearEsig}
          onCancel={() => setClearEsigTarget(null)}
          destructive
        />
      )}

      {showAssignPermsModal && detailData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAssignPermsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[70vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Assign Permission" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#E2E4E8] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#222]">Assign Permission</h3>
                <p className="text-xs text-[#666] mt-0.5">to {detailData.name}</p>
              </div>
              <button onClick={() => setShowAssignPermsModal(false)} className="text-[#999] hover:text-[#222]" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 border-b border-[#E2E4E8]">
              <input type="text" value={permSearchText} onChange={e => setPermSearchText(e.target.value)}
                placeholder="Search permissions..." className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm focus:outline-none focus:border-[#2E5984]" />
            </div>
            <div className="flex-1 overflow-auto p-2">
              {allPermissions
                .filter(p => {
                  if (!permSearchText) return true;
                  const s = permSearchText.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(s) ||
                    (p.displayName || '').toLowerCase().includes(s) ||
                    (p.description || '').toLowerCase().includes(s) ||
                    (p.packageName || '').toLowerCase().includes(s)
                  );
                })
                .filter(p => !detailKeys.some(k => k.name === p.name))
                .slice(0, 50)
                .map(p => (
                  <button key={p.name} disabled={assigningPerm}
                    onClick={() => handleAssignPerm(p.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F8FB] rounded-md flex items-start justify-between gap-3 disabled:opacity-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#222] truncate">{p.displayName || humanizeKeyName(p.name)}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#999] font-mono">{p.name}</span>
                        {p.packageName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8EEF5] text-[#2E5984] uppercase tracking-wide">{p.packageName}</span>
                        )}
                      </div>
                      {p.description && (
                        <div className="text-[11px] text-[#666] mt-1 line-clamp-2">{p.description}</div>
                      )}
                    </div>
                    <span className="text-[#2E5984] text-xs font-medium flex-shrink-0 mt-0.5">Assign</span>
                  </button>
                ))}
              {allPermissions.length === 0 && <div className="text-center text-sm text-[#999] py-4">Loading permissions...</div>}
            </div>
          </div>
        </div>
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
  // Spec issue #3: Hide empty fields instead of showing dashes
  if (!value || value === '—' || value === '') return null;
  return (
    <div>
      <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider">{label}</div>
      <div className={`text-[13px] mt-0.5 ${mono ? 'font-mono' : ''} text-[#222]`}>{value}</div>
    </div>
  );
}

function ActionsMenu({ row, navigate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        className="p-1 rounded hover:bg-[#E2E4E8] text-[#999] hover:text-[#222]"
        aria-label={`Actions for ${row.name}`}>
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-[#E2E4E8] rounded-lg shadow-lg py-1 w-44">
            <button onClick={() => { setOpen(false); navigate(`/admin/staff/${row.duz}/edit`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">edit</span> Edit
            </button>
            <button onClick={() => { setOpen(false); navigate(`/admin/permissions?user=${row.duz}`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">vpn_key</span> Permissions
            </button>
            <button onClick={() => { setOpen(false); navigate(`/admin/audit?user=${encodeURIComponent(row.name)}`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">history</span> Audit Trail
            </button>
          </div>
        </>
      )}
    </div>
  );
}
