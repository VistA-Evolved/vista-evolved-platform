import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getWards, getWardDetail, createWard, updateWardField } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Ward Management — Clinical Setup page
 * @vista WARD LOCATION #42 via GET/POST/PUT /wards
 */

const columns = [
  { key: 'name', label: 'Ward Name', bold: true },
  { key: 'division', label: 'Division' },
  { key: 'service', label: 'Service' },
];

const PAGE_SIZE = 25;

const EDIT_FIELDS = [
  { key: 'name', label: 'Ward Name', field: 'name', help: 'Official name for this ward (File #42 field .01). Appears in bed management, patient tracking, and census reports.' },
  { key: 'division', label: 'Division', field: 'division', help: 'Facility division this ward belongs to. Required for multi-division facilities.' },
  { key: 'service', label: 'Service', field: 'service', help: 'Treating specialty or service associated with this ward.' },
  { key: 'wardLocation', label: 'Ward Location', field: 'wardLocation', help: 'Physical location of the ward within the facility. Helps staff locate patients.' },
  { key: 'bedsects', label: 'Bed Sections', field: 'bedsects', help: 'Bed sections configured for this ward. Controls bed assignment and census tracking.' },
];

export default function WardManagement() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedWard, setSelectedWard] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '' });
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
      const res = await getWards();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `ward-${i}`,
        name: d.name || '',
        division: d.division || '',
        service: d.service || '',
      }));
      setWards(items);
    } catch (err) {
      setError(err.message || 'Failed to load wards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = useCallback(async (ward) => {
    setSelectedWard(ward);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    try {
      const res = await getWardDetail(ward.id);
      const d = res?.data || {};
      setDetailData({ ...ward, ...d, id: ward.id });
    } catch {
      setDetailData(ward);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleEdit = () => {
    if (!detailData) return;
    setEditing(true);
    const vals = {};
    EDIT_FIELDS.forEach(f => { vals[f.key] = detailData[f.key] || ''; });
    setEditValues(vals);
    setSaveMsg(null);
    setActionError(null);
  };

  const handleSave = async () => {
    if (!detailData) return;
    setSaving(true);
    setActionError(null);
    try {
      for (const ef of EDIT_FIELDS) {
        if (editValues[ef.key] !== (detailData[ef.key] || '')) {
          await updateWardField(detailData.id, ef.field, editValues[ef.key]);
        }
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

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createWard({ name: createForm.name.trim() });
      setShowCreateModal(false);
      setCreateForm({ name: '' });
      await loadData();
    } catch (err) {
      setCreateError(err.message || 'Failed to create ward');
    } finally {
      setCreating(false);
    }
  };

  const filtered = wards.filter(w => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return w.name.toLowerCase().includes(s) || w.division.toLowerCase().includes(s) || w.service.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Wards">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const display = detailData || selectedWard;

  return (
    <AppShell breadcrumb="Admin > Wards">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${display ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Ward Management</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage inpatient ward locations, bed sections, and treating specialties.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({wards.length} wards)</span>}
                </p>
              </div>
              <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '' }); }}
                title="Create a new ward in VistA File #42"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Ward
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search wards by name, division, or service..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>

            {loading ? <TableSkeleton rows={10} cols={3} /> : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />

            <details className="mt-6 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
              <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
              <p className="mt-2">This page replaces: <strong>ADT Manager Menu → Ward Definition</strong></p>
              <p className="mt-1">VistA File: <strong>WARD LOCATION (#42)</strong></p>
              <p className="mt-1">Terminal provides: Create/edit wards, assign bed sections, link treating specialties and services.</p>
            </details>
          </div>
        </div>

        {display && (
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{display.name}</h2>
              <div className="flex items-center gap-2">
                {!editing && (
                  <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-white" title="Edit ward fields">
                    <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                  </button>
                )}
                <button onClick={() => { setSelectedWard(null); setDetailData(null); setEditing(false); }}
                  className="text-[#999] hover:text-[#222]" aria-label="Close detail panel">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
            ) : (
              <>
                {saveMsg && (
                  <div className="mb-3 p-3 bg-[#E8F5E9] border border-[#2D6A4F] rounded-lg text-[12px] text-[#2D6A4F] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> {saveMsg}
                  </div>
                )}
                {actionError && (
                  <div className="mb-3 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[12px] text-[#CC3333] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">error</span> {actionError}
                    <button onClick={() => setActionError(null)} className="ml-auto text-[#CC3333] hover:text-[#990000]">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                )}
                {editing ? (
                  <div className="space-y-4">
                    {EDIT_FIELDS.map(ef => (
                      <div key={ef.key}>
                        <label className="block text-xs font-medium text-[#333] mb-1">{ef.label}</label>
                        <input type="text" value={editValues[ef.key] || ''}
                          onChange={e => setEditValues(prev => ({ ...prev, [ef.key]: e.target.value }))}
                          title={ef.help}
                          className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                        <p className="text-[10px] text-[#999] mt-0.5">{ef.help}</p>
                      </div>
                    ))}
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
                    {EDIT_FIELDS.map(ef => {
                      const val = display[ef.key];
                      if (!val) return null;
                      return (
                        <div key={ef.key} className="p-3 bg-white border border-[#E2E4E8] rounded-lg">
                          <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider">{ef.label}</div>
                          <div className="text-[13px] mt-0.5 text-[#222]">{val}</div>
                        </div>
                      );
                    })}
                    {!EDIT_FIELDS.some(ef => display[ef.key]) && (
                      <div className="text-center py-8 text-[#999]">
                        <span className="material-symbols-outlined text-[32px] block mb-2">info</span>
                        <p className="text-sm">Ward detail mostly contains name only in the list view. Click Edit to add fields.</p>
                        <button onClick={handleEdit} className="mt-3 text-[#2E5984] text-sm hover:underline">Add details</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#222]">Add Ward</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#999] hover:text-[#222]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {createError && (
              <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[12px] text-[#CC3333] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">error</span> {createError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Ward Name <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Medical Ward 3A"
                  title="Official name for this ward (File #42 field .01). Appears in bed management, patient tracking, and census reports."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">Cancel</button>
              <button disabled={creating || !createForm.name.trim()} onClick={handleCreate}
                className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                {creating ? 'Creating...' : 'Create Ward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
