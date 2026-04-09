import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import {
  getTaskManStatus, getTaskManTasks, getTaskManScheduled,
  getErrorTrap, getVistaStatus, getHL7FilerStatus, getAdminReport,
  getHL7Interfaces,
} from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';
import { transformErrorTrap, formatDateTime } from '../../utils/transforms';

/**
 * System Health — Screen 8  (replaces SystemMonitor)
 * @vista Background task scheduler, Error Trap, HL7, VistA Status
 *
 * Key spec requirements:
 *  - Human task names (not raw M routines)
 *  - When background scheduler is stopped → single prominent card, not 15 blank rows
 *  - Current User card shows name only, NO "DUZ: 1"
 *  - HL7 tab shows link list from File #870
 *  - Error tab shows human-readable summaries with expandable raw details
 *  - Reports use human column headers
 */

/* ── Task name humanization map ── */
const TASK_HUMAN_NAMES = {
  'XMKPLQ':   'Internal Message Queue Processor',
  'XMKPL':    'Internal Message Queue Processor',
  'XM KPLQ':  'Internal Message Queue Processor',
  'HLCSIN':   'HL7 Incoming Filer',
  'HLCSOUT':  'HL7 Outgoing Filer',
  'HLCSLM':   'HL7 Logical Link Manager',
  'HLCSTCP':  'HL7 TCP Link Manager',
  'XQ1':      'Background Task Runner',
  'XQSCHED':  'Task Scheduler',
  'XQBTPL':   'Background Process',
  'XQCLEAN':  'Task Queue Cleanup',
  'XQSMD':    'Background Sub-Manager',
  'XQCHK':    'Background Task Health Check',
  'RMPFBLD':  'Fee Basis Rebuild',
  'LRTASK':   'Lab Background Tasks',
  'LRAUTO':   'Lab Auto-Verify',
  'LRORMON':  'Lab Order Monitor',
  'LRNIGHT':  'Lab Nightly Tasks',
  'YTXCHK':   'Mental Health Instrument Check',
  'PRSPCCPO': 'Payroll Process',
  'ORSMON':   'Order Status Monitor',
  'OREVNTX':  'Event-Delayed Order Processor',
  'PSBEDT':   'BCMA Background Edit Processor',
  'XOBVSKT':  'VistALink Socket Listener',
  'KMPDBU':   'CPRS Background Monitor',
};

function humanizeTaskName(raw) {
  if (!raw) return 'Unknown Task';
  const key = raw.replace(/^\^/, '').split('^')[0].trim().toUpperCase();
  return TASK_HUMAN_NAMES[key] || raw.replace(/^\^/, '');
}

/* ── Error summary humanization ── */
function humanizeError(errorText) {
  if (!errorText) return 'Unknown error';
  // M error patterns → human summaries
  if (errorText.includes('%YDB-E-ACTLSTTOOLONG'))
    return `Parameter mismatch${extractRoutine(errorText)}`;
  if (errorText.includes('%YDB-E-UNDEF') || errorText.includes('UNDEF'))
    return `Undefined variable${extractRoutine(errorText)}`;
  if (errorText.includes('%YDB-E-GVUNDEF'))
    return `Missing data reference${extractRoutine(errorText)}`;
  if (errorText.includes('TRIG'))
    return `Database trigger error${extractRoutine(errorText)}`;
  if (errorText.includes('NOLINE'))
    return `Missing routine line${extractRoutine(errorText)}`;
  if (errorText.includes('LOCK'))
    return `Lock timeout (resource contention)${extractRoutine(errorText)}`;
  if (errorText.includes('MAXSTR'))
    return `String too long error${extractRoutine(errorText)}`;
  // If short enough and no M jargon, return as-is
  if (errorText.length < 80 && !errorText.includes('~') && !errorText.includes('^'))
    return errorText;
  // Fallback: extract meaningful portion
  const parts = errorText.split(',');
  return parts[0].length < 60 ? parts[0] : errorText.slice(0, 60) + '…';
}

