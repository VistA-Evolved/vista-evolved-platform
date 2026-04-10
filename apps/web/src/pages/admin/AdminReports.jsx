import { useState, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { getAdminReport } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Admin Reports — Standalone reporting page
 * @see Spec Part 5 Screen 8 Reports tab, separated into own route per spec nav
 */

const REPORT_TYPES = [
  { id: 'staff-access', name: 'Staff Access Report', description: 'Active staff sorted by days since last sign-in.', icon: 'people', title: 'Staff listing with status, department, and permission counts. Source: NEW PERSON File #200.' },
  { id: 'permission-dist', name: 'Permission Distribution', description: 'Permissions by holder count and department.', icon: 'key', title: 'Security key allocation across staff. Source: SECURITY KEY File #19.1.' },
  { id: 'audit-summary', name: 'Audit Summary', description: 'Actions by type, workspace, and time period.', icon: 'shield', title: 'Aggregated audit events from sign-on log, FileMan audit, and error trap.' },
  { id: 'signin-activity', name: 'Sign-In Activity', description: 'Sign-in patterns and unusual access detection.', icon: 'login', title: 'Sign-in frequency and patterns by staff. Source: Kernel Sign-On Log File #3.081.' },
  { id: 'inactive-accounts', name: 'Inactive Accounts', description: 'Inactive accounts for security review.', icon: 'person_off', title: 'Accounts with no recent sign-in for security review. Source: File #200 fields 1.1, 202.' },
  { id: 'param-changes', name: 'Parameter Change History', description: 'All parameter changes in the selected period.', icon: 'tune', title: 'Audit trail of site parameter modifications. Source: FileMan Audit File #1.1.' },
];

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

export default function AdminReports() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRunReport = useCallback(async (report) => {
    setSelectedReport(report);
    setReportLoading(true);
    setReportData(null);
    setError(null);
    try {
      const res = await getAdminReport(report.id);
      setReportData(res?.data || res?.rows || []);
    } catch (err) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  }, []);

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

        {error && <ErrorState message={error} onRetry={selectedReport ? () => handleRunReport(selectedReport) : undefined} />}

        {reportLoading && (
          <div className="p-8 text-center text-sm text-[#999]">
            <span className="material-symbols-outlined text-[32px] animate-spin block mb-2">progress_activity</span>
            Generating report...
          </div>
        )}

        {!reportLoading && reportData && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text">{selectedReport?.name}</h2>
              <button onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">
                <span className="material-symbols-outlined text-[14px]">download</span>
                Export CSV
              </button>
            </div>
            {Array.isArray(reportData) && reportData.length > 0 ? (
              <div className="bg-white border border-[#E2E4E8] rounded-lg overflow-auto max-h-[60vh]">
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
