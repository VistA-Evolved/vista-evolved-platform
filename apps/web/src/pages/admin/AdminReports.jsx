import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import {
  createAdminReportSchedule,
  deleteAdminReportSchedule,
  getAdminReport,
  getAdminReportSchedules,
  getTaskManScheduled,
  runAdminReportScheduleNow,
} from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Admin Reports — Standalone reporting page
 * @see Spec Part 5 Screen 8 Reports tab, separated into own route per spec nav
 *
 * Each report type maps to tenant-admin GET /reports/admin/:reportType (VistA-backed):
 * staff-access, permission-dist, audit-summary, signin-activity, inactive-accounts, stale-accounts, param-changes.
 */

const REPORT_TYPES = [
  { id: 'staff-access', name: 'Staff Access Report', description: 'Active staff sorted by days since last sign-in.', icon: 'people', title: 'Staff listing with status, department, and permission counts. Source: NEW PERSON File #200.' },
  { id: 'permission-dist', name: 'Permission Distribution', description: 'Permissions by holder count and department.', icon: 'key', title: 'Security key allocation across staff. Source: SECURITY KEY File #19.1.' },
  { id: 'audit-summary', name: 'Audit Summary', description: 'Actions by type, workspace, and time period.', icon: 'shield', title: 'Aggregated audit events from sign-on log, FileMan audit, and error trap.' },
  { id: 'signin-activity', name: 'Sign-In Activity', description: 'Sign-in patterns and unusual access detection.', icon: 'login', title: 'Sign-in frequency and patterns by staff. Source: Kernel Sign-On Log File #3.081.' },
  { id: 'inactive-accounts', name: 'Inactive Accounts', description: 'Inactive accounts for security review.', icon: 'person_off', title: 'Accounts with no recent sign-in for security review. Source: File #200 fields 1.1, 202.' },
  { id: 'stale-accounts', name: 'Stale Accounts', description: 'Users who have not signed in within N days (default 90).', icon: 'schedule', title: 'Stale account listing for security review and optional deactivation. Source: NEW PERSON sign-on activity.' },
  { id: 'param-changes', name: 'Parameter Change History', description: 'All parameter changes in the selected period.', icon: 'tune', title: 'Audit trail of site parameter modifications. Source: FileMan Audit File #1.1.' },
];

const REPORT_COLUMN_LABELS = {
  duz: 'Staff ID', ien: 'Record ID', DUZ: 'DUZ', IEN: 'Record ID',
  name: 'Name', userName: 'Staff Name', holderCount: 'Staff Assigned',
  keyName: 'Permission Name', department: 'Department', module: 'Module',
  lastSignIn: 'Last Sign-In', lastAccess: 'Last Access',
  lastLoginDate: 'Last Login Date', daysSinceLogin: 'Days Since Login', daysSince: 'Days Since Login',
  createdDate: 'Created', modifiedDate: 'Modified',
  actionType: 'Action', timestamp: 'Date/Time', user: 'Staff Member',
  paramName: 'Parameter', oldValue: 'Previous Value', newValue: 'New Value',
};

