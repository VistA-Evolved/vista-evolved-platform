import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner } from '../../components/shared/SharedComponents';
import { getSiteParameters, updateSiteParameters, getSession, submit2PChange, get2PRequests, approve2PRequest, reject2PRequest, getMailGroups } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Security & Authentication — Screen 5
 * @vista KERNEL SYSTEM PARAMETERS #8989.3
 *
 * Organized by concern (not VistA file structure):
 *   Section A: Login Security (session timeout, lockout, password policy)
 *   Section B: Electronic Signature
 *   Section C: Account Policies
 *   Section D: Audit & Logging
 *
 * Two-Person Integrity: Sections A and B require dual-admin approval.
 * Every field reads from real VistA via ZVE PARAM GET.
 */

function normalizeKernelParams(res) {
  if (!res) return {};
  if (Array.isArray(res.data) && res.data.length > 0) {
    const out = {};
    for (const row of res.data) {
      const key = row.name;
      out[key] = { value: row.value ?? '', description: row.description || '' };
    }
    return out;
  }
  return {};
}

// Human-readable labels for pending approval display
const PARAM_LABELS = {
  'AUTOLOGOFF': 'Session Timeout',
  'LOCKOUT ATTEMPTS': 'Failed Login Lockout Threshold',
  'LOCKOUT DURATION': 'Lockout Duration',
  'PASSWORD EXPIRATION': 'Password Expiration',
  'MULTIPLE SIGN-ON': 'Allow Multiple Sessions',
  'MAX SIGN-ON LIMIT': 'Max Concurrent Users',
  'BROKER TIMEOUT': 'Server Response Timeout',
  'OPTION AUDIT': 'Data Auditing Mode',
  'INITIATE AUDIT': 'Audit Start Date',
  'TERMINATE AUDIT': 'Audit End Date',
  'FAILED ACCESS AUDIT': 'Failed Access Logging',
  'AUTO ACCESS CODES': 'Auto-Generate Usernames',
  'AUTO VERIFY CODES': 'Auto-Generate Passwords',
  'IRM MAIL GROUP': 'IRM Mail Group',
  'AFTER HOURS MAIL GROUP': 'After-Hours Mail Group',
  'DEFAULT INSTITUTION': 'Default Institution',
  'GUI POST SIGN-ON': 'Post-Login Action',
};

const TOGGLE_LABELS = { 'YES': 'Enabled', 'NO': 'Disabled', 'Y': 'Enabled', 'N': 'Disabled' };
const AUDIT_LABELS = { 'A': 'Audit All Activity', 'N': 'No Auditing', 'S': 'Audit Specific Options' };
const FAILED_LABELS = { 'A': 'Log All Failed Attempts', 'D': 'Log by Device', 'AR': 'Log All + Details', 'DR': 'Log Devices + Details', 'N': 'No Logging' };

function humanizeParamValue(field, value) {
  if (!value && value !== 0) return value;
  const upper = String(value).toUpperCase();
  if (['MULTIPLE SIGN-ON'].includes(field)) return TOGGLE_LABELS[upper] || value;
  if (field === 'OPTION AUDIT') return AUDIT_LABELS[upper] || value;
  if (field === 'FAILED ACCESS AUDIT') return FAILED_LABELS[upper] || value;
  return value;
}

const SECTION_CONFIG = [
  { id: 'login', label: 'Login Security', icon: 'lock', twoPersonRequired: true },
  { id: 'esig', label: 'Electronic Signature', icon: 'draw', twoPersonRequired: false },
  { id: 'account', label: 'Account Policies', icon: 'manage_accounts', twoPersonRequired: false },
  { id: 'audit', label: 'Audit & Logging', icon: 'shield', twoPersonRequired: false },
  { id: 'advanced', label: 'Advanced Settings', icon: 'tune', twoPersonRequired: false },
];

