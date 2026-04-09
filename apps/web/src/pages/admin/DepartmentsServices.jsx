import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getDepartments, getDepartmentDetail, createDepartment, updateDepartment } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Departments & Services — Organization page
 * @vista SERVICE/SECTION #49 via GET/POST/PUT /services
 */

const columns = [
  { key: 'name', label: 'Department Name', bold: true },
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: 'chief', label: 'Department Chief' },
  { key: 'mailSymbol', label: 'Mail Symbol' },
  { key: 'type', label: 'Type' },
];

const PAGE_SIZE = 25;

export default function DepartmentsServices() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDept, setSelectedDept] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAbbrev, setCreateAbbrev] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartments();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `dept-${i}`,
        name: d.name || '',
        abbreviation: d.abbreviation || '',
        chief: '',
        mailSymbol: '',
        type: '',
      }));
      setDepartments(items);
    } catch (err) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = useCallback(async (dept) => {
    setSelectedDept(dept);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    try {
      const res = await getDepartmentDetail(dept.id);
      const d = res?.data || {};
      const detail = {
        ...dept,
        name: d.name || dept.name,
        abbreviation: d.abbreviation || dept.abbreviation,
        chief: d.chief || '',
        mailSymbol: d.mailSymbol || '',
        type: d.type || '',
      };
      setDetailData(detail);
    } catch {
      setDetailData(dept);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createDepartment({ name: createName.trim(), abbreviation: createAbbrev.trim() });
      setShowCreateModal(false);
      setCreateName('');
      setCreateAbbrev('');
      await loadData();
    } catch (err) {
      setCreateError(err.message || 'Failed to create department');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = () => {
    if (!detailData) return;
    setEditing(true);
    setEditValues({
      name: detailData.name,
      abbreviation: detailData.abbreviation,
      mailSymbol: detailData.mailSymbol,
    });
    setSaveMsg(null);
    setActionError(null);
  };

  const handleSave = async () => {
    if (!detailData) return;
    setSaving(true);
    setActionError(null);
    try {
      const fieldsToSave = [];
      if (editValues.name !== detailData.name) fieldsToSave.push({ field: '.01', value: editValues.name });
      if (editValues.abbreviation !== detailData.abbreviation) fieldsToSave.push({ field: '1', value: editValues.abbreviation });
      if (editValues.mailSymbol !== detailData.mailSymbol) fieldsToSave.push({ field: '2', value: editValues.mailSymbol });

      for (const f of fieldsToSave) {
        await updateDepartment(detailData.id, f);
      }
      setEditing(false);
      setSaveMsg('Changes saved successfully.');
      setTimeout(() => setSaveMsg(null), 4000);
      await loadData();
      await loadDetail({ ...detailData, ...editValues, id: detailData.id });
    } catch (err) {
      setActionError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const filtered = departments.filter(d => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.abbreviation.toLowerCase().includes(s);
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

  const display = detailData || selectedDept;

  return (
    <AppShell breadcrumb="Admin > Departments & Services">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${display ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Departments & Services</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage organizational departments and service lines.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({departments.length} departments)</span>}
                </p>
              </div>
              <button
                onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateName(''); setCreateAbbrev(''); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Department
              </button>
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
                selectedId={display?.id}
                onRowClick={(row) => loadDetail(row)}
              />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
          </div>
        </div>

        {display && (
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{display.name}</h2>
              <div className="flex items-center gap-2">
                {!editing && (
                  <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-white" title="Edit department">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Edit
                  </button>
                )}
                <button onClick={() => { setSelectedDept(null); setDetailData(null); setEditing(false); }} className="text-[#999] hover:text-[#222]" aria-label="Close detail panel">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
            ) : editing ? (
              <div className="space-y-4">
                {actionError && (
                  <div className="p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[12px] text-[#CC3333] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-auto text-[#CC3333] hover:text-[#990000]">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#333] mb-1">Department Name <span className="text-[#CC3333]">*</span></label>
                  <input type="text" value={editValues.name || ''} onChange={e => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333] mb-1">Abbreviation</label>
                  <input type="text" value={editValues.abbreviation || ''} onChange={e => setEditValues(prev => ({ ...prev, abbreviation: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#333] mb-1">Mail Symbol</label>
                  <input type="text" value={editValues.mailSymbol || ''} onChange={e => setEditValues(prev => ({ ...prev, mailSymbol: e.target.value }))}
                    className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button disabled={saving || !editValues.name?.trim()} onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-white">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {saveMsg && (
                  <div className="p-3 bg-[#E8F5E9] border border-[#2D6A4F] rounded-lg text-[12px] text-[#2D6A4F] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {saveMsg}
                  </div>
                )}
                {display.abbreviation && <DetailField label="Abbreviation" value={display.abbreviation} />}
                {display.chief && <DetailField label="Department Chief" value={display.chief} />}
                {display.mailSymbol && <DetailField label="Mail Symbol" value={display.mailSymbol} />}
                {display.type && <DetailField label="Type" value={display.type} />}
                {!display.abbreviation && !display.chief && !display.mailSymbol && !display.type && (
                  <div className="text-center py-8 text-[#999]">
                    <span className="material-symbols-outlined text-[32px] block mb-2">info</span>
                    <p className="text-sm">No additional details available for this department.</p>
                    <button onClick={handleEdit} className="mt-3 text-[#2E5984] text-sm hover:underline">Add details</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#222]">Add Department</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#999] hover:text-[#222]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {createError && (
              <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[12px] text-[#CC3333] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {createError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Department Name <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Cardiology"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Abbreviation</label>
                <input type="text" value={createAbbrev} onChange={e => setCreateAbbrev(e.target.value)}
                  placeholder="e.g. CARD"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">
                Cancel
              </button>
              <button disabled={creating || !createName.trim()} onClick={handleCreate}
                className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                {creating ? 'Creating...' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}
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
