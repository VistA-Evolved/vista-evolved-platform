import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { getTaskManStatus, getTaskManTasks, getTaskManScheduled, getErrorTrap, getVistaStatus, getHL7FilerStatus, getAdminReport } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';
import { transformErrorTrap, formatDateTime } from '../../utils/transforms';

/**
 * System Monitor & Reports
 * @vista TaskMan, Error Trap, VistA Status
 *
 * Live endpoints:
 *   GET /taskman/status → { data: { status, lastRun } }
 *   GET /error-trap     → { data: [{ ien, errorText, firstDateTime, mostRecentDateTime }] }
 *   GET /vista-status   → { ok, vista: { vistaReachable, duz, userName }, connectionMode }
 */

const REPORT_TYPES = [
  { id: 'staff-access', name: 'Staff Access', description: 'Active staff sorted by days since last sign-in.', icon: 'people' },
  { id: 'permission-dist', name: 'Permission Distribution', description: 'Permissions by holder count and module.', icon: 'key' },
  { id: 'audit-summary', name: 'Audit Summary', description: 'Actions by type, workspace, and time period.', icon: 'shield' },
  { id: 'signin-activity', name: 'Sign-In Activity', description: 'Sign-in patterns and unusual access detection.', icon: 'login' },
  { id: 'inactive-accounts', name: 'Inactive Accounts', description: 'Accounts for security remediation.', icon: 'person_off' },
  { id: 'param-changes', name: 'Parameter Changes', description: 'All parameter changes in period.', icon: 'tune' },
];

/* ── Task name humanization (same as SystemHealth) ── */
const TASK_HUMAN_NAMES = {
  'XMKPLQ': 'MailMan Queue Processor', 'XMKPL': 'MailMan Queue Processor',
  'XM KPLQ': 'MailMan Queue Processor', 'HLCSIN': 'HL7 Incoming Filer',
  'HLCSOUT': 'HL7 Outgoing Filer', 'HLCSLM': 'HL7 Logical Link Manager',
  'HLCSTCP': 'HL7 TCP Link Manager', 'XQ1': 'Background Task Runner',
  'XQSCHED': 'Task Scheduler', 'XQBTPL': 'Background Process',
  'XQCLEAN': 'Task Queue Cleanup', 'XQSMD': 'Sub-Manager',
  'XQCHK': 'Health Check', 'RMPFBLD': 'Fee Basis Rebuild',
  'LRTASK': 'Lab Background Tasks', 'LRAUTO': 'Lab Auto-Verify',
  'LRORMON': 'Lab Order Monitor', 'LRNIGHT': 'Lab Nightly Tasks',
  'YTXCHK': 'Mental Health Instrument Check', 'PRSPCCPO': 'Payroll Process',
  'ORSMON': 'Order Status Monitor', 'OREVNTX': 'Event-Delayed Order Processor',
  'PSBEDT': 'BCMA Background Edit', 'XOBVSKT': 'Socket Listener',
  'KMPDBU': 'Background Monitor',
};

function humanizeTaskName(raw) {
  if (!raw) return 'Unknown Task';
  const key = raw.replace(/^\^/, '').split('^')[0].trim().toUpperCase();
  return TASK_HUMAN_NAMES[key] || raw.replace(/^\^/, '');
}