function extractRoutine(text) {
  const m = text.match(/(?:in |at |~)([A-Z][A-Z0-9]+)/i);
  return m ? ` in ${m[1]}` : '';
}

/* ── Report definitions ── */
const REPORT_TYPES = [
  { id: 'staff-access', name: 'Staff Access Report', description: 'Active staff sorted by days since last sign-in.', icon: 'people' },
  { id: 'permission-dist', name: 'Permission Distribution', description: 'Permissions by holder count and department.', icon: 'key' },
  { id: 'audit-summary', name: 'Audit Summary', description: 'Actions by type, workspace, and time period.', icon: 'shield' },
  { id: 'signin-activity', name: 'Sign-In Activity', description: 'Sign-in patterns and unusual access detection.', icon: 'login' },
  { id: 'inactive-accounts', name: 'Inactive Accounts', description: 'Inactive accounts for security review.', icon: 'person_off' },
  { id: 'param-changes', name: 'Parameter Change History', description: 'All parameter changes in the selected period.', icon: 'tune' },
];

/* ── Human column headers for reports ── */
const REPORT_COLUMN_LABELS = {
  duz: 'Staff ID', ien: 'Record ID', DUZ: 'Staff ID', IEN: 'Record ID',
  name: 'Name', userName: 'Staff Name', holderCount: 'Staff Assigned',
  keyName: 'Permission Name', department: 'Department', module: 'Module',
  lastSignIn: 'Last Sign-In', lastAccess: 'Last Access',
  createdDate: 'Created', modifiedDate: 'Modified',
  actionType: 'Action', timestamp: 'Date/Time', user: 'Staff Member',
  paramName: 'Parameter', oldValue: 'Previous Value', newValue: 'New Value',
};