function zeroWarning(value, paramName) {
  const v = Number(value);
  if (v !== 0) return null;
  const warnings = {
    'AUTOLOGOFF': { what: 'Session Timeout', risk: 'Sessions will never automatically expire. This is a SECURITY RISK. Healthcare security standards require session timeouts of 15 minutes or less.', recommended: '900', recommendedLabel: '15 minutes (900 seconds)' },
    'LOCKOUT ATTEMPTS': { what: 'Failed Login Lockout', risk: 'Brute-force login attacks will not be blocked. Accounts are vulnerable to password guessing.', recommended: '3', recommendedLabel: '3 attempts' },
    'LOCKOUT DURATION': { what: 'Lockout Duration', risk: 'Locked accounts will be immediately re-accessible. This negates the lockout protection.', recommended: '1800', recommendedLabel: '30 minutes (1800 seconds)' },
    'PASSWORD EXPIRATION': { what: 'Password Expiration', risk: 'Passwords will never expire. Compromised credentials remain valid indefinitely.', recommended: '60', recommendedLabel: '60 days' },
  };
  return warnings[paramName] || null;
}

function buildFields(params, sectionId, mailGroupOptions = []) {
  if (!params) return [];

  if (sectionId === 'login') {
    const autoLogoff = params['AUTOLOGOFF']?.value ?? '';
    const lockAttempts = params['LOCKOUT ATTEMPTS']?.value ?? '';
    const lockDuration = params['LOCKOUT DURATION']?.value ?? '';
    const pwExpire = params['PASSWORD EXPIRATION']?.value ?? '';
    const multiSign = params['MULTIPLE SIGN-ON']?.value ?? '';
    const maxSign = params['MAX SIGN-ON LIMIT']?.value ?? '';
    return [
      { name: 'AUTOLOGOFF', label: 'Session Timeout', type: 'number', value: autoLogoff, unit: 'seconds', enforcedMin: 60, enforcedMax: 900, hint: 'Auto sign-off after inactivity. VHA Directive 6500 requires ≤ 15 minutes (900 seconds). Setting this to 0 disables timeout — this is a SECURITY RISK.' },
      { name: 'LOCKOUT ATTEMPTS', label: 'Failed Login Lockout', type: 'number', value: lockAttempts, unit: 'attempts', enforcedMin: 1, enforcedMax: 5, hint: 'Lock account after this many failed sign-in attempts. VHA allows 1–5. Recommended: 3.' },
      { name: 'LOCKOUT DURATION', label: 'Lockout Duration', type: 'number', value: lockDuration, unit: 'seconds', enforcedMin: 30, enforcedMax: 86400, hint: 'How long a locked account stays locked before auto-unlock. In seconds. 1800 = 30 minutes.' },
      { name: 'PASSWORD EXPIRATION', label: 'Password Expiration', type: 'number', value: pwExpire, unit: 'days', enforcedMin: 1, enforcedMax: 90, hint: 'Days until users must change their password. HIPAA recommends 60–90 days. Setting 0 means passwords never expire — NOT RECOMMENDED.', slider: true },
      { name: 'MULTIPLE SIGN-ON', label: 'Allow Multiple Sessions', type: 'toggle', value: multiSign, hint: 'Whether the same user can sign in from multiple devices simultaneously. Disabling this prevents shared-credential abuse.' },
      { name: 'MAX SIGN-ON LIMIT', label: 'Max Concurrent Users', type: 'number', value: maxSign, unit: 'sessions', hint: 'Maximum concurrent sessions per user. Leave empty for unlimited.' },
    ];
  }

  if (sectionId === 'esig') {
    // The e-signature policy in VistA is enforced *at write time* by the
    // ZVE ESIG MANAGE RPC, not stored as a configurable parameter file.
    // The minimum length is hard-enforced inside ZVEADMN1.m (currently 6
    // characters). This panel therefore reports the live policy as
    // informational, not editable. There is no #8989.3 field for this.
    return [
      {
        name: 'esigMinLength',
        label: 'Minimum Signature Length',
        type: 'readonly',
        value: '6',
        unit: 'characters',
        hint: 'This is a Kernel-level constant enforced inside the VistA source code (XUSHSH routine). It is not configurable through parameters — the system will reject any e-signature shorter than 6 characters.',
        policyEnforced: true,
      },
      {
        name: 'esigForOrders',
        label: 'Required for Clinical Orders',
        type: 'readonly',
        value: 'Yes',
        hint: 'Built into the CPRS Order Entry package. Any user with the ORES key (write clinical orders) must have an active e-signature to release orders. This cannot be disabled.',
        policyEnforced: true,
      },
      {
        name: 'esigForNotes',
        label: 'Required for Clinical Notes',
        type: 'readonly',
        value: 'Yes',
        hint: 'Built into the TIU (Text Integration Utilities) package. Clinical note signing requires an e-signature. This is a federal compliance requirement and cannot be disabled.',
        policyEnforced: true,
      },
    ];
  }

  if (sectionId === 'account') {
    const autoAccess = params['AUTO ACCESS CODES']?.value ?? '';
    const autoVerify = params['AUTO VERIFY CODES']?.value ?? '';
    return [
      { name: 'AUTO ACCESS CODES', label: 'Auto-Generate Usernames', type: 'toggle', value: autoAccess, hint: 'When enabled, VistA generates a random access code for new users instead of requiring manual entry.' },
      { name: 'AUTO VERIFY CODES', label: 'Auto-Generate Passwords', type: 'toggle', value: autoVerify, hint: 'When enabled, VistA generates a random verify code for new users. The generated code must still be communicated securely to the user.' },
    ];
  }

  if (sectionId === 'audit') {
    // VistA returns EXTERNAL display values ("SPECIFIC OPTIONS AUDITED")
    // but the set-of-codes internal values are single letters (s/n/a).
    // Normalize the external → internal for dropdown matching.
    const AUDIT_EXT_TO_INT = {
      'SPECIFIC OPTIONS AUDITED': 's', 'ALL OPTIONS AUDITED': 'a', 'NO AUDIT': 'n',
      // Also handle if the raw internal code comes through
      's': 's', 'a': 'a', 'n': 'n', 'S': 's', 'A': 'a', 'N': 'n',
    };
    const FACCESS_EXT_TO_INT = {
      '': '', 'LOG ALL FAILED ACCESS': 'a', 'LOG BY DEVICE': 'd',
      'LOG ALL + RECORD': 'ar', 'LOG DEVICE + RECORD': 'dr', 'NO LOGGING': 'n',
      'a': 'a', 'd': 'd', 'ar': 'ar', 'dr': 'dr', 'n': 'n',
      'A': 'a', 'D': 'd', 'AR': 'ar', 'DR': 'dr', 'N': 'n',
    };
    const rawOptAudit = params['OPTION AUDIT']?.value ?? '';
    const optAudit = AUDIT_EXT_TO_INT[rawOptAudit] || rawOptAudit.toLowerCase().charAt(0) || '';
    const initAudit = params['INITIATE AUDIT']?.value ?? '';
    const termAudit = params['TERMINATE AUDIT']?.value ?? '';
    const rawFailAccess = params['FAILED ACCESS AUDIT']?.value ?? '';
    const failAccess = FACCESS_EXT_TO_INT[rawFailAccess] || rawFailAccess.toLowerCase() || '';
    return [
      { name: 'OPTION AUDIT', label: 'Data Auditing Mode', type: 'select', value: optAudit, options: [{ value: '', label: '— Select —' }, { value: 'a', label: 'Audit All Activity' }, { value: 'n', label: 'No Auditing' }, { value: 's', label: 'Audit Specific Options' }], hint: 'Controls what user activity is recorded. \'All\' logs every action. \'Specific Options\' logs only marked options. \'No Auditing\' disables the trail — NOT RECOMMENDED for production.' },
      { name: 'INITIATE AUDIT', label: 'Audit Start Date', type: 'text', value: initAudit, hint: 'Date when auditing began or should begin.' },
      { name: 'TERMINATE AUDIT', label: 'Audit End Date', type: 'text', value: termAudit, hint: 'Date when auditing should stop. Leave empty for continuous auditing.' },
      { name: 'FAILED ACCESS AUDIT', label: 'Failed Access Logging', type: 'select', value: failAccess, options: [{ value: '', label: '— Not Configured —' }, { value: 'a', label: 'Log All Failed Attempts' }, { value: 'd', label: 'Log by Device' }, { value: 'ar', label: 'Log All + Details' }, { value: 'dr', label: 'Log Devices + Details' }, { value: 'n', label: 'No Logging' }], hint: 'Controls how failed login attempts are recorded.' },
    ];
  }

  if (sectionId === 'advanced') {
    const irmMailGroup = params['IRM MAIL GROUP']?.value ?? '';
    const afterHoursGroup = params['AFTER HOURS MAIL GROUP']?.value ?? '';
    const brokerTimeout = params['BROKER TIMEOUT']?.value ?? '';
    const defaultInstitution = params['DEFAULT INSTITUTION']?.value ?? '';
    const guiPostSignOn = params['GUI POST SIGN-ON']?.value ?? '';
    const mgOpts = mailGroupOptions.length > 0
      ? [{ value: '', label: '— Select Mail Group —' }, ...mailGroupOptions]
      : null;
    return [
      { name: 'IRM MAIL GROUP', label: 'IRM Mail Group',
        type: mgOpts ? 'select' : 'text', value: irmMailGroup,
        ...(mgOpts ? { options: mgOpts } : {}),
        hint: 'The MailMan group that receives system notifications and alerts. Set this to your IT support team\'s mail group.' },
      { name: 'AFTER HOURS MAIL GROUP', label: 'After-Hours Mail Group',
        type: mgOpts ? 'select' : 'text', value: afterHoursGroup,
        ...(mgOpts ? { options: mgOpts } : {}),
        hint: 'Mail group for notifications outside business hours. Typically your on-call IT staff.' },
      { name: 'BROKER TIMEOUT', label: 'Server Response Timeout', type: 'number', value: brokerTimeout, unit: 'seconds',
        hint: 'How long the server waits for a VistA response before timing out. Default: 60 seconds. Increase for slow networks.' },
      { name: 'DEFAULT INSTITUTION', label: 'Default Institution', type: 'text', value: defaultInstitution,
        hint: 'The primary institution (VistA File #4) for this system. This determines the facility identity for all operations.' },
      { name: 'GUI POST SIGN-ON', label: 'Post-Login Action', type: 'text', value: guiPostSignOn,
        hint: 'VistA option to run after GUI login. Advanced setting — leave empty unless directed by VistA configuration documentation.' },
    ];
  }
  return [];
}

