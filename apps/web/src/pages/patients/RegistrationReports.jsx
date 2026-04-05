import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { Pagination } from '../../components/shared/SharedComponents';
import { getRegistrationReport, getDivisions } from '../../services/patientService';

const REPORT_TYPES = [
  { id: 'registrations', label: 'New Registrations', icon: 'person_add', desc: 'Patients registered within the selected date range' },
  { id: 'eligibility', label: 'Eligibility Stats', icon: 'verified', desc: 'Insurance eligibility verification rates and status' },
  { id: 'adt', label: 'ADT Stats', icon: 'swap_horiz', desc: 'Admissions, discharges, and transfers within date range' },
  { id: 'census', label: 'Census', icon: 'hotel', desc: 'Current inpatient population by unit and care setting' },
  { id: 'duplicates', label: 'Duplicate Rates', icon: 'content_copy', desc: 'Potential duplicate patient records identified' },
  { id: 'flags', label: 'Flag Activity', icon: 'flag', desc: 'Patient flag assignments and changes within date range' },
];

const PAGE_SIZE = 10;

export default function RegistrationReports() {
  const [selectedReport, setSelectedReport] = useState('registrations');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [division, setDivision] = useState('all');
  const [divisions, setDivisions] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDivisions();
        if (res.data) setDivisions(res.data);
      } catch {
        // divisions endpoint may not be available
      }
    })();
  }, []);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setPage(1);
    try {
      const params = {
        type: selectedReport,
        from: dateFrom,
        to: dateTo,
      };
      if (division !== 'all') params.division = division;
      const res = await getRegistrationReport(params);
      setData(res.data);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, dateFrom, dateTo, division]);

  const report = REPORT_TYPES.find(r => r.id === selectedReport);
  const summary = data?.summary || {};
  const rows = data?.recentRegistrations || [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Name', 'Patient ID', 'DOB', 'Sex', 'SSN (Last 4)', 'Registration Site', 'Status', 'Service Connected', 'Admitted', 'Registered Date'];
    const csvRows = rows.map(r => [
      `"${r.name || ''}"`,
      `"${r.dfn || ''}"`,
      `"${r.dob || ''}"`,
      `"${r.sex || ''}"`,
      `"${r.ssnLast4 || ''}"`,
      `"${r.registrationSite?.name || ''}"`,
      `"${r.status || ''}"`,
      `"${r.serviceConnected ? 'Yes' : 'No'}"`,
      `"${r.admitted ? 'Yes' : 'No'}"`,
      `"${r.registeredDate || ''}"`,
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedReport}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <AppShell breadcrumb="Patients › Registration Reports">
      <div className="px-6 py-5">
        <h1 className="text-[28px] font-bold text-[#1A1A2E] mb-5">Registration Reports</h1>

        {/* Report Type Selector */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {REPORT_TYPES.map(r => (
            <button key={r.id}
              onClick={() => { setSelectedReport(r.id); setGenerated(false); setData(null); }}
              className={`p-3 rounded-md border-2 text-left transition-all ${selectedReport === r.id
                ? 'border-[#2E5984] bg-[#E8EEF5]'
                : 'border-[#E2E4E8] hover:bg-[#FAFBFC]'}`}>
              <span className={`material-symbols-outlined text-[20px] block mb-1 ${selectedReport === r.id ? 'text-[#2E5984]' : 'text-[#999]'}`}>{r.icon}</span>
              <p className={`text-[12px] font-medium ${selectedReport === r.id ? 'text-[#1A1A2E]' : 'text-[#555]'}`}>{r.label}</p>
            </button>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="flex items-end justify-between mb-5 gap-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[11px] text-[#888] block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setGenerated(false); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm focus:outline-none focus:border-[#2E5984]" />
            </div>
            <div>
              <label className="text-[11px] text-[#888] block mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setGenerated(false); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm focus:outline-none focus:border-[#2E5984]" />
            </div>
            <div>
              <label className="text-[11px] text-[#888] block mb-1">Division</label>
              <select value={division} onChange={e => { setDivision(e.target.value); setGenerated(false); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm bg-white focus:outline-none focus:border-[#2E5984]">
                <option value="all">All Divisions</option>
                {divisions.map(d => (
                  <option key={d.ien || d.name} value={d.ien || d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <button onClick={generateReport} disabled={loading}
              className="flex items-center gap-2 h-9 px-5 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 transition-colors">
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[14px]">play_arrow</span>
              )}
              Generate Report
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={!generated}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E4E8] text-[12px] rounded-md hover:bg-[#F0F4F8] disabled:opacity-50">
              <span className="material-symbols-outlined text-[14px]">print</span>Print
            </button>
            <button onClick={handleExportCSV} disabled={!generated || rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E4E8] text-[12px] rounded-md hover:bg-[#F0F4F8] disabled:opacity-50">
              <span className="material-symbols-outlined text-[14px]">download</span>Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
          </div>
        ) : !generated ? (
          <div className="text-center py-16 border border-[#E2E4E8] rounded-md bg-[#FAFBFC]">
            <span className="material-symbols-outlined text-[48px] text-[#ccc] mb-3 block">{report?.icon || 'assessment'}</span>
            <p className="text-[16px] font-medium text-[#888] mb-1">{report?.label}</p>
            <p className="text-[13px] text-[#aaa] mb-4">{report?.desc}</p>
            <p className="text-[12px] text-[#bbb]">Configure filters above and click <strong>Generate Report</strong> to view results.</p>
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            {Object.keys(summary).length > 0 && (
              <div className="grid grid-cols-7 gap-3 mb-5">
                {Object.entries(summary).map(([key, val]) => (
                  <div key={key} className="bg-white border border-[#E2E4E8] rounded-md p-3 text-center">
                    <p className="text-[20px] font-bold text-[#1A1A2E]">{val}</p>
                    <p className="text-[10px] text-[#888] uppercase tracking-wide">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mb-4 px-4 py-2 bg-[#FAFBFC] border border-[#E2E4E8] rounded-md flex items-center justify-between">
              <p className="text-[13px] text-[#555]">
                <span className="font-medium text-[#1A1A2E]">{report?.label}:</span> {report?.desc}
              </p>
              
            </div>

            {/* Data Table */}
            <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A2E] text-white text-left text-[12px] uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Patient ID</th>
                    <th className="px-4 py-3 font-semibold">DOB</th>
                    <th className="px-4 py-3 font-semibold">Sex</th>
                    <th className="px-4 py-3 font-semibold">Site</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[#999]">No data for this report</td></tr>
                  ) : paged.map((r, i) => (
                    <tr key={r.dfn || i} className={`border-t border-[#E2E4E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[#555]">{r.dfn}</td>
                      <td className="px-4 py-3 text-[#555]">{r.dobFormatted || (r.dob ? new Date(r.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')}</td>
                      <td className="px-4 py-3 text-[#555]">{r.sex === 'M' ? 'Male' : r.sex === 'F' ? 'Female' : r.sex || '—'}</td>
                      <td className="px-4 py-3 text-[#555]">{r.registrationSite?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${r.status === 'active' ? 'bg-green-100 text-green-800' : r.status === 'deceased' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {r.status?.charAt(0).toUpperCase() + r.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#555]">{r.registeredDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
