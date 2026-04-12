import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { StatusBadge, KeyCountBadge } from '../../components/shared/StatusBadge';
import { SearchBar, Pagination, FilterChips, ConfirmDialog } from '../../components/shared/SharedComponents';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getStaff, getStaffMember, getESignatureStatus, getUserPermissions, deactivateStaffMember, reactivateStaffMember, setESignature, assignPermission, removePermission, getPermissions, unlockUser, setProviderFields, getCprsTabAccess, updateCprsTabAccess, cloneStaffMember, updateStaffMember, terminateStaffMember } from '../../services/adminService';
import { TableSkeleton, KpiCardSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';
import { humanizeKeyName } from '../../utils/transforms';
import { useFacility } from '../../contexts/FacilityContext';
import { KEY_IMPACTS, ROLES } from './RoleTemplates';

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
  if (keySet.has('XUMGR') && keySet.has('XUPROG')) return 'System Administrator';
  if (keySet.has('XUMGR')) return 'System Administrator';
  if (keySet.has('SR SURGEON')) return 'Surgeon';
  if (keySet.has('SR ANESTHESIOLOGIST')) return 'Anesthesiologist';
  if (keySet.has('ORES') && keySet.has('PROVIDER')) return 'Physician';
  if (keySet.has('ORELSE') && keySet.has('PROVIDER')) return 'Nurse Practitioner';
  if (keySet.has('ORELSE')) return 'Nurse';
  if (keySet.has('PSO MANAGER')) return 'Pharmacy Supervisor';
  if (keySet.has('PSJ PHARMACIST') || keySet.has('PSORPH')) return 'Pharmacist';
  if (keySet.has('PSJ NURSE')) return 'Nursing (Pharmacy Orders)';
  if (keySet.has('LRSUPER')) return 'Lab Supervisor';
  if (keySet.has('LRLAB') || keySet.has('LRVERIFY')) return 'Lab Technologist';
  if (keySet.has('RA ALLOC')) return 'Radiology Technologist';
  if (keySet.has('SDMGR')) return 'Scheduling Manager';
  if (keySet.has('SD SUPERVISOR')) return 'Scheduling Supervisor';
  if (keySet.has('SD SCHEDULING') || keySet.has('SDCLINICAL')) return 'Scheduler';
  if (keySet.has('DG SUPERVISOR')) return 'Registration Supervisor';
  if (keySet.has('DG REGISTER') || keySet.has('DG REGISTRATION')) return 'Registration Clerk';
  if (keySet.has('MAG SYSTEM')) return 'Imaging Technician';
  if (keySet.has('IBFIN') || keySet.has('IB BILLING')) return 'Billing Specialist';
  if (keySet.has('TIU SIGN DOCUMENT')) return 'Health Information';
  if (keySet.has('GMRA-ALLERGY VERIFY')) return 'Allergy Verifier';
  if (keySet.has('PROVIDER')) return 'Clinical Staff';
  if (keySet.has('OR CPRS GUI CHART')) return 'Clinical User';
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
  { key: 'name', label: 'Name', bold: true, render: (val, row) => (
    <span>
      {val ? (
        <>{row.isDuplicate ? <>{val} <span className="text-[10px] text-text-secondary font-mono">({row.id})</span></> : val}</>
      ) : (
        <span className="italic text-text-secondary">(No Name #{row.id})</span>
      )}
      {row.isProvider && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Provider</span>}
    </span>
  ) },
  { key: 'displayId', label: 'ID', render: (val, row) => row.employeeId
    ? <span className="font-mono text-[11px]">{row.employeeId}</span>
    : <span className="font-mono text-[11px] text-text-secondary">{row.id}</span> },
  { key: 'title', label: 'Title' },
  { key: 'department', label: 'Department' },
  { key: 'site', label: 'Site' },
  { key: 'status', label: 'Status', align: 'center', render: (val) => <StatusBadge status={val} /> },
  { key: 'esigStatus', label: 'E-Signature', align: 'center', render: (val) => <SigReadinessBadge value={val} /> },
  { key: 'permissionCount', label: 'Permissions', align: 'center', render: (val) => <KeyCountBadge count={val || 0} /> },
];

const STATUS_OPTIONS = ['All', 'Active', 'Inactive', 'Locked', 'Terminated'];
const ESIG_OPTIONS = ['All', 'Ready', 'Incomplete'];
const ROLE_FILTER_OPTIONS = ['All', 'Physician', 'Nurse', 'Pharmacist', 'Lab', 'Scheduler', 'Registration', 'Admin', 'Other'];
const SORT_OPTIONS = ['Name (A–Z)', 'Name (Z–A)', 'Recently Created', 'Staff ID', 'Department'];

export default function StaffDirectory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeSite } = useFacility();
  useEffect(() => { document.title = 'Staff Directory — VistA Evolved'; }, []);
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'Active');
  const [esigFilter, setEsigFilter] = useState(searchParams.get('esig') || 'All');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'All');
  const [sortOption, setSortOption] = useState(searchParams.get('sort') || 'Name (A–Z)');
  const [hideSystemAccounts, setHideSystemAccounts] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [clearEsigTarget, setClearEsigTarget] = useState(null);
  const [clearingEsig, setClearingEsig] = useState(false);

  // Clone user modal state
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneForm, setCloneForm] = useState({ name: '', accessCode: '', verifyCode: '', showCredentials: false });
  const [cloning, setCloning] = useState(false);

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

  // CPRS Tab Access data (B8)
  const [cprsTabData, setCprsTabData] = useState([]);

  // S3.8: Sync filters to URL
  useEffect(() => {
    const params = {};
    if (searchText) params.q = searchText;
    if (statusFilter !== 'Active') params.status = statusFilter;
    if (esigFilter !== 'All') params.esig = esigFilter;
    if (roleFilter !== 'All') params.role = roleFilter;
    if (sortOption !== 'Name (A–Z)') params.sort = sortOption;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [searchText, statusFilter, esigFilter, roleFilter, sortOption, page, setSearchParams]);

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
        const rawTitle = u.title || '';
        const isNumericTitle = /^\d+$/.test(rawTitle);
        return {
          id: `S-${u.ien}`,
          duz: u.ien,
          name: u.name || esig.name || '',
          title: isNumericTitle ? '' : rawTitle,
          department: u.service || '',
          site: u.division || '',
          status: rawStatus,
          esigStatus: esig.hasCode ? 'active' : 'incomplete',
          hasEsig: esig.hasCode || false,
          sigBlockName: esig.sigBlockName || '',
          permissionCount: u.keyCount || 0,
          employeeId: u.employeeId || '',
          displayId: u.employeeId || `S-${u.ien}`,
          isProvider: u.isProvider || false,
          lastLogin: u.lastLogin || '',
        };
      });

      // Disambiguate duplicate names by appending Staff ID suffix
      const nameCounts = {};
      for (const u of merged) if (u.name) nameCounts[u.name] = (nameCounts[u.name] || 0) + 1;
      for (const u of merged) {
        u.isDuplicate = u.name && nameCounts[u.name] > 1;
        u.displayName = u.isDuplicate ? `${u.name} (${u.id})` : u.name;
      }

      setStaffList(merged);
    } catch (err) {
      setStaffList([]);
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
    setCprsTabData([]);
    try {
      const [userRes, keysRes, cprsRes] = await Promise.all([
        getStaffMember(row.duz),
        getUserPermissions(row.duz),
        getCprsTabAccess(row.duz).catch(() => ({ tabs: [], data: [] })),
      ]);
      const vg = userRes?.data?.vistaGrounding || {};
      const esig = vg.electronicSignature || {};
      const keys = (keysRes?.data || []).map(k => k.name);
      const derivedTitle = deriveTitleFromKeys(keys);
      const divs = userRes?.data?.divisions || [];
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
        primaryMenu: vg.primaryMenu || '',
        degree: vg.degree || '',
        division: divs?.[0]?.name || '',
        divisions: divs.map(d => d.name),
        terminationDate: vg.terminationDate || '',
        terminationReason: vg.terminationReason || '',
        personClass: vg.personClass || '',
        taxId: vg.taxId || '',
        authorizedToWriteMeds: vg.authMeds,
        requiresCosigner: Boolean(vg.cosigner),
        usualCosigner: vg.cosigner || '',
        // B1-B5, B9: New fields from expanded M routine
        restrictPatient: vg.restrictPatient || '',
        verifyCodeNeverExpires: vg.verifyCodeNeverExpires,
        language: vg.language || '',
        filemanAccessCode: vg.filemanAccessCode || '',
        defaultOrderList: vg.defaultOrderList || '',
        proxyUser: vg.proxyUser || '',
        employeeId: vg.employeeId || userRes?.data?.employeeId || '',
        // Password expiration (computed M-side, same as Kernel XUS1A.m sign-on)
        passwordLastChanged: vg.passwordLastChanged || '',
        passwordExpirationDays: vg.passwordExpirationDays,
        passwordDaysRemaining: vg.passwordDaysRemaining,
        // Activity summary
        signOnCount: vg.signOnCount || 0,
        firstSignOn: vg.firstSignOn || '',
      });
      setDetailKeys(keysRes?.data || []);
      // B8: CPRS Tab Access data now loaded in parallel
      setCprsTabData(cprsRes?.tabs || cprsRes?.data || []);
    } catch (err) {
      setDetailData(prev => prev || { ...row, _loadError: err.message || 'Failed to load details' });
    } finally {
      setDetailLoading(false);
    }
  };

  // S3.10: Role category mapping for filter
  const ROLE_CATEGORY_MAP = {
    'Physician': /physician|surgeon|anesthesiologist/i,
    'Nurse': /nurse|nursing|lpn/i,
    'Pharmacist': /pharma/i,
    'Lab': /lab|patholog/i,
    'Scheduler': /schedul/i,
    'Registration': /registr|admit|clerk/i,
    'Admin': /admin|manager|supervisor/i,
  };
  function matchesRoleFilter(title, filter) {
    if (filter === 'All') return true;
    const pattern = ROLE_CATEGORY_MAP[filter];
    if (pattern) return pattern.test(title || '');
    // 'Other' matches anything not in the known categories
    if (filter === 'Other') return !Object.values(ROLE_CATEGORY_MAP).some(p => p.test(title || ''));
    return true;
  }

  // Filters (client-side since list endpoint only returns ien+name)
  const SYSTEM_ACCOUNT_PATTERNS = /^(POSTMASTER|TASKMAN|HL7|RPC BROKER|PATCH|AUTOP|XOBV|XWB|APPLICATION|PROXY|APITEST)/i;
  // P5: Memoize filter + sort to avoid re-computation on every render
  const filtered = useMemo(() => staffList.filter(u => {
    if (hideSystemAccounts && SYSTEM_ACCOUNT_PATTERNS.test(u.name)) return false;
    // Facility filter from context
    if (activeSite && u.site && !u.site.toUpperCase().includes(activeSite.name.toUpperCase())) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!u.name.toLowerCase().includes(s) && !u.id.toLowerCase().includes(s) && !(u.title || '').toLowerCase().includes(s) && !(u.department || '').toLowerCase().includes(s)) return false;
    }
    if (statusFilter !== 'All' && u.status !== statusFilter.toLowerCase()) return false;
    if (esigFilter === 'Ready' && !u.hasEsig) return false;
    if (esigFilter === 'Incomplete' && u.hasEsig) return false;
    if (roleFilter !== 'All' && !matchesRoleFilter(u.title, roleFilter)) return false;
    return true;
  }), [staffList, hideSystemAccounts, activeSite, searchText, statusFilter, esigFilter, roleFilter]);

  // Sort the filtered list
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    switch (sortOption) {
      case 'Name (Z–A)': return (b.name || '').localeCompare(a.name || '');
      case 'Recently Created': return parseInt(b.duz, 10) - parseInt(a.duz, 10);
      case 'Staff ID': return parseInt(a.duz, 10) - parseInt(b.duz, 10);
      case 'Department': return (a.department || '').localeCompare(b.department || '') || (a.name || '').localeCompare(b.name || '');
      default: return (a.name || '').localeCompare(b.name || '');
    }
  }), [filtered, sortOption]);

  const totalFiltered = sorted.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  // KPI cards from full staff list (memoized)
  const { totalStaff, activeCount, providerCount, lockedCount } = useMemo(() => ({
    totalStaff: staffList.length,
    activeCount: staffList.filter(u => u.status === 'active').length,
    providerCount: staffList.filter(u => u.isProvider).length,
    lockedCount: staffList.filter(u => u.status === 'locked').length,
  }), [staffList]);

  const activeFilters = [
    ...(statusFilter !== 'All' ? [{ key: 'status', label: `Status: ${statusFilter}` }] : []),
    ...(esigFilter !== 'All' ? [{ key: 'esig', label: `E-Signature: ${esigFilter}` }] : []),
    ...(roleFilter !== 'All' ? [{ key: 'role', label: `Role: ${roleFilter}` }] : []),
  ];

  const removeFilter = (key) => {
    if (key === 'status') setStatusFilter('All');
    if (key === 'esig') setEsigFilter('All');
    if (key === 'role') setRoleFilter('All');
  };

  const [actionSuccess, setActionSuccess] = useState(null);
  const [removePermTarget, setRemovePermTarget] = useState(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [terminateTarget, setTerminateTarget] = useState(null);

  const handleDeactivate = async (reason) => {
    if (!deactivateTarget) return;
    const name = deactivateTarget.name;
    try {
      await deactivateStaffMember(deactivateTarget.duz, { reason });
      setDeactivateTarget(null);
      // Keep detail panel open — update status in place
      if (detailData && detailData.duz === deactivateTarget.duz) {
        setDetailData(prev => ({ ...prev, status: 'terminated' }));
      }
      setActionSuccess(`${name} has been deactivated. Reason: ${reason || 'Not specified'}. This action has been recorded in the audit log.`);
      loadData();
    } catch (err) {
      setError(`Failed to deactivate ${name}: ${err.message}`);
      setDeactivateTarget(null);
    }
  };

  const handleReactivate = async (duz) => {
    const name = detailData?.name || 'Staff member';
    try {
      await reactivateStaffMember(duz);
      if (detailData && detailData.duz === duz) {
        setDetailData(prev => ({ ...prev, status: 'active' }));
      }
      setActionSuccess(`${name} has been reactivated. They can now sign in.`);
      loadData();
    } catch (err) { setError(`Failed to reactivate: ${err.message}`); }
  };

  const handleCloneUser = async () => {
    if (!cloneSource || !cloneForm.name.trim()) return;
    setCloning(true);
    try {
      await cloneStaffMember({
        sourceDuz: cloneSource.duz,
        name: cloneForm.name,
        accessCode: cloneForm.accessCode || undefined,
        verifyCode: cloneForm.verifyCode || undefined,
      });
      setActionSuccess(`Cloned ${cloneSource.name} → ${cloneForm.name}. The new account has the same permissions and settings.`);
      setCloneSource(null);
      setCloneForm({ name: '', accessCode: '', verifyCode: '', showCredentials: false });
      loadData();
    } catch (err) {
      setError(`Failed to clone user: ${err.message}`);
    } finally {
      setCloning(false);
    }
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

  const handleRemovePermission = async (key) => {
    setRemovePermTarget(key);
  };

  const confirmRemovePermission = async () => {
    if (!removePermTarget || !detailData) return;
    const key = removePermTarget;
    try {
      await removePermission(detailData.duz, key.ien || key.name);
      const keysRes = await getUserPermissions(detailData.duz);
      const newKeys = keysRes?.data || [];
      setDetailKeys(newKeys);
      setStaffList(prev => prev.map(u => u.duz === detailData.duz
        ? { ...u, permissionCount: newKeys.length } : u));
      setActionSuccess(`Removed ${key.displayName || humanizeKeyName(key.name)} from ${detailData.name}.`);
    } catch (err) { setError(err.message || 'Failed to remove permission'); }
    finally { setRemovePermTarget(null); }
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
      const newKeys = keysRes?.data || [];
      setDetailKeys(newKeys);
      setStaffList(prev => prev.map(u => u.duz === detailData.duz ? { ...u, permissionCount: newKeys.length } : u));
    } catch (err) { setError(err.message || 'Failed to assign permission'); }
    finally { setAssigningPerm(false); }
  };

  const isLoadError = error && staffList.length === 0;

  if (isLoadError) {
    return (
      <AppShell breadcrumb="Admin > Staff Directory">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Staff Directory">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${selectedStaff ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            {error && !isLoadError && (
              <div role="alert" className="mb-4 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-sm text-[#CC3333] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {error}
                </div>
                <button onClick={() => setError(null)} className="text-xs hover:underline">Dismiss</button>
              </div>
            )}
            {actionSuccess && (
              <div role="status" className="mb-4 p-3 bg-[#E8F5E9] border border-[#2D6A4F] rounded-lg text-sm text-[#2D6A4F] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {actionSuccess}
                </div>
                <button onClick={() => setActionSuccess(null)} className="text-xs hover:underline">Dismiss</button>
              </div>
            )}
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
                    const header = 'Name,Staff ID,Title,Department,Site,Status,E-Signature,Permissions,Role,NPI,Email,Phone,Last Login\n';
                    const csv = (sorted || []).map(r => `"${(r.name || '').replace(/"/g, '""')}","${r.duz}","${(r.title || '').replace(/"/g, '""')}","${(r.department || '').replace(/"/g, '""')}","${(r.site || '').replace(/"/g, '""')}","${r.status}","${r.hasEsig ? 'Ready' : 'Incomplete'}","${r.permissionCount || 0}","${(r.role || '').replace(/"/g, '""')}","${r.npi || ''}","${(r.email || '').replace(/"/g, '""')}","${r.phone || ''}","${r.lastLogin || ''}"`).join('\n');
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
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <MetricCard label="Total Staff" value={totalStaff} icon="badge" hint="Total user accounts in the VistA NEW PERSON file (#200). Includes active, inactive, and system accounts." />
                <MetricCard label="Active" value={activeCount} icon="check_circle" color="text-[#2E7D32]" hint="Users with no DISUSER flag and no termination date. These users can currently sign in." />
                <MetricCard label="Providers" value={providerCount} icon="stethoscope" color="text-[#2E5984]" hint="Users with the PROVIDER security key or an NPI number. These users can write orders and sign clinical documents." />
                <MetricCard label="Locked" value={lockedCount} icon="lock" color="text-[#CC3333]" hint="Users whose accounts are temporarily locked due to failed sign-in attempts. Use 'Unlock' to restore access." />
              </div>
            )}

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search by name or ID..." value={searchInput} onSearch={(val) => { setSearchInput(val); setSearchText(val); setPage(1); }} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilterSelect label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              <FilterSelect label="E-Signature" value={esigFilter} options={ESIG_OPTIONS} onChange={(v) => { setEsigFilter(v); setPage(1); }} />
              <FilterSelect label="Role" value={roleFilter} options={ROLE_FILTER_OPTIONS} onChange={(v) => { setRoleFilter(v); setPage(1); }} />
              <FilterSelect label="Sort" value={sortOption} options={SORT_OPTIONS} onChange={(v) => { setSortOption(v); setPage(1); }} />
              <label className="flex items-center gap-1.5 text-[11px] text-[#666] cursor-pointer ml-2">
                <input type="checkbox" checked={hideSystemAccounts} onChange={e => { setHideSystemAccounts(e.target.checked); setPage(1); }}
                  className="w-3.5 h-3.5 rounded border-[#E2E4E8]" />
                Hide system accounts
              </label>
            </div>

            {activeFilters.length > 0 && (
              <div className="mb-4">
                <FilterChips filters={activeFilters} onRemove={removeFilter} />
                {activeFilters.length > 1 && (
                  <button onClick={() => { setStatusFilter('All'); setEsigFilter('All'); setRoleFilter('All'); setSearchText(''); setSearchInput(''); setPage(1); }}
                    className="ml-2 text-[11px] text-[#2E5984] hover:underline">Clear all</button>
                )}
              </div>
            )}

            {loading ? <TableSkeleton rows={10} cols={7} /> : totalFiltered === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-[#CCC] mb-3 block">search_off</span>
                {totalStaff === 0 && !searchText ? (
                  <>
                    <h3 className="text-sm font-semibold text-[#666] mb-1">Welcome to the Staff Directory</h3>
                    <p className="text-xs text-[#999]">
                      No staff members have been registered yet. Create your first staff member to get started.
                    </p>
                    <button onClick={() => navigate('/admin/staff/new')}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984]">
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      Add First Staff Member
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-[#666] mb-1">No matching staff members</h3>
                    <p className="text-xs text-[#999]">
                      {searchText ? `No results for "${searchText}"` : 'Try adjusting your filters'}
                    </p>
                    {(searchText || statusFilter !== 'All' || esigFilter !== 'All') && (
                      <button onClick={() => { setSearchText(''); setSearchInput(''); setStatusFilter('All'); setEsigFilter('All'); setRoleFilter('All'); setPage(1); }}
                        className="mt-3 text-xs text-[#2E5984] hover:underline">Clear all filters</button>
                    )}
                  </>
                )}
              </div>
            ) : (
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
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{selectedStaff.name}</h2>
              <button onClick={() => { setSelectedStaff(null); setDetailData(null); }} className="text-[#999] hover:text-[#222]" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <StaffDetailContent
              detailData={detailData} detailKeys={detailKeys} detailLoading={detailLoading}
              selectedStaff={selectedStaff} cprsTabData={cprsTabData} setCprsTabData={setCprsTabData}
              navigate={navigate} handleRowClick={handleRowClick} handleOpenAssignPerms={handleOpenAssignPerms}
              handleClearEsig={handleClearEsig} clearingEsig={clearingEsig}
              handleReactivate={handleReactivate} handleRemovePermission={handleRemovePermission}
              setDeactivateTarget={setDeactivateTarget} setDetailData={setDetailData}
              unlockUser={unlockUser} setSelectedStaff={setSelectedStaff}
              loadData={loadData} setError={setError}
              setCloneSource={setCloneSource}
              setTerminateTarget={setTerminateTarget}
            />
          </div>
        )}

        {/* Mobile/tablet full-screen modal (below xl) */}
        {selectedStaff && (
          <div className="xl:hidden fixed inset-0 bg-white z-40 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-[#E2E4E8] px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold truncate text-[#222]">{selectedStaff.name}</h2>
              <button onClick={() => { setSelectedStaff(null); setDetailData(null); }}
                className="p-1 rounded-md hover:bg-[#F5F5F5]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              <StaffDetailContent
                detailData={detailData} detailKeys={detailKeys} detailLoading={detailLoading}
                selectedStaff={selectedStaff} cprsTabData={cprsTabData} setCprsTabData={setCprsTabData}
                navigate={navigate} handleRowClick={handleRowClick} handleOpenAssignPerms={handleOpenAssignPerms}
                handleClearEsig={handleClearEsig} clearingEsig={clearingEsig}
                handleReactivate={handleReactivate} handleRemovePermission={handleRemovePermission}
                setDeactivateTarget={setDeactivateTarget} setDetailData={setDetailData}
                unlockUser={unlockUser} setSelectedStaff={setSelectedStaff}
                loadData={loadData} setError={setError}
                setCloneSource={setCloneSource}
                setTerminateTarget={setTerminateTarget}
              />
            </div>
          </div>
        )}
      </div>

      {terminateTarget && (
        <ConfirmDialog
          title="Full Account Termination"
          message={<>This will <strong>permanently</strong> clear credentials, remove all security keys, and set the DISUSER flag for <strong>{terminateTarget.name}</strong>. This action cannot be undone.</>}
          confirmLabel="Terminate Account"
          onConfirm={async () => {
            try {
              await terminateStaffMember(terminateTarget.duz);
              setTerminateTarget(null);
              setSelectedStaff(null);
              setDetailData(null);
              loadData();
            } catch (err) { setError(`Failed to terminate: ${err.message}`); setTerminateTarget(null); }
          }}
          onCancel={() => setTerminateTarget(null)}
          destructive
        />
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" role="dialog" aria-modal="true" aria-label="Deactivate Staff Member">
            <h3 className="text-lg font-semibold text-[#222] mb-2">Deactivate Staff Member</h3>
            <p className="text-sm text-[#666] mb-4">
              Deactivating <strong>{deactivateTarget.name}</strong> will immediately prevent them from signing in.
              Their records will be preserved for audit purposes.
            </p>
            <label className="block text-sm font-medium text-[#333] mb-1">Reason for deactivation</label>
            <select
              value={deactivateReason}
              onChange={e => setDeactivateReason(e.target.value)}
              className="w-full h-10 px-3 border border-[#E2E4E8] rounded-md text-sm mb-4"
            >
              <option value="" disabled>Select a reason...</option>
              <option value="Left Organization">Left Organization</option>
              <option value="Role Change">Role Change</option>
              <option value="Security Concern">Security Concern</option>
              <option value="Extended Leave">Extended Leave</option>
              <option value="Retirement">Retirement</option>
              <option value="Other">Other</option>
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeactivateTarget(null); setDeactivateReason(''); }}
                className="px-4 py-2 text-sm text-[#666] hover:bg-[#F5F5F5] rounded-lg">Cancel</button>
              <button onClick={() => handleDeactivate(deactivateReason || 'Not specified')}
                disabled={!deactivateReason}
                className={`px-4 py-2 text-sm text-white rounded-lg ${deactivateReason ? 'bg-[#CC3333] hover:bg-[#AA2222]' : 'bg-gray-300 cursor-not-allowed'}`}>Deactivate</button>
            </div>
          </div>
        </div>
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

      {removePermTarget && (
        <ConfirmDialog
          title="Remove Permission"
          message={
            <>
              Remove &quot;{removePermTarget.displayName || humanizeKeyName(removePermTarget.name)}&quot; from {detailData?.name}? This will immediately revoke this access.
              {KEY_IMPACTS[removePermTarget.name] && (
                <p className="mt-2 text-xs text-[#CC3333] bg-[#FDE8E8] rounded p-2">
                  <strong>Impact:</strong> {KEY_IMPACTS[removePermTarget.name]}
                </p>
              )}
            </>
          }
          confirmLabel="Remove"
          onConfirm={confirmRemovePermission}
          onCancel={() => setRemovePermTarget(null)}
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
              {allPermissions.length === 0 && (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-[32px] text-[#999] block mb-2">vpn_key_off</span>
                  <div className="text-sm text-[#999]">No permissions available</div>
                  <div className="text-xs text-[#BBB] mt-1">Unable to load the permission catalog. Try closing and reopening this panel.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clone User Modal */}
      {cloneSource && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setCloneSource(null); setCloneForm({ name: '', accessCode: '', verifyCode: '', showCredentials: false }); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" role="dialog" aria-modal="true" aria-label="Clone Staff Member" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#222] mb-2">Clone Staff Member</h3>
            <p className="text-sm text-[#666] mb-1">
              The new user will receive the same permissions and settings as <strong>{cloneSource.name}</strong>.
            </p>
            <p className="text-xs text-[#999] mb-4">
              {cloneSource.permissionCount || 0} permissions{cloneSource.division ? `, ${cloneSource.division}` : ''}{cloneSource.department ? ` — ${cloneSource.department}` : ''} will be copied.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">New User Name <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={cloneForm.name}
                  onChange={e => setCloneForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                  placeholder="LAST,FIRST MIDDLE" maxLength={35}
                  className="w-full h-10 px-3 border border-[#E2E4E8] rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">Username</label>
                <div className="relative">
                  <input type={cloneForm.showCredentials ? 'text' : 'password'} value={cloneForm.accessCode}
                    onChange={e => setCloneForm(f => ({ ...f, accessCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                    placeholder="e.g., JDOE1234" maxLength={20}
                    className="w-full h-10 px-3 pr-9 border border-[#E2E4E8] rounded-md text-sm" autoComplete="off" />
                  <button type="button" onClick={() => setCloneForm(f => ({ ...f, showCredentials: !f.showCredentials }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#666]">
                    <span className="material-symbols-outlined text-[18px]">{cloneForm.showCredentials ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">Password</label>
                <input type={cloneForm.showCredentials ? 'text' : 'password'} value={cloneForm.verifyCode}
                  onChange={e => setCloneForm(f => ({ ...f, verifyCode: e.target.value }))}
                  placeholder="Enter password" maxLength={20}
                  className="w-full h-10 px-3 border border-[#E2E4E8] rounded-md text-sm" autoComplete="new-password" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => { setCloneSource(null); setCloneForm({ name: '', accessCode: '', verifyCode: '', showCredentials: false }); }}
                className="px-4 py-2 text-sm text-[#666] hover:bg-[#F5F5F5] rounded-lg">Cancel</button>
              <button onClick={handleCloneUser} disabled={!cloneForm.name.trim() || cloning}
                className={`px-4 py-2 text-sm text-white rounded-lg ${cloneForm.name.trim() && !cloning ? 'bg-[#1A1A2E] hover:bg-[#2E5984]' : 'bg-gray-300 cursor-not-allowed'}`}>
                {cloning ? 'Creating...' : 'Create Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Reference */}
      <details className="mt-6 border border-[#E2E4E8] rounded-lg bg-[#FAFBFC]">
        <summary className="px-4 py-2.5 text-xs text-[#666] cursor-pointer select-none hover:bg-[#F5F8FB] rounded-lg">
          📖 VistA Terminal Reference
        </summary>
        <div className="px-4 pb-3 text-xs text-[#666] leading-relaxed">
          This page replaces: <strong>EVE → User Management → List Users by Various Criteria</strong>.
          VistA File: <strong>NEW PERSON (#200)</strong>.
          Terminal also provides: Find a User, User Inquiry, Release User (Unlock).
          All of these are available from this single modern interface.
        </div>
      </details>
    </AppShell>
  );
}

function MetricCard({ label, value, icon, color = 'text-[#222]', hint }) {
  return (
    <div className="bg-white border border-[#E2E4E8] rounded-lg p-4 flex items-center gap-3" title={hint}>
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
        aria-label={`Actions for ${row.name}`}
        aria-haspopup="true"
        aria-expanded={open}>
        <span className="material-symbols-outlined text-[18px]">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-[#E2E4E8] rounded-lg shadow-lg py-1 w-44" role="menu"
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
            <button onClick={() => { setOpen(false); navigate(`/admin/staff/${row.duz}/edit`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2" role="menuitem">
              <span className="material-symbols-outlined text-[14px]">edit</span> Edit
            </button>
            <button onClick={() => { setOpen(false); navigate(`/admin/permissions?view=${encodeURIComponent(row.name)}`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2" role="menuitem">
              <span className="material-symbols-outlined text-[14px]">vpn_key</span> Permissions
            </button>
            <button onClick={() => { setOpen(false); navigate(`/admin/audit?user=${encodeURIComponent(row.name)}`); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F8FB] flex items-center gap-2" role="menuitem">
              <span className="material-symbols-outlined text-[14px]">history</span> Audit Trail
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* A4: Inline editable field for provider information (or any saveFn) */
function EditableDetailField({ label, value, fieldKey, duz, onSave, saveFn }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (saveFn) {
        await saveFn(duz, fieldKey, editValue);
      } else {
        await setProviderFields(duz, { field: fieldKey, value: editValue });
      }
      onSave(fieldKey, editValue);
      setEditing(false);
    } catch (err) { setSaveError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div>
        <label className="block text-[10px] font-medium text-[#999] uppercase">{label}</label>
        <div className="flex items-center gap-1 mt-0.5">
          <input value={editValue} onChange={e => setEditValue(e.target.value)}
            className="flex-1 h-7 px-2 text-sm border border-[#E2E4E8] rounded" />
          <button onClick={handleSave} disabled={saving}
            className="text-[#2E7D32] hover:bg-[#E8F5E9] p-1 rounded">
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
          <button onClick={() => { setEditing(false); setSaveError(null); }}
            className="text-[#999] hover:bg-[#F5F5F5] p-1 rounded">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        {saveError && <p className="text-[10px] text-[#CC3333] mt-1">{saveError}</p>}
      </div>
    );
  }

  return (
    <div className="cursor-pointer group" onClick={() => setEditing(true)} title="Click to edit">
      <div className="text-[10px] font-medium text-[#999] uppercase">{label}</div>
      <div className="text-sm text-[#222] group-hover:text-[#2E5984] flex items-center gap-1">
        {value || '—'}
        <span className="material-symbols-outlined text-[12px] text-[#BBB] opacity-0 group-hover:opacity-100">edit</span>
      </div>
    </div>
  );
}

/* A3: Extracted detail content shared by desktop side panel and mobile modal */
function StaffDetailContent({
  detailData, detailKeys, detailLoading, selectedStaff, cprsTabData, setCprsTabData,
  navigate, handleRowClick, handleOpenAssignPerms,
  handleClearEsig, clearingEsig,
  handleReactivate, handleRemovePermission,
  setDeactivateTarget, setDetailData,
  unlockUser, setSelectedStaff, loadData, setError,
  setCloneSource, setTerminateTarget,
}) {
  const handleProviderFieldSave = (fieldKey, newValue) => {
    setDetailData(prev => ({ ...prev, [fieldKey]: newValue }));
  };

  // S4.4: Save handler for basic fields (phone, email, dept, title) via PUT /users/:ien
  const BASIC_FIELD_MAP = { phone: '.132', email: '.151', department: '29', title: '8', proxyUser: '203.1', degree: '10.6', cosigner: '53.42', primaryMenu: '201' };
  const handleBasicFieldSave = async (duz, fieldKey, newValue) => {
    const vistaField = BASIC_FIELD_MAP[fieldKey];
    if (!vistaField) throw new Error(`Unknown field: ${fieldKey}`);
    await updateStaffMember(duz, { field: vistaField, value: newValue });
  };

  if (detailLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-[#E2E4E8] rounded" />)}
      </div>
    );
  }

  if (detailData?._loadError) {
    return (
      <div className="p-4 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-sm text-[#CC3333] flex items-start gap-2">
        <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
        <div>
          <strong>Failed to load details</strong>
          <p className="text-xs text-[#666] mt-1">{detailData._loadError}</p>
          <button onClick={() => handleRowClick(selectedStaff)} className="mt-2 text-xs text-[#2E5984] hover:underline">Try Again</button>
        </div>
      </div>
    );
  }

  if (!detailData) {
    return <p className="text-sm text-[#999]">Click a staff member to view details.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {detailData.employeeId && <DetailField label="Employee ID" value={detailData.employeeId} mono />}
        <DetailField label="System ID" value={detailData.id} mono />
        <DetailField label="Title" value={detailData.title} />
        <EditableDetailField label="Department" value={detailData.department} fieldKey="department" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />
        <EditableDetailField label="Phone" value={detailData.phone} fieldKey="phone" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />
        <EditableDetailField label="Email" value={detailData.email} fieldKey="email" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />
        <DetailField label="Status" value={<StatusBadge status={detailData.status} />} />
        {detailData.ssn && <DetailField label="SSN (last 4)" value={detailData.ssn} mono />}
        <DetailField label="Initials" value={detailData.initials} />
        <DetailField label="Last Sign-In" value={detailData.lastLogin} />
        <EditableDetailField label="Primary Menu" value={detailData.primaryMenu} fieldKey="primaryMenu" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />
        {detailData.degree && <DetailField label="Degree" value={detailData.degree} />}
        {detailData.division && <DetailField label="Division" value={detailData.division} />}
        {detailData.divisions?.length > 1 && (
          <div>
            <div className="text-[10px] font-medium text-[#999] uppercase">All Divisions</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {detailData.divisions.map((div, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F0FE] text-[#2E5984] border border-[#BDD4EE]">
                  {div}
                </span>
              ))}
            </div>
          </div>
        )}
        {detailData.terminationDate && <DetailField label="Termination Date" value={detailData.terminationDate} />}
        {detailData.terminationReason && <DetailField label="Termination Reason" value={detailData.terminationReason} />}
        {/* B1: Restrict Patient Selection */}
        {detailData.restrictPatient && <DetailField label="Patient Selection Restriction" value={detailData.restrictPatient} />}
        {/* B2: Verify Code Never Expires */}
        <DetailField label="Password Never Expires" value={detailData.verifyCodeNeverExpires ? 'Yes (override)' : 'Normal expiration'} />
        {/* 4.8: Password Expiration Display (XUS1A.m algorithm) */}
        {detailData.passwordLastChanged && (
          <DetailField label="Password Changed" value={detailData.passwordLastChanged} />
        )}
        {detailData.passwordDaysRemaining != null && !detailData.verifyCodeNeverExpires && (
          <DetailField label="Password Expiration" value={
            detailData.passwordDaysRemaining <= 0
              ? <span className="text-[#CC3333] font-semibold">Expired ({Math.abs(detailData.passwordDaysRemaining)} day{Math.abs(detailData.passwordDaysRemaining) !== 1 ? 's' : ''} ago)</span>
              : detailData.passwordDaysRemaining <= 5
                ? <span className="text-[#E6A817] font-semibold">Expires in {detailData.passwordDaysRemaining} day{detailData.passwordDaysRemaining !== 1 ? 's' : ''}</span>
                : <span className="text-[#2E7D32]">{detailData.passwordDaysRemaining} day{detailData.passwordDaysRemaining !== 1 ? 's' : ''} remaining{detailData.passwordExpirationDays ? ` (${detailData.passwordExpirationDays}-day policy)` : ''}</span>
          } />
        )}
        {/* B3: Language Preference */}
        {detailData.language && <DetailField label="Preferred Language" value={detailData.language} />}
        {/* B4: FileMan Access Code — only show if present */}
        {detailData.filemanAccessCode && (
          <DetailField label="FileMan Access" value={detailData.filemanAccessCode === '@' ? 'Unrestricted (@)' : detailData.filemanAccessCode} />
        )}
        {/* B9: Proxy User — editable (VistA field 203.1, pointer to File 200) */}
        <EditableDetailField label="Proxy Ordering User" value={detailData.proxyUser} fieldKey="proxyUser" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />
      </div>

      {/* P3.10: Activity Summary */}
      <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
        <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">Activity Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <DetailField label="Last Sign-In" value={detailData.lastLogin || '—'} />
          <DetailField label="Sign-On Count" value={detailData.signOnCount > 0 ? String(detailData.signOnCount) : '—'} />
          <DetailField label="First Sign-On" value={detailData.firstSignOn || '—'} />
        </div>
      </div>

      {/* B5: Clinical Configuration */}
      {detailData.defaultOrderList && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
          <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">Clinical Configuration</h3>
          <DetailField label="Default Order List" value={detailData.defaultOrderList} />
        </div>
      )}

      {/* A4: Provider Information with inline editing */}
      {detailData.isProvider && (
        <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
          <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">Provider Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <EditableDetailField label="NPI" value={detailData.npi} fieldKey="npi" duz={detailData.duz} onSave={handleProviderFieldSave} />
            <EditableDetailField label="DEA#" value={detailData.dea} fieldKey="dea" duz={detailData.duz} onSave={handleProviderFieldSave} />
            <EditableDetailField label="Provider Type" value={detailData.providerType} fieldKey="providerType" duz={detailData.duz} onSave={handleProviderFieldSave} />
            {detailData.personClass && <EditableDetailField label="Person Class" value={detailData.personClass} fieldKey="personClass" duz={detailData.duz} onSave={handleProviderFieldSave} />}
            {detailData.taxId && <EditableDetailField label="Tax ID" value={detailData.taxId} fieldKey="taxId" duz={detailData.duz} onSave={handleProviderFieldSave} />}
            {detailData.authorizedToWriteMeds !== undefined && (
              <DetailField label="Med Order Authority" value={detailData.authorizedToWriteMeds ? 'Yes' : 'No'} />
            )}
            {detailData.requiresCosigner !== undefined && (
              <DetailField label="Requires Cosigner" value={detailData.requiresCosigner ? 'Yes' : 'No'} />
            )}
            {detailData.usualCosigner !== undefined && <EditableDetailField label="Usual Cosigner" value={detailData.usualCosigner} fieldKey="cosigner" duz={detailData.duz} onSave={handleProviderFieldSave} saveFn={handleBasicFieldSave} />}
            <DetailField label="E-Signature" value={<SigReadinessBadge value={detailData.esigStatus} />} />
          </div>
        </div>
      )}

      {/* B8: CPRS Tab Access */}
      {cprsTabData && cprsTabData.length > 0 && (
        <CprsTabList cprsTabData={cprsTabData} setCprsTabData={setCprsTabData} duz={detailData.duz} />
      )}

      {detailKeys.length > 0 && (
        <PermissionsList detailKeys={detailKeys} handleOpenAssignPerms={handleOpenAssignPerms} handleRemovePermission={handleRemovePermission} assignedRole={detailData.assignedRole || detailData.role} />
      )}

      <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
        <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">E-Signature Block</h3>
        <div className="grid grid-cols-2 gap-3">
          <DetailField label="Signature Block Name" value={detailData.sigBlockName} />
          <DetailField label="Status" value={<SigReadinessBadge value={detailData.esigStatus} />} />
        </div>
      </div>

      <div className="pt-4 border-t border-[#E2E4E8] space-y-4">
        {/* ── Primary Actions ── */}
        <div>
          <div className="text-[9px] font-bold text-[#999] uppercase tracking-wider mb-1.5">Primary Actions</div>
          <div className="space-y-1">
            <button onClick={() => navigate(`/admin/staff/${detailData.duz}/edit`)}
              title="Opens the staff editing wizard. Changes are written to VistA File #200 via RPC."
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">edit</span>
              Edit Staff Member
            </button>
            <button onClick={() => navigate(`/admin/roles`, { state: { assignToDuz: detailData.duz, assignToName: detailData.name } })}
              title="Apply a pre-defined role template that bundles related security keys."
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">assignment_ind</span>
              Assign Role
            </button>
          </div>
        </div>
        {/* ── Permissions ── */}
        <div>
          <div className="text-[9px] font-bold text-[#999] uppercase tracking-wider mb-1.5">Permissions</div>
          <div className="space-y-1">
            <button onClick={handleOpenAssignPerms}
              title="Add security keys to this user. Keys control what features and actions the user can access in VistA."
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">key</span>
              Assign Permissions
            </button>
            <button onClick={() => navigate(`/admin/audit?user=${encodeURIComponent(detailData.name)}`)}
              title="Shows all recorded administrative actions related to this user."
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">history</span>
              View Audit Trail
            </button>
          </div>
        </div>
        {/* ── Account ── */}
        <div>
          <div className="text-[9px] font-bold text-[#999] uppercase tracking-wider mb-1.5">Account</div>
          <div className="space-y-1">
            <button onClick={() => setCloneSource(detailData)}
              title="Create a new account with the same permissions, role, and settings as this person."
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">content_copy</span>
              Clone User
            </button>
            <button onClick={() => {
              const printWindow = window.open('', '_blank');
              if (!printWindow) return;
              const safeText = (s) => String(s || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const permList = detailKeys.length > 0
                ? `<ul style="margin:4px 0;padding-left:20px">${detailKeys.map(k => `<li>${safeText(k.name)}</li>`).join('')}</ul>`
                : '<em>None assigned</em>';
              const credRows = [
                detailData.npi ? `<tr><td><strong>NPI</strong></td><td>${safeText(detailData.npi)}</td></tr>` : '',
                detailData.dea ? `<tr><td><strong>DEA</strong></td><td>${safeText(detailData.dea)}</td></tr>` : '',
                detailData.taxId ? `<tr><td><strong>Tax ID</strong></td><td>${safeText(detailData.taxId)}</td></tr>` : '',
              ].filter(Boolean).join('\n');
              printWindow.document.write(`<html><head><title>Account Access Letter</title>
<style>body{font-family:serif;max-width:700px;margin:40px auto}h1{font-size:18px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse}td{padding:4px 8px;border-bottom:1px solid #eee}ul{font-size:13px}p.footer{margin-top:24px;font-size:12px;color:#666;border-top:1px solid #ccc;padding-top:12px}</style></head>
<body><h1>VistA Evolved — User Account Access Letter</h1>
<p><strong>Organization:</strong> ${safeText(detailData.division)}</p>
<p><strong>Date Issued:</strong> ${new Date().toLocaleDateString()}</p>
<h2>Account Information</h2>
<table>
<tr><td><strong>Name</strong></td><td>${safeText(detailData.name)}</td></tr>
<tr><td><strong>Staff ID (DUZ)</strong></td><td>${safeText(detailData.id)}</td></tr>
<tr><td><strong>Title</strong></td><td>${safeText(detailData.title)}</td></tr>
<tr><td><strong>Role</strong></td><td>${safeText(detailData.assignedRole || detailData.role)}</td></tr>
<tr><td><strong>Department</strong></td><td>${safeText(detailData.department)}</td></tr>
<tr><td><strong>Primary Site</strong></td><td>${safeText(detailData.division)}</td></tr>
<tr><td><strong>E-Signature</strong></td><td>${detailData.esigStatus === 'active' ? 'Set' : 'Not set'}</td></tr>
</table>
${credRows ? `<h2>Provider Credentials</h2><table>${credRows}</table>` : ''}
<h2>Assigned Permissions (${detailKeys.length})</h2>
${permList}
<p class="footer"><strong>Important:</strong> Your login credentials (Access Code and Verify Code) were provided separately at account creation time and must not be shared. You will be required to change your Verify Code on first login. Contact your system administrator (IRM) if you need to reset your password or have questions about your account permissions.</p>
</body></html>`);
              printWindow.document.close();
              printWindow.print();
            }}
              title="Generate a printable account information letter for this staff member"
              className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-2 align-middle">print</span>
              Print Access Letter
            </button>
            {detailData.esigStatus === 'active' ? (
              <button disabled={clearingEsig} onClick={() => handleClearEsig(detailData.duz)}
                title="Removes this user's electronic signature code."
                className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-white rounded-lg transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px] mr-2 align-middle">backspace</span>
                {clearingEsig ? 'Clearing E-Signature...' : 'Clear E-Signature'}
              </button>
            ) : (
              <div className="w-full px-3 py-2 text-[13px] text-text-secondary italic">
                <span className="material-symbols-outlined text-[16px] mr-2 align-middle">info</span>
                E-signature not yet set
              </div>
            )}
          </div>
        </div>
        {/* ── Danger Zone ── */}
        <div>
          <div className="text-[9px] font-bold text-[#CC3333] uppercase tracking-wider mb-1.5">Danger Zone</div>
          <div className="space-y-1">
            {detailData.status === 'active' && (
              <button onClick={() => setDeactivateTarget(detailData)}
                title="Sets the DISUSER flag in VistA File #200, preventing this user from signing in."
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
                title="Clears the lockout counter, allowing the user to sign in again."
                className="w-full text-left px-3 py-2 text-[13px] text-[#2E5984] hover:bg-[#E8EEF5] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[16px] mr-2 align-middle">lock_open</span>
                Unlock Account
              </button>
            )}
            {(detailData.status === 'inactive' || detailData.status === 'terminated') && (
              <button onClick={() => handleReactivate(detailData.duz)}
                title="Clears the DISUSER flag and termination date, restoring the user's ability to sign in."
                className="w-full text-left px-3 py-2 text-[13px] text-[#2E7D32] hover:bg-[#E8F5E9] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[16px] mr-2 align-middle">check_circle</span>
                Reactivate
              </button>
            )}
            {detailData.status === 'active' && (
              <button onClick={() => setTerminateTarget(detailData)}
                title="Full account termination: clears credentials, removes keys, sets DISUSER flag permanently."
                className="w-full text-left px-3 py-2 text-[13px] text-[#CC3333] hover:bg-[#FDE8E8] rounded-lg transition-colors font-medium">
                <span className="material-symbols-outlined text-[16px] mr-2 align-middle">person_off</span>
                Full Termination
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* L006: Permissions list with collapse for >10 keys */
function PermissionsList({ detailKeys, handleOpenAssignPerms, handleRemovePermission, assignedRole }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSE_THRESHOLD = 10;

  // P3.4: Determine which keys came from the role template
  const roleTemplate = assignedRole ? ROLES.find(r => r.id === assignedRole || r.name === assignedRole) : null;
  const roleKeySet = new Set(roleTemplate ? roleTemplate.permissions.map(p => p.key) : []);

  const grouped = Object.entries(
    detailKeys.reduce((groups, k) => {
      const dept = k.department || k.packageName || 'General';
      (groups[dept] = groups[dept] || []).push(k);
      return groups;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));

  const allKeys = grouped.flatMap(([, keys]) => keys);
  const shouldCollapse = allKeys.length > COLLAPSE_THRESHOLD && !expanded;

  let visibleCount = 0;
  return (
    <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider">
          Permissions ({detailKeys.length})
        </h3>
        <button onClick={handleOpenAssignPerms}
          className="text-[10px] text-[#2E5984] hover:underline">+ Assign</button>
      </div>
      <div className="space-y-2">
        {grouped.map(([dept, keys]) => {
          const keysToRender = [];
          for (const k of keys) {
            if (shouldCollapse && visibleCount >= COLLAPSE_THRESHOLD) break;
            visibleCount++;
            keysToRender.push(k);
          }
          if (keysToRender.length === 0) return null;
          return (
            <div key={dept}>
              <div className="text-[9px] font-bold text-[#999] uppercase tracking-wider mb-1">{dept}</div>
              <div className="flex flex-wrap gap-1">
                {keysToRender.map(k => (
                  <span key={k.ien || k.name} title={`System key: ${k.name}${roleKeySet.has(k.name) ? ' (from role template)' : ' (individually assigned)'}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded ${roleKeySet.has(k.name) ? 'bg-[#E8EEF5] text-[#2E5984]' : 'bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]'}`}>
                    {k.displayName || humanizeKeyName(k.name)}
                    {roleKeySet.size > 0 && (
                      <span className={`text-[8px] font-bold ml-0.5 ${roleKeySet.has(k.name) ? 'text-[#5A8BBF]' : 'text-[#E65100]'}`}>
                        {roleKeySet.has(k.name) ? 'R' : 'I'}
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleRemovePermission(k); }}
                      className="text-[#999] hover:text-[#CC3333] ml-0.5" title="Remove" aria-label={`Remove permission ${k.displayName || k.name}`}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {allKeys.length > COLLAPSE_THRESHOLD && (
        <button onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="mt-2 text-[10px] text-[#2E5984] hover:underline">
          {expanded ? 'Show fewer' : `Show all ${allKeys.length} permissions`}
        </button>
      )}
    </div>
  );
}

/* P3.12: CPRS Tab Access with toggle */
function CprsTabList({ cprsTabData, setCprsTabData, duz }) {
  const [saving, setSaving] = useState(null);
  const [tabError, setTabError] = useState(null);
  const handleToggle = async (tab) => {
    const newAccess = tab.access === 'Disabled' ? '' : 'Disabled';
    setSaving(tab.name);
    setTabError(null);
    try {
      await updateCprsTabAccess(duz, tab.name, newAccess);
      setCprsTabData(prev => prev.map(t => t.name === tab.name ? { ...t, access: newAccess } : t));
    } catch (err) { setTabError(err.message || 'Failed to update tab'); }
    finally { setSaving(null); }
  };
  return (
    <div className="bg-white rounded-lg p-4 border border-[#E2E4E8]">
      <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider mb-2">CPRS Tab Access</h3>
      {tabError && <p className="text-[10px] text-[#CC3333] mb-1">{tabError}</p>}
      <div className="space-y-1">
        {cprsTabData.map((tab, idx) => (
          <div key={tab.name || idx} className="flex items-center justify-between text-xs py-1 border-b border-[#F0F0F0]">
            <span className="font-medium">{tab.name || tab.tabName || '—'}</span>
            <button onClick={() => handleToggle(tab)}
              disabled={saving === tab.name}
              aria-label={`${tab.name || tab.tabName}: ${tab.access === 'Disabled' ? 'Disabled' : 'Enabled'}. Click to toggle.`}
              aria-pressed={tab.access !== 'Disabled'}
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                tab.access === 'Disabled'
                  ? 'bg-[#FFEBEE] text-[#CC3333] hover:bg-[#FFCDD2]'
                  : 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]'
              }`}>
              {saving === tab.name ? '...' : (tab.access === 'Disabled' ? 'Disabled' : 'Enabled')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