export default function SystemMonitor() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live data
  const [taskStatus, setTaskStatus] = useState(null);
  const [activeTasks, setActiveTasks] = useState([]);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [errorTraps, setErrorTraps] = useState([]);
  const [vistaStatus, setVistaStatus] = useState(null);
  const [hl7Status, setHl7Status] = useState(null);
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

  if (error) {
    return (
      <AppShell breadcrumb="Admin > System Monitor">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > System Monitor">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-text">System Monitor & Reports</h1>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? 'Loading system status...' : 'Live system health monitoring.'}
            </p>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
            <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-[#E2E4E8] rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <HealthCard label="Background Tasks" value={taskStatus?.status || 'Unknown'} ok={taskRunning}
              icon="play_circle" detail={taskRunning ? 'Tasks are running' : 'Tasks are stopped — automated processes halted'} />
            <HealthCard label="Backend Connection" value={vistaOk ? 'Connected' : 'Disconnected'} ok={vistaOk}
              icon="link" detail={vistaOk ? `Mode: ${vistaStatus?.connectionMode || 'direct'}` : 'Backend unreachable'} />
            <HealthCard label="Error Trap" value={`${errorCount} entries`} ok={errorCount < 10}
              icon="bug_report" detail={errorCount > 0 ? 'Review recommended' : 'No errors recorded'} />
            <HealthCard label="Current User" value={vistaStatus?.vista?.userName || '—'} ok={true}
              icon="person" detail="Authenticated session" />
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-border mb-6" role="tablist">
          <button onClick={() => setActiveTab('tasks')} role="tab" aria-selected={activeTab === 'tasks'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tasks' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'}`}>
            System Health
          </button>
          <button onClick={() => setActiveTab('hl7')} role="tab" aria-selected={activeTab === 'hl7'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'hl7' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'}`}>
            HL7 Interfaces
          </button>
          <button onClick={() => setActiveTab('errors')} role="tab" aria-selected={activeTab === 'errors'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'errors' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'}`}>
            Error Trap ({errorCount})
          </button>
          <button onClick={() => setActiveTab('reports')} role="tab" aria-selected={activeTab === 'reports'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reports' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'}`}>
            System Reports
          </button>
        </div>

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Background Task Status</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">Status:</span>{' '}
                  <span className={`font-semibold ${taskRunning ? 'text-success' : 'text-danger'}`}>
                    {taskStatus?.status || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Last Run:</span>{' '}
                  <span className="font-mono text-text-secondary">{taskStatus?.lastRun || '—'}</span>
                </div>
              </div>
              {!taskRunning && taskStatus && (
                <div className="mt-3 p-3 bg-danger-bg rounded-md text-xs text-danger">
                  <strong>Warning:</strong> Background tasks are stopped. Automated processes (lab filing, HL7 messages, scheduled tasks) are not running.
                  Contact your system administrator to restart task processing.
                </div>
              )}
            </div>

            <div className="bg-white border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Backend Connection Details</h2>
              {vistaStatus ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-text-muted">Reachable:</span> <span className={vistaOk ? 'text-success font-semibold' : 'text-danger font-semibold'}>{vistaOk ? 'Yes' : 'No'}</span></div>
                  <div><span className="text-text-muted">Connection Mode:</span> <span className="text-text-secondary">{vistaStatus.connectionMode === 'direct-xwb' ? 'Direct' : vistaStatus.connectionMode || '—'}</span></div>
                  <div><span className="text-text-muted">Environment:</span> <span className="text-text-secondary">{vistaStatus.productionMode === 'production' ? 'Production' : vistaStatus.productionMode === 'test' ? 'Test / Sandbox' : vistaStatus.productionMode || '—'}</span></div>
                  <div><span className="text-text-muted">Connected User:</span> <span className="text-text-secondary">{vistaStatus.vista?.userName || '—'}</span></div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No connection data available.</p>
              )}
            </div>

            {/* Active Tasks */}
            <div className="bg-white border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Active Tasks ({activeTasks.length})</h2>
              {activeTasks.length === 0 ? (
                <p className="text-sm text-text-muted">No active tasks found.</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-surface-alt">
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Task</th>
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Status</th>
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Last Run</th>
                    </tr></thead>
                    <tbody>
                      {activeTasks.map((t, i) => (
                        <tr key={t.ien || i} className="border-t border-border">
                          <td className="px-3 py-2 text-text">{humanizeTaskName(t.name || t.taskName || t.routine)}</td>
                          <td className="px-3 py-2 text-text-secondary">{t.status || '—'}</td>
                          <td className="px-3 py-2 font-mono text-text-muted">{t.lastRun || t.scheduledTime || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Scheduled Tasks */}
            <div className="bg-white border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Scheduled Tasks ({scheduledTasks.length})</h2>
              {scheduledTasks.length === 0 ? (
                <p className="text-sm text-text-muted">No scheduled tasks found.</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-surface-alt">
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Task</th>
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Schedule</th>
                      <th className="text-left px-3 py-2 font-semibold text-text-muted uppercase">Next Run</th>
                    </tr></thead>
                    <tbody>
                      {scheduledTasks.map((t, i) => (
                        <tr key={t.ien || i} className="border-t border-border">
                          <td className="px-3 py-2 text-text">{humanizeTaskName(t.name || t.taskName || t.routine)}</td>
                          <td className="px-3 py-2 text-text-secondary">{t.frequency || t.schedule || '—'}</td>
                          <td className="px-3 py-2 font-mono text-text-muted">{t.nextRun || t.scheduledTime || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HL7 Interfaces Tab */}
        {activeTab === 'hl7' && (
          <div className="space-y-6">
            <div className="bg-white border border-border rounded-lg p-5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">HL7 Filer Status</h2>
              {hl7Status ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {typeof hl7Status === 'object' && !Array.isArray(hl7Status) ? (
                    Object.entries(hl7Status).map(([key, val]) => (
                      <div key={key}>
                        <span className="text-text-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
                        <span className="font-mono text-text-secondary">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))
                  ) : (
                    <div><span className="text-text-muted">Status:</span> <span className="font-mono text-text-secondary">{JSON.stringify(hl7Status)}</span></div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No HL7 filer status data available. The HL7 interface may not be configured in this environment.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'errors' && (
          <div>
            {errorTraps.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <span className="material-symbols-outlined text-[32px] block mb-2">check_circle</span>
                No error trap entries recorded.
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy">
                      <th className="text-left px-3 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Error</th>
                      <th className="text-left px-3 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">First Occurrence</th>
                      <th className="text-left px-3 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Last Occurrence</th>
                      <th className="text-left px-3 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Routine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorTraps.map((err, i) => (
                      <tr key={err.id} className={`border-t border-border ${i % 2 === 0 ? 'bg-white' : 'bg-surface-alt'}`}>
                        <td className="px-3 py-2.5 text-[12px] text-text max-w-md truncate" title={err.error}>{err.error}</td>
                        <td className="px-3 py-2.5 text-[12px] font-mono text-text-secondary">{err.firstOccurrence ? formatDateTime(err.firstOccurrence) : '—'}</td>
                        <td className="px-3 py-2.5 text-[12px] font-mono text-text-secondary">{err.lastOccurrence ? formatDateTime(err.lastOccurrence) : '—'}</td>
                        <td className="px-3 py-2.5 text-[12px] font-mono text-text-muted">{err.routine || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              {REPORT_TYPES.map(report => (
                <button key={report.id} onClick={() => { setSelectedReport(report.id === selectedReport ? null : report.id); setReportData(null); }}
                  className={`text-left p-5 rounded-md border transition-all ${
                    selectedReport === report.id ? 'border-steel bg-[#E8EEF5]' : 'border-border bg-white hover:border-steel/50'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-steel">{report.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-text">{report.name}</h3>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{report.description}</p>
                      {selectedReport === report.id && (
                        <div className="mt-3 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                          <button disabled={reportLoading}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setReportLoading(true);
                              try {
                                const res = await getAdminReport(report.id);
                                setReportData({ name: report.name, data: res?.data || res });
                              } catch (err) {
                                const msg = err?.message || 'Failed to generate report';
                                const needsBackend = msg.includes('404') || msg.includes('501') || msg.includes('Not Found');
                                setReportData({
                                  name: report.name,
                                  data: null,
                                  error: needsBackend
                                    ? `Report endpoint unavailable. Ensure the tenant-admin server is running.`
                                    : msg,
                                });
                              }
                              finally { setReportLoading(false); }
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-steel disabled:opacity-50">
                            {reportLoading ? 'Generating...' : 'Generate'}
                          </button>
                          <button disabled={!reportData}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!reportData?.data) return;
                              const rows = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
                              const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
                              const header = keys.join(',') + '\n';
                              const csv = rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                              const blob = new Blob([header + csv], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = `${report.id}-report.csv`; a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-white disabled:opacity-40">CSV</button>
                          <button onClick={(e) => { e.stopPropagation(); window.print(); }}
                            className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-white">Print</button>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {reportData && (
              <div className="mt-4 bg-white border border-border rounded-lg p-5">
                <h3 className="font-semibold text-sm text-text mb-3">{reportData.name} — Results</h3>
                {reportData.error ? (
                  <p className="text-sm text-danger">{reportData.error}</p>
                ) : !reportData.data ? (
                  <p className="text-sm text-text-muted">No data returned.</p>
                ) : (() => {
                  const rows = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
                  if (rows.length === 0) return <p className="text-sm text-text-muted">Report returned 0 rows.</p>;
                  const keys = Object.keys(rows[0]);
                  return (
                    <div className="border border-border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-navy">
                          {keys.map(k => <th key={k} className="text-left px-3 py-2 text-white font-semibold uppercase tracking-wider">{k.replace(/([A-Z])/g, ' $1').trim()}</th>)}
                        </tr></thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className={`border-t border-border ${i % 2 === 0 ? 'bg-white' : 'bg-surface-alt'}`}>
                              {keys.map(k => <td key={k} className="px-3 py-2 text-text-secondary">{typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}</td>)}
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

function HealthCard({ label, value, ok, icon, detail }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ok ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div>
          <div className={`text-lg font-bold ${ok ? 'text-text' : 'text-danger'}`}>{value}</div>
          <div className="text-xs text-text-secondary">{label}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{detail}</div>
        </div>
      </div>
    </div>
  );
}