function humanizeColumnHeader(raw) {
  if (REPORT_COLUMN_LABELS[raw]) return REPORT_COLUMN_LABELS[raw];
  return raw.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function formatScheduleTimestamp(value) {
  if (!value) return 'Not yet run';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function humanizeCadence(value) {
  return {
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  }[value] || value;
}

export default function AdminReports() {
  useEffect(() => { document.title = 'Reports — VistA Evolved'; }, []);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scheduleError, setScheduleError] = useState(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [reportSchedules, setReportSchedules] = useState([]);
  const [taskManScheduled, setTaskManScheduled] = useState([]);
  /** Default 90 — used for stale-accounts report (audit 8.14) */
  const [staleAccountsDays, setStaleAccountsDays] = useState(90);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: 'staff-access',
    cadence: 'daily',
    label: '',
    staleDays: 90,
  });

  const handleRunReport = useCallback(async (report, staleDaysOverride) => {
    setSelectedReport(report);
    setReportLoading(true);
    setReportData(null);
    setError(null);
    try {
      const params =
        report.id === 'stale-accounts'
          ? { days: staleDaysOverride != null ? staleDaysOverride : staleAccountsDays }
          : {};
      const res = await getAdminReport(report.id, params);
      setReportData(res?.data || res?.rows || []);
    } catch (err) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  }, [staleAccountsDays]);

  const loadScheduleData = useCallback(async () => {
    const [scheduleRes, taskManRes] = await Promise.allSettled([
      getAdminReportSchedules(),
      getTaskManScheduled(),
    ]);

    if (scheduleRes.status === 'fulfilled') {
      setReportSchedules(scheduleRes.value?.data || []);
    } else {
      setScheduleError(scheduleRes.reason?.message || 'Failed to load recurring report schedules');
    }

    if (taskManRes.status === 'fulfilled') {
      setTaskManScheduled(taskManRes.value?.data || []);
    }
  }, []);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  useEffect(() => {
    const interval = setInterval(loadScheduleData, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadScheduleData]);

  const handleCreateSchedule = useCallback(async () => {
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const selected = REPORT_TYPES.find((report) => report.id === scheduleForm.reportType);
      await createAdminReportSchedule({
        reportType: scheduleForm.reportType,
        cadence: scheduleForm.cadence,
        label: scheduleForm.label.trim() || `${selected?.name || scheduleForm.reportType} (${humanizeCadence(scheduleForm.cadence)})`,
        params: scheduleForm.reportType === 'stale-accounts' ? { days: scheduleForm.staleDays } : {},
        runImmediately: true,
      });
      await loadScheduleData();
    } catch (err) {
      setScheduleError(err.message || 'Failed to save recurring report');
    } finally {
      setScheduleSaving(false);
    }
  }, [loadScheduleData, scheduleForm]);

  const handleRunScheduleNow = useCallback(async (scheduleId) => {
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      await runAdminReportScheduleNow(scheduleId);
      await loadScheduleData();
    } catch (err) {
      setScheduleError(err.message || 'Failed to run recurring report');
    } finally {
      setScheduleSaving(false);
    }
  }, [loadScheduleData]);

  const handleDeleteSchedule = useCallback(async (scheduleId) => {
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      await deleteAdminReportSchedule(scheduleId);
      await loadScheduleData();
    } catch (err) {
      setScheduleError(err.message || 'Failed to delete recurring report');
    } finally {
      setScheduleSaving(false);
    }
  }, [loadScheduleData]);

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) return;
    const keys = Object.keys(reportData[0]);
    const header = keys.map(k => humanizeColumnHeader(k)).join(',');
    const rows = reportData.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport?.id || 'report'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell breadcrumb="Admin > Reports">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #admin-report-print-root, #admin-report-print-root * { visibility: visible !important; }
          #admin-report-print-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
        }
      `}</style>
      <div className="p-6 max-w-5xl">
        <h1 className="text-[22px] font-bold text-text mb-1">Reports</h1>
        <p className="text-xs text-[#999] mb-2">Generate administrative and security reports from live system data.</p>
        <p className="text-sm text-[#666] mb-6">
          Generate and export administrative reports from live VistA data. Each report queries
          real VistA files and returns current information.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              onClick={() => handleRunReport(r)}
              title={r.title}
              className={`p-4 bg-white border rounded-lg text-left hover:border-[#2E5984] transition-colors ${
                selectedReport?.id === r.id ? 'border-[#2E5984] ring-1 ring-[#2E5984]' : 'border-[#E2E4E8]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">{r.icon}</span>
                <span className="text-sm font-semibold text-text">{r.name}</span>
              </div>
              <p className="text-[11px] text-[#666]">{r.description}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] mb-6">
          <div className="bg-white border border-[#E2E4E8] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px] text-[#2E5984]">schedule</span>
              <h2 className="text-sm font-semibold text-text">Recurring Report Runs</h2>
            </div>
            <p className="text-xs text-[#666] mb-4">
              Save a recurring report definition on tenant-admin. The background worker runs it automatically and keeps the last run status visible here.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#555] mb-1">Report</label>
                <select
                  value={scheduleForm.reportType}
                  onChange={(e) => setScheduleForm((current) => ({ ...current, reportType: e.target.value }))}
                  className="w-full h-9 px-2 border border-[#E2E4E8] rounded-md text-sm bg-white"
                >
                  {REPORT_TYPES.map((report) => (
                    <option key={report.id} value={report.id}>{report.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#555] mb-1">Cadence</label>
                <select
                  value={scheduleForm.cadence}
                  onChange={(e) => setScheduleForm((current) => ({ ...current, cadence: e.target.value }))}
                  className="w-full h-9 px-2 border border-[#E2E4E8] rounded-md text-sm bg-white"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#555] mb-1">Label</label>
                <input
                  type="text"
                  value={scheduleForm.label}
                  onChange={(e) => setScheduleForm((current) => ({ ...current, label: e.target.value }))}
                  placeholder="Optional label for this recurring run"
                  className="w-full h-9 px-2 border border-[#E2E4E8] rounded-md text-sm"
                />
              </div>

              {scheduleForm.reportType === 'stale-accounts' && (
                <div>
                  <label className="block text-[11px] font-medium text-[#555] mb-1">Days since last login</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={scheduleForm.staleDays}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      setScheduleForm((current) => ({
                        ...current,
                        staleDays: Number.isFinite(value) ? Math.min(3650, Math.max(1, value)) : 90,
                      }));
                    }}
                    className="w-full h-9 px-2 border border-[#E2E4E8] rounded-md text-sm"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateSchedule}
                disabled={scheduleSaving}
                className="w-full h-10 bg-[#2E5984] text-white text-sm font-medium rounded-md hover:bg-[#1A1A2E] disabled:opacity-50"
              >
                Save recurring run and execute now
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-[#F8FAFC] border border-[#E2E4E8] p-3 text-[11px] text-[#666]">
              <div className="font-medium text-[#374151] mb-1">TaskMan context</div>
              <div>{taskManScheduled.length} VistA TaskMan task{taskManScheduled.length === 1 ? '' : 's'} currently listed.</div>
              <div className="mt-1">These recurring report runs are stored in tenant-admin and complement, rather than replace, native TaskMan scheduling.</div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E4E8] rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-text">Saved recurring runs</h2>
              <button
                type="button"
                onClick={loadScheduleData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh schedules
              </button>
            </div>

            {scheduleError && (
              <div className="mb-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
                {scheduleError}
              </div>
            )}

            {reportSchedules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#D1D5DB] p-6 text-center text-sm text-[#6B7280]">
                No recurring report runs saved yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reportSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border border-[#E2E4E8] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-text">{schedule.label}</div>
                        <div className="text-[11px] text-[#6B7280]">{REPORT_TYPES.find((report) => report.id === schedule.reportType)?.name || schedule.reportType}</div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-[#E8EEF5] px-2.5 py-1 text-[11px] font-medium text-[#2E5984]">
                        {humanizeCadence(schedule.cadence)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px] text-[#4B5563]">
                      <div>Next run: {formatScheduleTimestamp(schedule.nextRunAt)}</div>
                      <div>Last run: {formatScheduleTimestamp(schedule.lastRunAt)}</div>
                      <div>Status: {schedule.lastRunStatus || 'Pending'}</div>
                      <div>Rows returned: {typeof schedule.lastRunRows === 'number' ? schedule.lastRunRows.toLocaleString() : '—'}</div>
                    </div>

                    {schedule.lastRunError && (
                      <div className="mt-2 rounded-md bg-[#FEF2F2] px-2.5 py-2 text-[11px] text-[#B91C1C]">
                        {schedule.lastRunError}
                      </div>
                    )}

                    {schedule.reportType === 'stale-accounts' && schedule.params?.days != null && (
                      <div className="mt-2 text-[11px] text-[#6B7280]">Stale-account threshold: {schedule.params.days} day{Number(schedule.params.days) === 1 ? '' : 's'}</div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRunScheduleNow(schedule.id)}
                        disabled={scheduleSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                        Run now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        disabled={scheduleSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#F5C2C7] text-[#B42318] rounded-md hover:bg-[#FFF5F5] disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedReport?.id === 'stale-accounts' && (
          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-[#F8FAFC] border border-[#E2E4E8] rounded-lg no-print">
            <div className="flex flex-col gap-1">
              <label htmlFor="stale-days" className="text-[11px] font-medium text-[#555]">Days since last login (minimum)</label>
              <input
                id="stale-days"
                type="number"
                min={1}
                max={3650}
                value={staleAccountsDays}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setStaleAccountsDays(Number.isFinite(v) ? Math.min(3650, Math.max(1, v)) : 90);
                }}
                className="h-9 w-24 px-2 border border-[#E2E4E8] rounded-md text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => handleRunReport(selectedReport)}
              disabled={reportLoading}
              className="h-9 px-4 text-xs font-medium bg-[#2E5984] text-white rounded-md hover:bg-[#1A1A2E] disabled:opacity-50"
            >
              Apply & refresh
            </button>
            <p className="text-[11px] text-[#666] pb-1 max-w-md">
              Lists accounts with no sign-in for at least this many days (includes never logged in). Default 90.
            </p>
          </div>
        )}

        {error && <ErrorState message={error} onRetry={selectedReport ? () => handleRunReport(selectedReport) : undefined} />}

        {reportLoading && (
          <div className="p-8 text-center text-sm text-[#999]">
            <span className="material-symbols-outlined text-[32px] animate-spin block mb-2">progress_activity</span>
            Generating report...
          </div>
        )}

        {!reportLoading && reportData && (
          <div>
            <div className="flex items-center justify-end mb-3 no-print">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handlePrintReport}
                  title="Opens the print dialog — choose Save as PDF in the printer destination to export as PDF."
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">
                  <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                  Print / PDF
                </button>
                <button type="button" onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export CSV
                </button>
              </div>
            </div>
            {Array.isArray(reportData) && reportData.length > 0 ? (
              <div id="admin-report-print-root" className="bg-white border border-[#E2E4E8] rounded-lg overflow-auto max-h-[60vh] print:max-h-none print:border-0 print:shadow-none">
                <div className="px-3 py-2 border-b border-[#E2E4E8] text-sm font-semibold text-text">
                  {selectedReport?.name}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-[#F4F5F7] sticky top-0">
                    <tr>
                      {Object.keys(reportData[0]).map(col => (
                        <th key={col} className="px-3 py-2 text-left text-[10px] font-bold text-[#999] uppercase tracking-wider">
                          {humanizeColumnHeader(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E4E8]">
                    {reportData.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-[#F5F8FB]">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-xs text-[#333]">{val ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportData.length > 100 && (
                  <div className="p-3 text-center text-xs text-[#999] border-t border-[#E2E4E8]">
                    Showing first 100 of {reportData.length} rows. Export CSV for full data.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[#999]">No data available for this report.</div>
            )}
          </div>
        )}

        <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
          <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
          <p className="mt-2">Reports in VistA are generated from various package-specific menus.</p>
          <p className="mt-1">Terminal paths: <strong>ADT Reports → Various</strong>, <strong>Scheduling Reports</strong>, <strong>Lab Reports</strong>, etc.</p>
          <p className="mt-1">This page aggregates multiple report sources into a single interface.</p>
          <p className="mt-1">Data is read live from VistA via DDR LISTER across multiple files.</p>
        </details>
      </div>
    </AppShell>
  );
}
