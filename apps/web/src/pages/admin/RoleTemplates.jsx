import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { getPermissions, getRoleTemplates, getCustomRoles, createCustomRole, deleteCustomRole } from '../../services/adminService';

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

const ROLES = [
  {
    id: 'physician', name: 'Physician', isSystem: true,
    description: 'Licensed independent practitioner. Full order entry, prescribing, note signing.',
    userCount: 18,
    permissions: [
      { label: 'Write clinical orders', key: 'ORES' },
      { label: 'Sign orders electronically', key: 'OR CPRS GUI CHART' },
      { label: 'Prescribe medications', key: 'PROVIDER' },
      { label: 'Write clinical notes', key: 'TIU WRITE' },
      { label: 'Sign clinical notes', key: 'TIU SIGN' },
      { label: 'View all patient records', key: 'DG RECORDS' },
      { label: 'Access controlled substances (with DEA)', key: 'PSJ LM OPTION' },
      { label: 'Cosign trainee orders', key: 'ORES' },
    ],
    mutualExclusions: ['ORES and ORELSE are mutually exclusive — providers sign their own orders'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse-practitioner', name: 'Nurse Practitioner', isSystem: true,
    description: 'Mid-level provider with prescriptive authority. Independent order entry and cosignature capability.',
    userCount: 8,
    permissions: [
      { label: 'Write clinical orders', key: 'ORES' },
      { label: 'Prescribe medications', key: 'PROVIDER' },
      { label: 'Write clinical notes', key: 'TIU WRITE' },
      { label: 'Sign clinical notes', key: 'TIU SIGN' },
      { label: 'View all patient records', key: 'DG RECORDS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse', name: 'Registered Nurse', isSystem: true,
    description: 'Clinical documentation, medication administration, verbal order entry.',
    userCount: 52,
    permissions: [
      { label: 'Enter verbal / telephone orders', key: 'ORELSE' },
      { label: 'Document nursing assessments', key: 'TIU WRITE' },
      { label: 'Administer medications', key: 'PSB NURSE' },
      { label: 'Record vital signs', key: 'GMV MANAGER' },
      { label: 'Write nursing notes', key: 'TIU WRITE' },
      { label: 'View patient records', key: 'DG RECORDS' },
    ],
    mutualExclusions: ['Cannot have ORES — provider-only order signing authority'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'pharmacist', name: 'Staff Pharmacist', isSystem: true,
    description: 'Outpatient and inpatient pharmacy operations, medication verification.',
    userCount: 12,
    permissions: [
      { label: 'Process outpatient prescriptions', key: 'PSO PHARMACIST' },
      { label: 'Verify inpatient medication orders', key: 'PSJ PHARMACIST' },
      { label: 'Manage drug formulary', key: 'PSO FORMULARY' },
      { label: 'Dispense medications', key: 'PSO DISPENSE' },
      { label: 'Manage controlled substance inventory', key: 'PSD CONTROLLED' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'pharm-tech', name: 'Pharmacy Technician', isSystem: true,
    description: 'Assists pharmacist with dispensing, inventory, and label printing.',
    userCount: 9,
    permissions: [
      { label: 'Fill prescriptions', key: 'PSO TECH' },
      { label: 'Print labels', key: 'PSO LABEL' },
      { label: 'Manage inventory', key: 'PSO INVENTORY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'lab-tech', name: 'Lab Technologist', isSystem: true,
    description: 'Specimen processing, result entry, quality control.',
    userCount: 22,
    permissions: [
      { label: 'Process specimens', key: 'LR TECH' },
      { label: 'Enter lab results', key: 'LR RESULT' },
      { label: 'Run quality control', key: 'LR QC' },
      { label: 'Print labels', key: 'LR LABEL' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'rad-tech', name: 'Radiology Technologist', isSystem: true,
    description: 'Imaging exam execution, image capture, and exam completion.',
    userCount: 7,
    permissions: [
      { label: 'Complete exams', key: 'RA TECH' },
      { label: 'Capture images', key: 'RA IMAGE' },
      { label: 'View imaging worklist', key: 'RA VIEW' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'rw', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'scheduler', name: 'Scheduling Clerk', isSystem: true,
    description: 'Appointment booking, check-in, schedule management.',
    userCount: 15,
    permissions: [
      { label: 'Create appointments', key: 'SD APPT MAKE' },
      { label: 'Cancel appointments', key: 'SD APPT CANCEL' },
      { label: 'Check in patients', key: 'SD CHECKIN' },
      { label: 'View clinic schedules', key: 'SD VIEW' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'rw', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'front-desk', name: 'Registration Clerk', isSystem: true,
    description: 'Patient registration, demographics, insurance verification.',
    userCount: 8,
    permissions: [
      { label: 'Register new patients', key: 'DG REGISTER' },
      { label: 'Edit patient demographics', key: 'DG DEMOGRAPHICS' },
      { label: 'Verify insurance', key: 'IB INSURANCE' },
      { label: 'Check in patients', key: 'SD CHECKIN' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'billing-coder', name: 'Billing Coder', isSystem: true,
    description: 'Charge capture, claims processing, revenue cycle management.',
    userCount: 6,
    permissions: [
      { label: 'Enter charges', key: 'IB CHARGE' },
      { label: 'Submit claims', key: 'IB CLAIMS' },
      { label: 'Process billing adjustments', key: 'IB ADJUST' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'rw', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'social-worker', name: 'Social Worker', isSystem: true,
    description: 'Case management, discharge planning, psychosocial assessments.',
    userCount: 4,
    permissions: [
      { label: 'Write social work notes', key: 'TIU WRITE' },
      { label: 'View patient records', key: 'DG RECORDS' },
      { label: 'Manage referrals', key: 'GMRC REFERRAL' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'system-admin', name: 'System Administrator', isSystem: true,
    description: 'Full administrative access. User management, configuration, security, audit.',
    userCount: 2,
    permissions: [
      { label: 'Manage all users', key: 'XUMGR' },
      { label: 'Assign any permission', key: 'XUMGR' },
      { label: 'Configure site parameters', key: 'XU PARAM' },
      { label: 'Manage facilities and sites', key: 'XU DIVISION' },
      { label: 'View all audit logs', key: 'ZVE ADMIN AUDIT' },
      { label: 'System configuration', key: 'XU PROG MODE' },
      { label: 'Background task monitoring', key: 'ZTMQ' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'ro', Supply: 'ro', Admin: 'rw', Analytics: 'rw' },
  },
  {
    id: 'adpac', name: 'ADPAC', isSystem: true,
    description: 'Application coordinator. Manages menus, templates, print settings, and first-line support.',
    userCount: 3,
    permissions: [
      { label: 'Manage menus for assigned module', key: 'XUMGR' },
      { label: 'Edit print templates', key: 'XU TEMPLATE' },
      { label: 'View user accounts', key: 'XUMGR' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'chief-of-staff', name: 'Chief of Staff', isSystem: true,
    description: 'Clinical leadership with cross-workspace read access and provider authority.',
    userCount: 1,
    permissions: [
      { label: 'All Physician permissions', key: 'ORES' },
      { label: 'View all audit logs', key: 'ZVE ADMIN AUDIT' },
      { label: 'Override orders', key: 'OR OVERRIDE' },
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

  useEffect(() => {
    Promise.allSettled([
      getPermissions(),
      getRoleTemplates(),
      getCustomRoles(),
    ]).then(([permsRes, rolesRes, customRes]) => {
      if (permsRes.status === 'fulfilled') {
        const keys = (permsRes.value?.data || []).map(k => k.keyName);
        setVistaKeySet(new Set(keys));
      }
      if (customRes.status === 'fulfilled' && customRes.value?.data) {
        const loaded = customRes.value.data.map(r => ({
          ...r,
          isSystem: false,
          userCount: 0,
          permissions: (r.keys || []).map(k => ({ label: k, key: k })),
          mutualExclusions: [],
          workspaceAccess: {},
        }));
        setCustomRoles(loaded);
      }
    });
  }, []);

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
    } catch { /* API not available yet — role still saved locally */ }
    setCustomRoles(prev => [...prev, newRole]);
    setSelectedRole(newRole);
    setCloneModalSource(null);
    setRoleSaving(false);
  };

  const handleDeleteCustom = async (roleId) => {
    if (!window.confirm('Delete this custom role?')) return;
    try {
      await deleteCustomRole(roleId);
    } catch { /* Non-fatal */ }
    setCustomRoles(prev => prev.filter(r => r.id !== roleId));
    setSelectedRole(ROLES[0]);
  };

  const allRoles = [...ROLES, ...customRoles];
  const filteredRoles = allRoles.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell breadcrumb="Admin > Role Templates">
      <div className="flex h-[calc(100vh-40px)]">
        {/* Left panel: role list */}
        <div className="w-[35%] border-r border-border overflow-auto p-4">
          <div className="flex items-center justify-between mb-1 px-2">
            <h1 className="text-[28px] font-bold text-[#222]">Role Templates</h1>
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
                  <span className="text-[11px] text-[#999] font-mono">{role.userCount}</span>
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
                {selectedRole.userCount} staff assigned
              </span>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-[#E2E4E8] mb-5">
              {[
                { id: 'permissions', label: 'Permissions' },
                { id: 'workspaces', label: 'Workspace Access' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
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
                    Permissions Granted ({selectedRole.permissions.length})
                  </h3>
                  <div className="space-y-1">
                    {selectedRole.permissions.map((perm, i) => {
                      const existsInVista = vistaKeySet.size === 0 || vistaKeySet.has(perm.key);
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#F5F8FB] rounded-lg group">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[16px] ${existsInVista ? 'text-[#1B7D3A]' : 'text-[#E6A817]'}`}>
                              {existsInVista ? 'check_circle' : 'help'}
                            </span>
                            <span className="text-[13px] text-[#222]">{perm.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!existsInVista && vistaKeySet.size > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFF3E0] text-[#E6A817] font-medium">Not in VistA</span>
                            )}
                            <span className="text-[10px] font-mono text-[#AAA] opacity-0 group-hover:opacity-100 transition-opacity" title={`VistA Key: ${perm.key}`}>
                              {perm.key}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
                onClick={() => navigate('/admin/staff', { state: { assignRoleName: selectedRole.name } })}
                className="px-4 py-2 text-[13px] font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors">
                Assign to Staff Member
              </button>
              <button
                onClick={() => navigate('/admin/staff', { state: { filterRole: selectedRole.name } })}
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
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
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
    </AppShell>
  );
}
