import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination } from '../../components/shared/SharedComponents';
import { getDepartments } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Departments & Services — Organization page
 * @vista SERVICE/SECTION #49 via GET /services
 */

const columns = [
  { key: 'name', label: 'Department Name', bold: true },
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: 'chief', label: 'Department Chief' },
  { key: 'mailSymbol', label: 'Mail Symbol' },
  { key: 'parentService', label: 'Parent Service' },
];

const PAGE_SIZE = 25;

export default function DepartmentsServices() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDept, setSelectedDept] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartments();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `dept-${i}`,
        name: d.name || '',
        abbreviation: d.abbreviation || '',
        chief: d.chief || d.chiefName || '',
        mailSymbol: d.mailSymbol || '',
        parentService: d.parentService || '',
        type: d.type || '',
      }));
      setDepartments(items);
    } catch (err) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = departments.filter(d => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.abbreviation.toLowerCase().includes(s) || d.chief.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Departments & Services">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Departments & Services">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${selectedDept ? 'w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Departments & Services</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage organizational departments and service lines.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({departments.length} departments)</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search departments..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>

            {loading ? <TableSkeleton rows={10} cols={5} /> : (
              <DataTable
                columns={columns}
                data={pageSlice}
                idField="id"
                selectedId={selectedDept?.id}
                onRowClick={(row) => setSelectedDept(row)}
              />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
          </div>
        </div>

        {selectedDept && (
          <div className="w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{selectedDept.name}</h2>
              <button onClick={() => setSelectedDept(null)} className="text-[#999] hover:text-[#222]" aria-label="Close detail panel">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-3">
              {selectedDept.abbreviation && (
                <DetailField label="Abbreviation" value={selectedDept.abbreviation} />
              )}
              {selectedDept.chief && (
                <DetailField label="Department Chief" value={selectedDept.chief} />
              )}
              {selectedDept.mailSymbol && (
                <DetailField label="Mail Symbol" value={selectedDept.mailSymbol} />
              )}
              {selectedDept.parentService && (
                <DetailField label="Parent Service" value={selectedDept.parentService} />
              )}
              {selectedDept.type && (
                <DetailField label="Type" value={selectedDept.type} />
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DetailField({ label, value }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-white border border-[#E2E4E8] rounded-lg">
      <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider">{label}</div>
      <div className="text-[13px] mt-0.5 text-[#222]">{value}</div>
    </div>
  );
}
