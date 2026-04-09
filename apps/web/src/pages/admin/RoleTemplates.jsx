import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getPermissions, getCustomRoles, createCustomRole, deleteCustomRole } from '../../services/adminService';

/**
 * AD-04: Role Templates (VistA Evolved Addition)
 *
 * Role templates are a VistA Evolved product concept — not stored in VistA.
 * The curated role definitions are client-side. We cross-reference with the
 * live key-inventory (689 keys) to validate which permissions actually exist.
 *
 * Live: GET /key-inventory → validates that referenced keys exist in VistA
 */

const ALL_WORKSPACES = [
  'Dashboard', 'Patients', 'Scheduling', 'Clinical', 'Pharmacy',
  'Lab', 'Imaging', 'Billing', 'Supply', 'Admin', 'Analytics',
];

// Role templates — every key below is a REAL VistA security key in #19.1.
// These templates are a Vista Evolved concept (not stored in VistA itself);
// they bundle assignable starter keys per role. The runtime render cross-
// references with the live /key-inventory and any missing key is hidden,
// not shown as a "pending install" badge.
const ROLES = [
  {
    id: 'physician', name: 'Physician', isSystem: true,
    description: 'Licensed independent practitioner. Full order entry, prescribing, note signing.',
    userCount: 0,
    permissions: [
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'Prescribe medications', key: 'PROVIDER' },
    ],
    mutualExclusions: ['A physician with order-signing authority cannot also hold verbal-order entry (that role is reserved for nursing staff).'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse-practitioner', name: 'Nurse Practitioner', isSystem: true,
    description: 'Mid-level provider with prescriptive authority. Independent order entry and cosignature capability.',
    userCount: 0,
    permissions: [
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'Prescribe medications', key: 'PROVIDER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse', name: 'Registered Nurse', isSystem: true,
    description: 'Clinical documentation, medication administration, verbal order entry.',
    userCount: 0,
    permissions: [
      { label: 'Enter verbal / telephone orders', key: 'ORELSE' },
      { label: 'Provider (for documentation authority)', key: 'PROVIDER' },
    ],
    mutualExclusions: ['A nurse with verbal-order authority cannot also hold physician order-signing authority.'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'ward-clerk', name: 'Ward Clerk / Unit Clerk', isSystem: true,
    description: 'MAS order entry — transcribes orders to the chart without signing authority.',
    userCount: 0,
    permissions: [
      { label: 'MAS order entry (chart-only, no signing)', key: 'OREMAS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'pharmacist', name: 'Staff Pharmacist', isSystem: true,
    description: 'Outpatient and inpatient pharmacy operations, medication verification.',
    userCount: 0,
    permissions: [
      { label: 'Outpatient pharmacy refill processing', key: 'PSORPH' },
      { label: 'Inpatient pharmacy verification', key: 'PSJ PHARMACIST' },
      { label: 'Outpatient pharmacy manager', key: 'PSO MANAGER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'controlled-substance-pharmacist', name: 'Controlled Substance Pharmacist', isSystem: true,
    description: 'Handles Schedule II-V dispensing, audit trails, and controlled-substance inventory.',
    userCount: 0,
    permissions: [
      { label: 'Controlled substances pharmacist', key: 'PSD PHARMACIST' },
      { label: 'Outpatient pharmacy refill processing', key: 'PSORPH' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'lab-tech', name: 'Lab Technologist', isSystem: true,
    description: 'Specimen processing, result entry, and verification.',
    userCount: 0,
    permissions: [
      { label: 'Laboratory technician', key: 'LRLAB' },
      { label: 'Result verification', key: 'LRVERIFY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'lab-supervisor', name: 'Lab Supervisor', isSystem: true,
    description: 'Oversees lab operations, workflow, and quality assurance.',
    userCount: 0,
    permissions: [
      { label: 'Laboratory supervisor', key: 'LRSUPER' },
      { label: 'Result verification', key: 'LRVERIFY' },
      { label: 'Laboratory technician', key: 'LRLAB' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'rad-tech', name: 'Radiology Technologist', isSystem: true,
    description: 'Performs imaging procedures and manages exam allocation.',
    userCount: 0,
    permissions: [
      { label: 'Radiology resource allocator', key: 'RA ALLOC' },
      { label: 'Imaging system access', key: 'MAG SYSTEM' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'rw', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'scheduler', name: 'Scheduling Clerk', isSystem: true,
    description: 'Appointment booking, check-in, schedule management.',
    userCount: 0,
    permissions: [
      { label: 'Scheduling manager', key: 'SDMGR' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'rw', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'scheduling-supervisor', name: 'Scheduling Supervisor', isSystem: true,
    description: 'Override closures, manage no-shows, oversee clinic schedules.',
    userCount: 0,
    permissions: [
      { label: 'Scheduling supervisor', key: 'SD SUPERVISOR' },
      { label: 'Scheduling manager', key: 'SDMGR' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'rw', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'front-desk', name: 'Registration Clerk', isSystem: true,
    description: 'Patient registration and demographics.',
    userCount: 0,
    permissions: [
      { label: 'Patient registration clerk', key: 'DG REGISTER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'adt-coordinator', name: 'ADT Coordinator', isSystem: true,
    description: 'Manages admissions, transfers, discharges, and ADT workflow.',
    userCount: 0,
    permissions: [
      { label: 'ADT coordinator', key: 'DG MENU' },
      { label: 'Patient registration clerk', key: 'DG REGISTER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'ro', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'adt-supervisor', name: 'ADT Supervisor', isSystem: true,
    description: 'Oversight of patient movement, restricted records, and discharge workflow.',
    userCount: 0,
    permissions: [
      { label: 'ADT supervisor', key: 'DG SUPERVISOR' },
      { label: 'ADT coordinator', key: 'DG MENU' },
      { label: 'Sensitive patient access', key: 'DG SENSITIVITY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'ro', Supply: 'none', Admin: 'ro', Analytics: 'rw' },
  },
  {
    id: 'system-admin', name: 'System Administrator', isSystem: true,
    description: 'Full administrative access: user management, configuration, security, audit.',
    userCount: 0,
    permissions: [
      { label: 'System administrator (full user management)', key: 'XUMGR' },
      { label: 'System programmer (advanced access)', key: 'XUPROG' },
      { label: 'Advanced diagnostic access', key: 'XUPROGMODE' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'ro', Supply: 'ro', Admin: 'rw', Analytics: 'rw' },
  },
  {
    id: 'chief-of-staff', name: 'Chief of Staff', isSystem: true,
    description: 'Clinical leadership with cross-workspace read access and provider authority.',
    userCount: 0,
    permissions: [
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'Prescribe medications', key: 'PROVIDER' },
      { label: 'Sensitive patient access', key: 'DG SENSITIVITY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'ro', Supply: 'none', Admin: 'ro', Analytics: 'rw' },
  },
];

const ACCESS_LABELS = { rw: 'Read & Write', ro: 'Read Only', none: 'No Access' };
const ACCESS_COLORS = { rw: 'bg-[#E6F4EA] text-[#1B7D3A]', ro: 'bg-[#E8EEF5] text-[#2E5984]', none: 'bg-[#F5F5F5] text-[#999]' };

export default function RoleTemplates() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('permissions');
  const [vistaKeySet, setVistaKeySet] = useState(new Set());
  const [customRoles, setCustomRoles] = useState([]);
  const [cloneModalSource, setCloneModalSource] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState(null);

  const [keyHolderMap, setKeyHolderMap] = useState({});
  // Server-enriched key data: keyName → { displayName, description, department }
  const [keyEnrichMap, setKeyEnrichMap] = useState({});

  useEffect(() => {
    Promise.allSettled([
      getPermissions(),
      getCustomRoles(),
    ]).then(([permsRes, customRes]) => {
      let eMap = {};
      if (permsRes.status === 'fulfilled') {
        const permsData = permsRes.value?.data || [];
        const keys = permsData.map(k => k.keyName);
        setVistaKeySet(new Set(keys));
        const hMap = {};
        permsData.forEach(k => {
          hMap[k.keyName] = k.holderCount || 0;
          eMap[k.keyName] = {
            displayName: k.displayName || k.descriptiveName || '',
            description: k.description || '',
            department: k.department || k.packageName || '',
          };
        });
        setKeyHolderMap(hMap);
        setKeyEnrichMap(eMap);
      }
      if (customRes.status === 'fulfilled' && customRes.value?.data) {
        const loaded = customRes.value.data.map(r => ({
          ...r,
          isSystem: false,
          userCount: 0,
          permissions: (r.keys || []).map(k => ({
            label: eMap[k]?.displayName || k,
            key: k,
          })),
          mutualExclusions: [],
          workspaceAccess: {},
        }));
        setCustomRoles(loaded);
      }
      if (permsRes.status === 'rejected' && customRes.status === 'rejected') {
        setError('Failed to load role data. Please try refreshing.');
      }
    });
  }, []);

  const getRoleHolderCount = (role) => {
    if (Object.keys(keyHolderMap).length === 0) return role.userCount;
    // Count minimum holders across all role keys (intersection estimate)
    const counts = role.permissions.map(p => keyHolderMap[p.key] || 0).filter(c => c > 0);
    return counts.length > 0 ? Math.min(...counts) : 0;
  };

  const handleClone = (sourceRole) => {
    setCloneModalSource(sourceRole);
    setCloneName(`${sourceRole.name} (Copy)`);
  };

  const confirmClone = async () => {
    if (!cloneName.trim() || !cloneModalSource) return;
    setRoleSaving(true);
    const newRole = {
      ...cloneModalSource,
      id: `custom-${Date.now()}`,
      name: cloneName.trim(),
      isSystem: false,
      userCount: 0,
    };
    try {
      const res = await createCustomRole({
        name: newRole.name,
        description: newRole.description,
        keys: newRole.permissions.map(p => p.key),
      });
      if (res?.id) newRole.id = res.id;
      setCustomRoles(prev => [...prev, newRole]);
      setSelectedRole(newRole);
    } catch (err) {
      setError(err.message || 'Failed to create role');
    }
    setCloneModalSource(null);
    setRoleSaving(false);
  };

  const handleDeleteCustom = async (roleId) => {
    setDeleteTarget(roleId);
  };

  const confirmDeleteCustom = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomRole(deleteTarget);
      setCustomRoles(prev => prev.filter(r => r.id !== deleteTarget));
      setSelectedRole(ROLES[0]);
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    }
    setDeleteTarget(null);
  };

  const allRoles = [...ROLES, ...customRoles];
  const filteredRoles = allRoles.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell breadcrumb="Admin > Role Templates">
      {error && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4" aria-label="Dismiss error">&times;</button>
        </div>
      )}
      <div className="flex h-[calc(100vh-40px)]">
        {/* Left panel: role list */}
        <div className="w-[35%] border-r border-border overflow-auto p-4">
          <div className="flex items-center justify-between mb-1 px-2">
            <h1 className="text-[22px] font-bold text-[#222]">Role Templates</h1>
          </div>
          <p className="text-[13px] text-[#666] mb-3 px-2">
            Roles bundle permissions into assignable templates. Assign a role instead of
            individual permissions for consistency across your organization.
          </p>
          <div className="px-2 mb-3">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search roles..."
              className="w-full px-3 py-2 text-[13px] border border-[#E2E4E8] rounded-md focus:ring-2 focus:ring-[#2E5984]/30 focus:border-[#2E5984] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            {filteredRoles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedRole.id === role.id ? 'bg-[#E8EEF5] border border-[#2E5984]' : 'hover:bg-[#F5F8FB] border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[13px] text-[#222]">{role.name}</div>
                    {role.isSystem && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8EEF5] text-[#2E5984] uppercase font-semibold">Built-in</span>}
                  </div>
                  <span className="text-[11px] text-[#999] font-mono">{getRoleHolderCount(role)}</span>
                </div>
                <div className="text-[11px] text-[#666] mt-0.5 line-clamp-1">{role.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 px-2">
            <button
              onClick={() => handleClone(selectedRole)}
              className="w-full py-2.5 text-[13px] font-medium text-[#2E5984] border-2 border-dashed border-[#2E5984]/30 rounded-md hover:bg-[#E8EEF5] transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">add</span>
              Create Custom Role
            </button>
          </div>
        </div>

        {/* Right panel: role detail */}
        <div className="w-[65%] overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[22px] font-bold text-[#222]">{selectedRole.name}</h2>
                  {selectedRole.isSystem && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#E8EEF5] text-[#2E5984] font-semibold">BUILT-IN</span>
                  )}
                </div>
                <p className="text-[13px] text-[#666] mt-1">{selectedRole.description}</p>
              </div>
              <span className="px-3 py-1 bg-[#F5F8FB] rounded-full text-[12px] font-mono text-[#666]">
                {getRoleHolderCount(selectedRole)} staff assigned
              </span>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-[#E2E4E8] mb-5" role="tablist">
              {[
                { id: 'permissions', label: 'Permissions' },
                { id: 'staff', label: 'Staff' },
                { id: 'workspaces', label: 'Workspace Access' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  role="tab" aria-selected={activeTab === t.id}
                  className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === t.id ? 'border-[#2E5984] text-[#2E5984]' : 'border-transparent text-[#666] hover:text-[#222]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Permissions tab */}
            {activeTab === 'permissions' && (
              <>
                <section className="mb-6">
                  <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">
                    Permissions Granted
                  </h3>
                  <div className="space-y-1">
                    {(() => {
                      const validPerms = selectedRole.permissions.filter(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key));
                      // Group by department
                      const groups = {};
                      for (const perm of validPerms) {
                        const dept = keyEnrichMap[perm.key]?.department || 'General';
                        if (!groups[dept]) groups[dept] = [];
                        groups[dept].push(perm);
                      }
                      const deptEntries = Object.entries(groups);
                      if (deptEntries.length === 0) {
                        return <p className="text-[12px] text-[#999] italic px-3 py-2">No permissions in this role are available in the current system.</p>;
                      }
                      return deptEntries.map(([dept, perms]) => (
                        <div key={dept} className="mb-3">
                          {deptEntries.length > 1 && (
                            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-3 py-1">{dept}</div>
                          )}
                          {perms.map((perm, i) => {
                            const enriched = keyEnrichMap[perm.key];
                            const displayName = enriched?.displayName || perm.label;
                            const description = enriched?.description || '';
                            return (
                              <div key={i} className="px-3 py-2.5 bg-[#F5F8FB] rounded-lg mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-[#1B7D3A]">check_circle</span>
                                  <span className="text-[13px] font-medium text-[#222]">{displayName}</span>
                                </div>
                                {description && <div className="text-[11px] text-[#666] ml-6 mt-0.5">{description}</div>}
                                <details className="ml-6 mt-0.5">
                                  <summary className="text-[9px] text-[#BBB] cursor-pointer hover:text-[#888]">System reference</summary>
                                  <div className="text-[10px] font-mono text-[#AAA] mt-0.5">{perm.key}</div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </section>

                {selectedRole.mutualExclusions.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">Mutual Exclusion Rules</h3>
                    {selectedRole.mutualExclusions.map(rule => (
                      <div key={rule} className="flex items-start gap-2 px-3 py-2 bg-[#FFF8E1] rounded-lg border border-[#FFD54F]">
                        <span className="material-symbols-outlined text-[#F5A623] text-[16px] mt-0.5">warning</span>
                        <span className="text-[13px] text-[#222]">{rule}</span>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}

            {/* Staff tab — shows who holds this role */}
            {activeTab === 'staff' && (
              <section className="mb-6">
                <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">
                  Staff Members with This Role
                </h3>
                {(() => {
                  const holderCount = getRoleHolderCount(selectedRole);
                  if (holderCount === 0) {
                    return (
                      <div className="text-center py-8 text-sm text-[#999]">
                        <span className="material-symbols-outlined text-[32px] block mb-2">group_off</span>
                        No staff members currently hold all permissions in this role.
                      </div>
                    );
                  }
                  // Show per-key holder counts as a breakdown
                  return (
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-[#E8F5E9] rounded-lg text-[13px] text-[#2D6A4F] flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[16px]">people</span>
                        Approximately {holderCount} staff member{holderCount !== 1 ? 's' : ''} hold this role (based on permission intersection).
                      </div>
                      <h4 className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mt-3 mb-2">Per-Permission Breakdown</h4>
                      {selectedRole.permissions.map((perm, i) => {
                        const count = keyHolderMap[perm.key] || 0;
                        const enriched = keyEnrichMap[perm.key];
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#F5F8FB] rounded-lg">
                            <span className="text-[12px] text-[#222]">{enriched?.displayName || perm.label}</span>
                            <span className="text-[11px] font-mono text-[#666]">{count} holder{count !== 1 ? 's' : ''}</span>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const firstKey = selectedRole.permissions.find(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key))?.key;
                          navigate(firstKey ? `/admin/permissions?view=${encodeURIComponent(firstKey)}` : '/admin/permissions');
                        }}
                        className="mt-3 px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-white transition-colors">
                        <span className="material-symbols-outlined text-[14px] mr-1 align-middle">open_in_new</span>
                        View Full Staff List in Permission Catalog
                      </button>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Workspace access tab with toggles */}
            {activeTab === 'workspaces' && (
              <section className="mb-6">
                <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">
                  Workspace Visibility & Page-Level Access
                </h3>
                <div className="space-y-2">
                  {ALL_WORKSPACES.map(ws => {
                    const access = selectedRole.workspaceAccess?.[ws] || 'none';
                    return (
                      <div key={ws} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${access !== 'none' ? 'border-[#E2E4E8] bg-white' : 'border-transparent bg-[#FAFAFA]'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${access === 'rw' ? 'bg-[#1B7D3A]' : access === 'ro' ? 'bg-[#2E5984]' : 'bg-[#DDD]'}`} />
                          <span className={`text-[13px] ${access !== 'none' ? 'text-[#222] font-medium' : 'text-[#999]'}`}>{ws}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${ACCESS_COLORS[access]}`}>
                          {ACCESS_LABELS[access]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="flex gap-3 pt-4 border-t border-[#E2E4E8]">
              <button
                onClick={() => {
                  // Navigate to the catalog with the role's primary key
                  // pre-selected, which opens the catalog's assign flow.
                  const firstAvailableKey = selectedRole.permissions.find(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key))?.key;
                  if (firstAvailableKey) {
                    navigate(`/admin/permissions?assign=${encodeURIComponent(firstAvailableKey)}`);
                  } else {
                    navigate('/admin/permissions');
                  }
                }}
                className="px-4 py-2 text-[13px] font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors">
                Assign to Staff Member
              </button>
              <button
                onClick={() => {
                  // Navigate to the catalog filtered to the role's primary key
                  // so the operator can see which staff currently hold it.
                  const firstAvailableKey = selectedRole.permissions.find(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key))?.key;
                  if (firstAvailableKey) {
                    navigate(`/admin/permissions?view=${encodeURIComponent(firstAvailableKey)}`);
                  } else {
                    navigate('/admin/permissions');
                  }
                }}
                className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors">
                View Staff with This Role
              </button>
              <button
                onClick={() => handleClone(selectedRole)}
                className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors">
                <span className="material-symbols-outlined text-[14px] mr-1 align-middle">content_copy</span>
                Clone Role
              </button>
              {!selectedRole.isSystem && (
                <button
                  onClick={() => handleDeleteCustom(selectedRole.id)}
                  className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] text-[#CC3333] transition-colors">
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clone Role Modal */}
      {cloneModalSource && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCloneModalSource(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" role="dialog" aria-modal="true" aria-label="Clone Role" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#222] mb-3">Clone Role</h3>
            <p className="text-xs text-[#666] mb-4">
              Create a new custom role based on "{cloneModalSource.name}". The new role will inherit all permissions and workspace access.
            </p>
            <label className="block text-xs font-medium text-[#222] mb-1">New Role Name</label>
            <input type="text" value={cloneName} onChange={e => setCloneName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCloneModalSource(null)}
                className="px-4 py-2 text-xs border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">Cancel</button>
              <button onClick={confirmClone} disabled={!cloneName.trim() || roleSaving}
                className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                {roleSaving ? 'Saving…' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Role"
          message="Delete this custom role? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDeleteCustom}
          onCancel={() => setDeleteTarget(null)}
          destructive
        />
      )}
    </AppShell>
  );
}