function humanizeColumnHeader(raw) {
  if (REPORT_COLUMN_LABELS[raw]) return REPORT_COLUMN_LABELS[raw];
  return raw.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

export default function SystemHealth() {
  const [activeTab, setActiveTab] = useState('health');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [taskStatus, setTaskStatus] = useState(null);
  const [activeTasks, setActiveTasks] = useState([]);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [errorTraps, setErrorTraps] = useState([]);
  const [vistaStatus, setVistaStatus] = useState(null);
  const [hl7Status, setHl7Status] = useState(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(new Set());

  // Reports state
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskRes, tasksRes, schedRes, errorRes, vistaRes, hl7Res] = await Promise.allSettled([
        getTaskManStatus(),
        getTaskManTasks(),
        getTaskManScheduled(),
        getErrorTrap(),
        getVistaStatus(),
        getHL7FilerStatus(),
      ]);
      if (taskRes.status === 'fulfilled') setTaskStatus(taskRes.value?.data || null);
      if (tasksRes.status === 'fulfilled') setActiveTasks(tasksRes.value?.data || []);
      if (schedRes.status === 'fulfilled') setScheduledTasks(schedRes.value?.data || []);
      if (errorRes.status === 'fulfilled') {
        const entries = (errorRes.value?.data || []).map(transformErrorTrap).filter(Boolean);
        setErrorTraps(entries);
      }
      if (vistaRes.status === 'fulfilled') setVistaStatus(vistaRes.value || null);
      if (hl7Res.status === 'fulfilled') setHl7Status(hl7Res.value?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const taskRunning = taskStatus?.status === 'RUNNING';
  const vistaOk = vistaStatus?.vista?.vistaReachable === true;
  const errorCount = errorTraps.length;
  const allTasks = [...activeTasks, ...scheduledTasks];
  const taskCount = allTasks.length;

  const toggleErrorExpand = (id) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > System Health">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > System Health">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-text">System Health</h1>
            <p className="text-xs text-[#999] mt-1">
              {loading ? 'Loading system status...' : 'Live system health monitoring.'}
            </p>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">
            <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
          </button>
        </div>

        {/* ── Health Cards ── */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-[#E2E4E8] rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <HealthCard label="Background Tasks" value={taskStatus?.status || 'Unknown'} ok={taskRunning}
              icon="play_circle" detail={taskRunning ? `${taskCount} tasks active` : 'Automated processes halted'} />
            <HealthCard label="Backend Connection" value={vistaOk ? 'Connected' : 'Disconnected'} ok={vistaOk}
              icon="link" detail={vistaOk ? `Mode: ${vistaStatus?.connectionMode === 'direct-xwb' ? 'Direct' : vistaStatus?.connectionMode || 'Direct'}` : 'Backend unreachable'} />
            <HealthCard label="Error Log" value={`${errorCount} ${errorCount === 1 ? 'entry' : 'entries'}`} ok={errorCount < 10}
              icon="bug_report" detail={errorCount > 0 ? 'Review recommended' : 'No errors recorded'} />
            {/* Spec: Current User shows name only, NO "DUZ: 1" */}
            <HealthCard label="Current User" value={vistaStatus?.vista?.userName || '—'} ok={true}
              icon="person" detail="Authenticated session" />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-[#E2E4E8] mb-6" role="tablist">
          {[
            { id: 'health', label: 'System Health' },
            { id: 'hl7', label: 'HL7 Interfaces' },
            { id: 'errors', label: `Error Log (${errorCount})` },
            { id: 'reports', label: 'Reports' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" aria-selected={activeTab === tab.id}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-[#1A1A2E] text-[#1A1A2E]' : 'border-transparent text-[#999] hover:text-text'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── System Health tab ── */}
        {activeTab === 'health' && !loading && (
          <div className="space-y-6">
            {/* Background scheduler status */}
            {!taskRunning && taskStatus ? (
              /* Spec: When STOPPED, show a single prominent card, not 15 blank rows */
              <div className="bg-[#FFF3E0] border border-[#E65100] rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[28px] text-[#E65100]">warning</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-[#E65100] mb-2">Background Tasks: STOPPED</h2>
                    <p className="text-sm text-[#333] mb-3">Background processing is not running. This means:</p>
                    <ul className="text-sm text-[#333] list-disc ml-5 space-y-1 mb-4">
                      <li>Internal messages are not being delivered</li>
                      <li>HL7 messages are not being processed</li>
                      <li>Scheduled reports are not running</li>
                      <li>Lab results from instruments are not being filed</li>
                    </ul>
                    <p className="text-sm text-[#333] mb-4">
                      Background processing must be started for the system to function properly. Contact your system administrator.
                    </p>
                    <p className="text-xs text-[#666] mb-3">{taskCount} tasks are configured but not running.</p>
                    <button onClick={() => setShowTaskDetails(!showTaskDetails)}
                      className="flex items-center gap-1 text-sm font-medium text-[#E65100] hover:underline">
                      <span className="material-symbols-outlined text-[16px]">
                        {showTaskDetails ? 'expand_less' : 'expand_more'}
                      </span>
                      {showTaskDetails ? 'Hide Task Details' : 'Show Task Details'}
                    </button>
                    {showTaskDetails && taskCount > 0 && (
                      <div className="mt-3 border border-[#E2E4E8] rounded-md overflow-hidden max-h-60 overflow-y-auto bg-white">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-[#F4F5F7]">
                            <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Task</th>
                            <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Routine</th>
                            <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Status</th>
                          </tr></thead>
                          <tbody>
                            {allTasks.map((t, i) => (
                              <tr key={t.ien || i} className="border-t border-[#E2E4E8]">
                                <td className="px-3 py-2 text-text">{humanizeTaskName(t.name || t.taskName || t.routine)}</td>
                                <td className="px-3 py-2 font-mono text-[#999] text-[10px]">{t.routine || t.name || '—'}</td>
                                <td className="px-3 py-2 text-[#CC3333]">Not Running</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : taskRunning ? (
              <div className="space-y-4">
                <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Background Task Status</h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#2D6A4F]">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span> Running
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-1">
                    <div><span className="text-[#999]">Status:</span>{' '}<span className="font-semibold text-[#2D6A4F]">{taskStatus?.status}</span></div>
                    <div><span className="text-[#999]">Last Run:</span>{' '}<span className="font-mono text-[#666]">{taskStatus?.lastRun || '—'}</span></div>
                  </div>
                </div>

                {/* Active Tasks (human names) */}
                <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
                  <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Active Tasks ({activeTasks.length})</h2>
                  {activeTasks.length === 0 ? (
                    <p className="text-sm text-[#999]">No active tasks found.</p>
                  ) : (
                    <div className="border border-[#E2E4E8] rounded-md overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-[#F4F5F7]">
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Task</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Status</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Last Run</th>
                        </tr></thead>
                        <tbody>
                          {activeTasks.map((t, i) => (
                            <tr key={t.ien || i} className="border-t border-[#E2E4E8]">
                              <td className="px-3 py-2 text-text">
                                <div>{humanizeTaskName(t.name || t.taskName || t.routine)}</div>
                                <div className="text-[10px] font-mono text-[#999]">{t.routine || t.name || ''}</div>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-xs font-medium ${t.status === 'RUNNING' ? 'text-[#2D6A4F]' : 'text-[#666]'}`}>
                                  {t.status || 'Idle'}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[#999]">{t.lastRun || t.scheduledTime || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Scheduled Tasks (human names) */}
                <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
                  <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Scheduled Tasks ({scheduledTasks.length})</h2>
                  {scheduledTasks.length === 0 ? (
                    <p className="text-sm text-[#999]">No scheduled tasks found.</p>
                  ) : (
                    <div className="border border-[#E2E4E8] rounded-md overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-[#F4F5F7]">
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Task</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Schedule</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Next Run</th>
                        </tr></thead>
                        <tbody>
                          {scheduledTasks.map((t, i) => (
                            <tr key={t.ien || i} className="border-t border-[#E2E4E8]">
                              <td className="px-3 py-2 text-text">
                                <div>{humanizeTaskName(t.name || t.taskName || t.routine)}</div>
                                <div className="text-[10px] font-mono text-[#999]">{t.routine || t.name || ''}</div>
                              </td>
                              <td className="px-3 py-2 text-[#666]">{t.frequency || t.schedule || '—'}</td>
                              <td className="px-3 py-2 font-mono text-[#999]">{t.nextRun || t.scheduledTime || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* VistA Connection Details */}
            <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Backend Connection Details</h2>
              {vistaStatus ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-[#999]">Reachable:</span>{' '}<span className={vistaOk ? 'text-[#2D6A4F] font-semibold' : 'text-[#CC3333] font-semibold'}>{vistaOk ? 'Yes' : 'No'}</span></div>
                  <div><span className="text-[#999]">Connection Mode:</span>{' '}<span className="text-[#666]">{vistaStatus.connectionMode === 'direct-xwb' ? 'Direct' : vistaStatus.connectionMode || '—'}</span></div>
                  <div><span className="text-[#999]">Environment:</span>{' '}<span className="text-[#666]">{vistaStatus.productionMode === 'production' ? 'Production' : vistaStatus.productionMode === 'test' ? 'Test / Sandbox' : vistaStatus.productionMode || '—'}</span></div>
                  <div><span className="text-[#999]">Connected User:</span>{' '}<span className="text-[#666]">{vistaStatus.vista?.userName || '—'}</span></div>
                </div>
              ) : (
                <p className="text-sm text-[#999]">No connection data available.</p>
              )}
            </div>
          </div>
        )}

        {/* ── HL7 Interfaces tab ── */}
        {activeTab === 'hl7' && !loading && (
          <div className="space-y-6">
            {/* HL7 Filer status at top */}
            <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">HL7 Filer Status</h2>
              {hl7Status ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {typeof hl7Status === 'object' && !Array.isArray(hl7Status) ? (
                    Object.entries(hl7Status).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[#999] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="font-mono text-[#666]">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))
                  ) : (
                    <div><span className="text-[#999]">Status:</span>{' '}<span className="font-mono text-[#666]">{JSON.stringify(hl7Status)}</span></div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#999]">No HL7 filer status available. HL7 may not be configured in this environment.</p>
              )}
            </div>

            {/* HL7 Interface link list placeholder — uses GET /hl7-interfaces (File #870) */}
            <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Configured Interfaces</h2>
              <HL7InterfaceList />
            </div>
          </div>
        )}

        {/* ── Error Log tab ── */}
        {activeTab === 'errors' && !loading && (
          <div>
            {errorTraps.length === 0 ? (
              <div className="text-center py-12 text-[#999]">
                <span className="material-symbols-outlined text-[32px] block mb-2">check_circle</span>
                No error log entries recorded.
              </div>
            ) : (
              <div className="space-y-2">
                {errorTraps.map((err) => {
                  const expanded = expandedErrors.has(err.id);
                  return (
                    <div key={err.id} className="bg-white border border-[#E2E4E8] rounded-lg overflow-hidden">
                      <button onClick={() => toggleErrorExpand(err.id)}
                        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-[#F4F5F7] transition-colors">
                        <span className="material-symbols-outlined text-[16px] text-[#CC3333] mt-0.5">error</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text">{humanizeError(err.error)}</div>
                          <div className="flex items-center gap-4 mt-1 text-[10px] text-[#999]">
                            <span>First: {err.firstOccurrence ? formatDateTime(err.firstOccurrence) : '—'}</span>
                            <span>Last: {err.lastOccurrence ? formatDateTime(err.lastOccurrence) : '—'}</span>
                            {err.routine && <span className="font-mono">Source: {err.routine}</span>}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-[#999]">
                          {expanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 border-t border-[#E2E4E8]">
                          <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mt-2 mb-1">Technical Details</div>
                          <pre className="text-[11px] font-mono text-[#666] bg-[#F4F5F7] p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{err.error}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Reports tab ── */}
        {activeTab === 'reports' && !loading && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              {REPORT_TYPES.map(report => (
                <button key={report.id} onClick={() => { setSelectedReport(report.id === selectedReport ? null : report.id); setReportData(null); }}
                  className={`text-left p-5 rounded-lg border transition-all ${
                    selectedReport === report.id ? 'border-[#2E5984] bg-[#E8EEF5]' : 'border-[#E2E4E8] bg-white hover:border-[#2E5984]/50'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-[#2E5984]">{report.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-text">{report.name}</h3>
                      <p className="text-xs text-[#999] mt-1 leading-relaxed">{report.description}</p>
                      {selectedReport === report.id && (
                        <div className="mt-3 pt-3 border-t border-[#E2E4E8]/50 flex gap-2 flex-wrap">
                          <button disabled={reportLoading}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setReportLoading(true);
                              try {
                                const res = await getAdminReport(report.id);
                                setReportData({ name: report.name, data: res?.data || res });
                              } catch (err) {
                                const msg = err?.message || 'Failed to generate report';
                                setReportData({ name: report.name, data: null, error: msg.includes('404') || msg.includes('501')
                                  ? 'Report endpoint unavailable. Ensure the tenant-admin server is running.'
                                  : msg });
                              } finally { setReportLoading(false); }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-50">
                            {reportLoading ? 'Generating...' : 'Generate'}
                          </button>
                          <button disabled={!reportData?.data}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!reportData?.data) return;
                              const rows = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
                              const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
                              const header = keys.map(humanizeColumnHeader).join(',') + '\n';
                              const sanitize = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
                              const csv = rows.map(r => keys.map(k => `"${sanitize(r[k]).replace(/"/g, '""')}"`).join(',')).join('\n');
                              const blob = new Blob([header + csv], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = `${report.id}-report.csv`; a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="px-3 py-1.5 text-xs border border-[#E2E4E8] rounded-md hover:bg-white disabled:opacity-40">CSV</button>
                          <button onClick={(e) => { e.stopPropagation(); window.print(); }}
                            className="px-3 py-1.5 text-xs border border-[#E2E4E8] rounded-md hover:bg-white">Print</button>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {reportData && (
              <div className="mt-4 bg-white border border-[#E2E4E8] rounded-lg p-5">
                <h3 className="font-semibold text-sm text-text mb-3">{reportData.name} — Results</h3>
                {reportData.error ? (
                  <p className="text-sm text-[#CC3333]">{reportData.error}</p>
                ) : !reportData.data ? (
                  <p className="text-sm text-[#999]">No data returned.</p>
                ) : (() => {
                  const rows = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
                  if (rows.length === 0) return <p className="text-sm text-[#999]">Report returned 0 rows.</p>;
                  // Check if all holder counts are 0 (sandbox case)
                  const allZeroHolders = rows.every(r => (r.holderCount === 0 || r.holderCount === '0'));
                  if (allZeroHolders && selectedReport === 'permission-dist') {
                    return (
                      <div className="text-center py-8 text-[#999]">
                        <span className="material-symbols-outlined text-[28px] block mb-2">info</span>
                        <p className="text-sm">No permissions have been assigned yet.</p>
                        <p className="text-xs mt-1">Use the Staff Directory to assign roles to staff members.</p>
                      </div>
                    );
                  }
                  const keys = Object.keys(rows[0]);
                  return (
                    <div className="border border-[#E2E4E8] rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-[#1A1A2E]">
                          {keys.map(k => <th key={k} className="text-left px-3 py-2 text-white font-semibold uppercase tracking-wider">{humanizeColumnHeader(k)}</th>)}
                        </tr></thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className={`border-t border-[#E2E4E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4F5F7]'}`}>
                              {keys.map(k => <td key={k} className="px-3 py-2 text-[#666]">{typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── HL7 Interface List (File #870) ── */
function HL7InterfaceList() {
  const [interfaces, setInterfaces] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getHL7Interfaces();
        if (!cancelled) setInterfaces(res?.data || []);
      } catch {
        if (!cancelled) setInterfaces([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />;
  if (!interfaces || interfaces.length === 0) {
    return <p className="text-sm text-[#999]">No HL7 logical links configured in this environment.</p>;
  }

  return (
    <div className="border border-[#E2E4E8] rounded-md overflow-hidden max-h-80 overflow-y-auto">
      <table className="w-full text-xs">
        <thead><tr className="bg-[#F4F5F7]">
          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Interface Name</th>
          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Institution</th>
          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Protocol</th>
          <th className="text-left px-3 py-2 font-semibold text-[#999] uppercase">Auto-Start</th>
        </tr></thead>
        <tbody>
          {interfaces.map((intf, i) => (
            <tr key={intf.ien || i} className="border-t border-[#E2E4E8]">
              <td className="px-3 py-2 text-text font-medium">{intf.name || '—'}</td>
              <td className="px-3 py-2 text-[#666]">{intf.institution || '—'}</td>
              <td className="px-3 py-2 font-mono text-[#999]">{intf.lowerLayer || '—'}</td>
              <td className="px-3 py-2">
                {intf.autostart?.toLowerCase() === 'enabled' ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8F5E9] text-[#2D6A4F]">Enabled</span>
                ) : (
                  <span className="text-[#999]">{intf.autostart || '—'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Health Card ── */
function HealthCard({ label, value, ok, icon, detail }) {
  return (
    <div className="bg-white border border-[#E2E4E8] rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ok ? 'bg-[#E8F5E9] text-[#2D6A4F]' : 'bg-[#FDE8E8] text-[#CC3333]'}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div>
          <div className={`text-lg font-bold ${ok ? 'text-text' : 'text-[#CC3333]'}`}>{value}</div>
          <div className="text-xs text-[#999]">{label}</div>
          <div className="text-[10px] text-[#999] mt-0.5">{detail}</div>
        </div>
      </div>
    </div>
  );
}