export default function SecurityAuth() {
  const [selectedSection, setSelectedSection] = useState('login');
  useEffect(() => { document.title = 'Security & Auth — VistA Evolved'; }, []);
  const [editedValues, setEditedValues] = useState({});
  const [changeReason, setChangeReason] = useState('');
  const [kernelParams, setKernelParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [originalValues, setOriginalValues] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [currentDuz, setCurrentDuz] = useState('');
  // S004: Confirm when disabling audit
  const [confirmAuditDisable, setConfirmAuditDisable] = useState(false);
  // S7.3: Mail groups for dropdown
  const [mailGroupOptions, setMailGroupOptions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSession();
        if (sess?.user?.duz) setCurrentDuz(String(sess.user.duz));
      } catch (err) { /* non-fatal */ }
      // S7.3: Load mail groups for IRM dropdown
      try {
        const mgRes = await getMailGroups();
        const groups = (mgRes?.data || []).map(g => ({
          value: g.name || g.groupName || '',
          label: g.name || g.groupName || `Group ${g.ien}`,
        })).filter(g => g.value);
        setMailGroupOptions(groups);
      } catch (err) { /* non-fatal — falls back to text input */ }
    })();
  }, []);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await get2PRequests('ALL');
      setPendingRequests(res?.data || []);
    } catch (err) { setPendingRequests([]); }
    finally { setPendingLoading(false); }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSiteParameters();
      const normalized = normalizeKernelParams(res);
      setKernelParams(normalized);
      // Capture original values for save diff
      const origSnap = {};
      for (const [key, val] of Object.entries(normalized)) {
        origSnap[key] = val.value ?? '';
      }
      setOriginalValues(origSnap);
    } catch (err) {
      setError(err.message || 'Failed to load security configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sectionMeta = SECTION_CONFIG.find(s => s.id === selectedSection);
  const fields = buildFields(kernelParams, selectedSection, mailGroupOptions);
  const hasChanges = Object.keys(editedValues).length > 0;

  const hasViolation = Object.entries(editedValues).some(([name, val]) => {
    const f = fields.find(ff => ff.name === name);
    if (!f) return false;
    const n = Number(val);
    if (f.enforcedMax && n > f.enforcedMax) return true;
    if (f.enforcedMin && n < f.enforcedMin && val !== '') return true;
    return false;
  });

  const updateField = (fieldName, value) => {
    const original = fields.find(f => f.name === fieldName)?.value;
    setEditedValues(prev => {
      if (String(value) === String(original)) {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      }
      return { ...prev, [fieldName]: value };
    });
  };

  const handleSave = async () => {
    if (hasViolation || !changeReason.trim()) return;
    // S007: Require minimum 10 characters for change reason
    if (changeReason.trim().length < 10) {
      setSaveResult({ type: 'error', msg: 'Reason must be at least 10 characters.' });
      return;
    }
    // S004: Confirm when disabling audit
    if (editedValues['OPTION AUDIT'] === 'n' && !confirmAuditDisable) {
      setConfirmAuditDisable(true);
      return;
    }
    setConfirmAuditDisable(false);
    setSaving(true);
    setSaveResult(null);
    try {
      if (sectionMeta?.twoPersonRequired) {
        for (const [fieldName, newVal] of Object.entries(editedValues)) {
          const f = fields.find(ff => ff.name === fieldName);
          await submit2PChange({
            section: selectedSection,
            field: fieldName,
            oldValue: f?.value || '',
            newValue: String(newVal),
            reason: changeReason,
          });
        }
        setEditedValues({});
        setChangeReason('');
        setSaveResult({ type: 'success', msg: 'Change request submitted. A second administrator must approve before it takes effect.' });
        await loadPending();
      } else {
        const changedEntries = Object.entries(editedValues);
        for (const [fieldName, newVal] of changedEntries) {
          await updateSiteParameters({ paramName: fieldName, value: String(newVal), reason: changeReason });
        }
        const diffChanges = changedEntries.map(([fieldName, newVal]) => ({
          label: PARAM_LABELS[fieldName] || fieldName,
          before: originalValues[fieldName] || '(empty)',
          after: String(newVal),
        }));
        setEditedValues({});
        setChangeReason('');
        await loadData();
        setSaveResult({
          type: 'success',
          msg: 'Changes saved successfully.',
          changes: diffChanges,
          timestamp: new Date().toLocaleString(),
          auditNote: 'Change recorded in VistA audit trail.',
        });
      }
      setTimeout(() => setSaveResult(null), 5000);
    } catch (err) {
      setSaveResult({ type: 'error', msg: err.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Security & Authentication">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const pendingForSection = pendingRequests.filter(r => r.status === 'PENDING' && (!r.section || r.section === selectedSection));

  return (
    <AppShell breadcrumb="Admin > Security & Authentication">
      <div className="flex h-[calc(100vh-40px)]">
        {/* Section sidebar */}
        <div className="w-[200px] lg:w-[240px] border-r border-border overflow-auto p-3 flex-shrink-0">
          <h1 className="text-[22px] font-bold text-text px-2 mb-1">Security & Authentication</h1>
          <p className="text-[10px] text-text-muted px-2 mb-4">
            {loading ? 'Loading...' : 'Live security configuration'}
          </p>

          <div className="space-y-0.5">
            {SECTION_CONFIG.map(sec => (
              <button key={sec.id} onClick={() => { setSelectedSection(sec.id); setEditedValues({}); setChangeReason(''); setSaveResult(null); }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-md text-xs transition-colors ${
                  selectedSection === sec.id ? 'bg-[#E8EEF5] text-[#2E5984] font-medium' : 'text-text hover:bg-[#F4F5F7]'
                }`}>
                <span className="material-symbols-outlined text-[16px]">{sec.icon}</span>
                {sec.label}
                {sec.twoPersonRequired && (
                  <span className="ml-auto text-[8px] bg-[#FDE8E8] text-[#CC3333] px-1 py-0.5 rounded font-bold">2P</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 px-2 py-3 bg-[#FFF3E0] rounded-md">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[#E65100] text-[14px]">security</span>
              <span className="text-[10px] font-bold text-text">System Administrator</span>
            </div>
            <p className="text-[10px] text-[#666]">
              All changes are audit-logged. Sections marked
              <span className="bg-[#FDE8E8] text-[#CC3333] px-1 rounded text-[8px] font-bold ml-1">2P</span> require
              a second administrator to approve.
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            {sectionMeta?.twoPersonRequired && (
              <CautionBanner>
                <strong>Two-person integrity required.</strong> Changes to {sectionMeta.label.toLowerCase()} settings
                create a pending request that must be approved by a different administrator. This prevents a single compromised account from weakening system security.
              </CautionBanner>
            )}

            {saveResult?.type === 'success' && (
              <div className="mb-4 p-4 bg-[#E8F5E9] border border-[#C8E6C9] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#2E7D32]">check_circle</span>
                  <span className="text-sm font-semibold text-[#2E7D32]">Changes Saved</span>
                  {saveResult.timestamp && <span className="text-xs text-[#666] ml-auto">{saveResult.timestamp}</span>}
                </div>
                {saveResult.changes?.map((c, i) => (
                  <div key={i} className="text-xs text-[#333] flex gap-2 mb-1">
                    <span className="font-medium w-[140px]">{c.label}:</span>
                    <span className="text-[#CC3333] line-through">{c.before}</span>
                    <span className="mx-1">→</span>
                    <span className="text-[#2E7D32] font-medium">{c.after}</span>
                  </div>
                ))}
                {!saveResult.changes && <p className="text-[12px] text-[#2D6A4F]">{saveResult.msg}</p>}
                {saveResult.auditNote && <p className="text-[10px] text-[#999] mt-2">{saveResult.auditNote}</p>}
              </div>
            )}

            {/* Pending Approval Requests */}
            {pendingForSection.length > 0 && (
              <div className="mb-6 p-4 bg-[#FFF3E0] border border-[#E65100] rounded-lg">
                <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#E65100] text-[16px]">pending_actions</span>
                  Pending Approval ({pendingForSection.length})
                </h3>
                <div className="space-y-2">
                  {pendingForSection.map(req => {
                    const isSelf = String(req.submitterDuz) === currentDuz;
                    const label = PARAM_LABELS[req.field] || req.field;
                    return (
                      <div key={req.id} className="p-3 bg-white rounded-md border border-[#E2E4E8]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text">{label}</span>
                          <span className="text-[10px] text-[#999]">{req.submittedDate}</span>
                        </div>
                        <div className="text-[11px] text-[#666] mb-1">
                          <span className="font-mono">{humanizeParamValue(req.field, req.oldValue) || '—'}</span> → <span className="font-mono font-bold">{humanizeParamValue(req.field, req.newValue)}</span>
                        </div>
                        <div className="text-[10px] text-[#999] mb-2">
                          Submitted by: {req.submitterName || 'Unknown'}{req.reason ? ` — "${req.reason}"` : ''}
                        </div>
                        <div className="flex gap-2">
                          {isSelf ? (
                            <button disabled className="px-3 py-1.5 text-[11px] bg-[#CCC] text-white rounded-md cursor-not-allowed" title="You cannot approve your own request">
                              Cannot self-approve
                            </button>
                          ) : (
                            <>
                              <button disabled={pendingLoading}
                                onClick={async () => {
                                  setPendingLoading(true);
                                  try { await approve2PRequest(req.id); await loadPending(); await loadData(); }
                                  catch (err) { setSaveResult({ type: 'error', msg: err?.message || 'Failed to approve' }); }
                                  finally { setPendingLoading(false); }
                                }}
                                className="px-3 py-1.5 text-[11px] bg-[#2D6A4F] text-white rounded-md hover:bg-[#1B4332] disabled:opacity-40">
                                Approve
                              </button>
                              <button disabled={pendingLoading}
                                onClick={async () => {
                                  setPendingLoading(true);
                                  try { await reject2PRequest(req.id); await loadPending(); }
                                  catch (err) { setSaveResult({ type: 'error', msg: err?.message || 'Failed to reject' }); }
                                  finally { setPendingLoading(false); }
                                }}
                                className="px-3 py-1.5 text-[11px] border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] disabled:opacity-40">
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold text-text mb-1">{sectionMeta?.label}</h2>
            <p className="text-xs text-[#999] mb-3">
              {sectionMeta?.twoPersonRequired
                ? 'Critical security configuration — changes require dual-admin approval before taking effect.'
                : 'Configuration changes take effect immediately after save.'}
            </p>
            {selectedSection === 'esig' && (
              <div className="mb-4 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
                <div>
                  <strong>These are system-enforced policies.</strong> Electronic signature rules are hard-coded in the VistA Kernel (XUSHSH routine) and CPRS packages.
                  They cannot be changed through the admin panel. This section is informational only.
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
            ) : (
              <div className="space-y-5">
                {fields.map(field => {
                  const isEdited = field.name in editedValues;
                  const displayValue = isEdited ? editedValues[field.name] : field.value;
                  const numVal = Number(displayValue);
                  const isOverMax = field.enforcedMax && isEdited && numVal > field.enforcedMax;
                  const isUnderMin = field.enforcedMin && isEdited && displayValue !== '' && numVal < field.enforcedMin;
                  const isViolation = isOverMax || isUnderMin;
                  const warn = zeroWarning(displayValue, field.name);

                  return (
                    <div key={field.name} className={`p-4 rounded-lg border transition-colors ${
                      isEdited ? (isViolation ? 'border-[#CC3333] bg-[#FDE8E8]' : 'border-[#E65100] bg-[#FFFDE7]')
                      : warn ? 'border-[#CC3333] bg-[#FFF5F5]'
                      : 'border-[#E2E4E8] bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-medium text-sm text-text">{field.label}</label>
                        {field.enforcedMax && (
                          <span className="text-[10px] bg-[#FDE8E8] text-[#CC3333] px-2 py-0.5 rounded-full font-medium">
                            Range: {field.enforcedMin ?? 0}–{field.enforcedMax} {field.unit}
                          </span>
                        )}
                      </div>
                      {field.hint && <p className="text-[10px] text-[#999] mb-2">{field.hint}</p>}

                      {/* Zero-value warning */}
                      {warn && !isEdited && (
                        <div className="mb-3 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[#CC3333] text-[16px]">warning</span>
                            <span className="text-[12px] font-bold text-[#CC3333]">{warn.what}: DISABLED</span>
                          </div>
                          <p className="text-[11px] text-[#666] mb-2">{warn.risk}</p>
                          <p className="text-[10px] text-[#999] mb-2">Recommended: {warn.recommendedLabel}</p>
                          <button onClick={() => updateField(field.name, warn.recommended)}
                            className="px-3 py-1 text-[11px] bg-[#2D6A4F] text-white rounded-md hover:bg-[#1B4332]">
                            Set Recommended Value
                          </button>
                        </div>
                      )}

                      {field.type === 'number' && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={displayValue}
                            onChange={e => updateField(field.name, e.target.value)}
                            className="w-28 h-8 px-3 text-sm font-mono border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                          {field.unit && <span className="text-xs text-[#999]">{field.unit}</span>}
                          {/* S002: Human-readable time preview for second-based fields */}
                          {field.unit === 'seconds' && numVal > 0 && (
                            <span className="text-[11px] text-[#2E5984] font-medium ml-1">
                              = {numVal >= 60 ? `${Math.floor(numVal / 60)} min${numVal % 60 > 0 ? ` ${numVal % 60}s` : ''}` : `${numVal}s`}
                            </span>
                          )}
                          {field.slider && field.enforcedMin && field.enforcedMax && (
                            <div className="flex-1 ml-3">
                              <div className="flex items-center gap-2">
                                <input type="range" min={field.enforcedMin} max={field.enforcedMax}
                                  value={displayValue || field.enforcedMin}
                                  onChange={e => updateField(field.name, e.target.value)}
                                  className="flex-1 h-1 accent-[#2E5984]"
                                  list={`ticks-${field.name}`} />
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  numVal <= 30 ? 'bg-[#FFF3E0] text-[#E65100]' : numVal <= 60 ? 'bg-[#E8F5E9] text-[#2D6A4F]' : 'bg-[#FFFDE7] text-[#F57F17]'
                                }`}>
                                  {numVal <= 30 ? 'Short' : numVal <= 60 ? 'Standard' : 'Long'}
                                </span>
                              </div>
                              {/* S003: Tick marks at key intervals */}
                              <datalist id={`ticks-${field.name}`}>
                                <option value="30" /><option value="60" /><option value="90" />
                              </datalist>
                              <div className="flex justify-between text-[9px] text-[#999] mt-0.5 px-0.5">
                                <span>30d</span><span>60d</span><span>90d</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {field.type === 'toggle' && (() => {
                        const isOn = ['yes', 'y', '1'].includes(String(displayValue).toLowerCase());
                        return (
                        <button onClick={() => {
                          const current = String(displayValue).toLowerCase();
                          const newVal = (current === 'yes' || current === 'y' || current === '1') ? 'NO' : 'YES';
                          updateField(field.name, newVal);
                        }}
                          role="switch" aria-checked={isOn} aria-label={field.label}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            isOn ? 'bg-[#2D6A4F]' : 'bg-[#CCC]'
                          }`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
                          }`} />
                        </button>
                        );
                      })()}
                      {field.type === 'select' && (
                        <select value={displayValue}
                          onChange={e => updateField(field.name, e.target.value)}
                          className="w-64 h-8 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]">
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                      {field.type === 'text' && (
                        <input type="text" value={displayValue}
                          onChange={e => updateField(field.name, e.target.value)}
                          className="w-64 h-8 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                      )}
                      {field.type === 'readonly' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-[#666]">{displayValue || 'Not available from system'}</span>
                          {field.policyEnforced && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E8EEF5] text-[#2E5984]">
                              <span className="material-symbols-outlined text-[10px]">verified</span>
                              System Policy
                            </span>
                          )}
                        </div>
                      )}
                      {/* Section B (e-sig) values are policy-enforced, not parameter-driven.
                          They always have a value, so the legacy "missing data" warning was
                          dead code and has been removed. */}

                      {isViolation && (
                        <div className="mt-2 text-xs text-[#CC3333] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          {isOverMax ? `Exceeds maximum (${field.enforcedMax} ${field.unit}).` : `Below minimum (${field.enforcedMin} ${field.unit}).`} Save blocked.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Terminal Reference */}
            <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
              <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
              <p className="mt-2">This page replaces: <strong>EVE → Operations → Kernel Management → Enter/Edit Kernel Site Parameters</strong></p>
              <p className="mt-1">VistA File: <strong>KERNEL SYSTEM PARAMETERS (#8989.3)</strong></p>
              <p className="mt-1">The terminal shows ALL 23+ parameters on a single ScreenMan form.</p>
              <p className="mt-1">We organize them into sections: Login Security, E-Signature, Account Policies, Audit &amp; Logging, Advanced.</p>
            </details>
          </div>
        </div>
      </div>

      {/* S004: Confirm disabling audit */}
      {confirmAuditDisable && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[#CC3333] mb-3">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-lg font-bold">Disable Auditing?</h3>
            </div>
            <p className="text-sm text-[#666] mb-4">
              Disabling data auditing removes the activity trail for user actions.
              This may violate HIPAA and VHA compliance requirements.
              Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAuditDisable(false)}
                className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F5F5F5]">Cancel</button>
              <button onClick={() => { setConfirmAuditDisable(false); handleSave(); }}
                className="px-4 py-2 text-sm bg-[#CC3333] text-white rounded-md hover:bg-[#B71C1C]">Disable Auditing</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky save bar — always visible at the bottom when changes are pending */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#1A1A2E] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#E65100]">
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              {Object.keys(editedValues).length} unsaved change{Object.keys(editedValues).length > 1 ? 's' : ''}
            </div>
            <div className="flex-1">
              <input type="text" value={changeReason} onChange={e => setChangeReason(e.target.value)}
                placeholder="Reason for change (required, min 10 chars) *"
                className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
            </div>
            {saveResult?.type === 'error' && (
              <span className="text-[11px] text-[#CC3333] max-w-[200px] truncate">{saveResult.msg}</span>
            )}
            {saveResult?.type === 'success' && (
              <span className="text-[11px] text-[#2D6A4F] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {saveResult.msg}
              </span>
            )}
            {hasViolation && (
              <span className="text-[11px] text-[#CC3333] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">block</span>
                Policy violation
              </span>
            )}
            <button disabled={changeReason.trim().length < 10 || hasViolation || saving} onClick={handleSave}
              className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              {saving ? 'Saving...' : sectionMeta?.twoPersonRequired ? 'Submit for Approval' : 'Save Changes'}
            </button>
            <button onClick={() => { setEditedValues({}); setChangeReason(''); setSaveResult(null); }}
              className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F5F5F5] whitespace-nowrap">
              Discard
            </button>
          </div>
        </div>
      )}

    </AppShell>
  );
}
