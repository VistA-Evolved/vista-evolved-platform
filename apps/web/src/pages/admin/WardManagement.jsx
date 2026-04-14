import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination } from '../../components/shared/SharedComponents';
import { getWards, getWardDetail, createWard, updateWardField, getWardCensus, getRoomBeds } from '../../services/adminService';
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

const BED_STATUS_STYLES = {
  available: 'bg-[#E8F5E9] text-[#2D6A4F] border border-[#C8E6C9]',
  occupied: 'bg-[#E3F2FD] text-[#1D4ED8] border border-[#BFDBFE]',
  blocked: 'bg-[#FDE8E8] text-[#CC3333] border border-[#F5C2C7]',
};

/** Parse authorized/operating bed capacity from File #42 DDR fields (.105 preferred, then .1). */
function parseWardBedCapacity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const n = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const x = parseFloat(String(v).replace(/[^\d.]/g, ''));
    return Number.isFinite(x) && x >= 0 ? Math.round(x) : null;
  };
  return n(raw['.105']) ?? n(raw['.1']) ?? null;
}

function normalizeWardValue(value) {
  return String(value ?? '').trim();
}

function isOutOfService(value) {
  const normalized = normalizeWardValue(value).toUpperCase();
  return normalized === '1' || normalized === 'Y' || normalized === 'YES' || normalized === 'TRUE';
}

function normalizeRoomBed(value) {
  return normalizeWardValue(value).toUpperCase();
}

function compareRoomBeds(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function buildWardBeds(rows, wardIen, censusRows) {
  const targetWardIen = normalizeWardValue(wardIen);
  const censusByRoomBed = new Map(
    (Array.isArray(censusRows) ? censusRows : [])
      .filter((row) => normalizeRoomBed(row.roomBed))
      .map((row) => [normalizeRoomBed(row.roomBed), row]),
  );

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => normalizeWardValue(row.wardIen || row.description || row.ward) === targetWardIen)
    .map((row) => {
      const occupant = censusByRoomBed.get(normalizeRoomBed(row.roomBed));
      const blocked = isOutOfService(row.outOfService);
      const status = occupant ? 'occupied' : blocked ? 'blocked' : 'available';
      return {
        ien: normalizeWardValue(row.ien),
        roomBed: normalizeWardValue(row.roomBed),
        wardIen: normalizeWardValue(row.wardIen || row.description || row.ward),
        status,
        patientName: occupant?.name || '',
        patientDfn: occupant?.dfn || '',
        outOfService: row.outOfService || '',
      };
    })
    .sort((left, right) => compareRoomBeds(left.roomBed, right.roomBed));
}

const EDIT_FIELDS = [
  { key: 'name', label: 'Ward Name', field: 'name', help: 'Official name for this ward (File #42 field .01). Appears in bed management, patient tracking, and census reports.' },
  { key: 'division', label: 'Division', field: 'division', help: 'Facility division this ward belongs to. Required for multi-division facilities.' },
  { key: 'service', label: 'Service', field: 'service', help: 'Treating specialty or service associated with this ward.' },
  { key: 'wardLocation', label: 'Ward Location', field: 'wardLocation', help: 'Physical location of the ward within the facility. Helps staff locate patients.' },
  { key: 'bedsects', label: 'Bed Sections', field: 'bedsects', help: 'Bed sections configured for this ward. Controls bed assignment and census tracking.' },
];

export default function WardManagement() {
  useEffect(() => { document.title = 'Ward Management — VistA Evolved'; }, []);
  const navigate = useNavigate();
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
  const [censusOccupied, setCensusOccupied] = useState(null);
  const [censusLoading, setCensusLoading] = useState(false);
  const [wardBeds, setWardBeds] = useState([]);
  const [bedsLoading, setBedsLoading] = useState(false);

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

  const loadWardOperations = useCallback(async (wardId) => {
    if (!wardId) {
      setCensusOccupied(null);
      setWardBeds([]);
      return;
    }

    setCensusLoading(true);
    setBedsLoading(true);
    try {
      const [censusRes, roomBedsRes] = await Promise.allSettled([
        getWardCensus(wardId),
        getRoomBeds(),
      ]);

      const censusRows = censusRes.status === 'fulfilled' ? (censusRes.value?.data || []) : [];
      const occupiedCount = censusRes.status === 'fulfilled'
        ? (typeof censusRes.value?.total === 'number' ? censusRes.value.total : censusRows.length)
        : null;

      setCensusOccupied(Number.isFinite(occupiedCount) ? occupiedCount : null);
      setWardBeds(
        roomBedsRes.status === 'fulfilled'
          ? buildWardBeds(roomBedsRes.value?.data || [], wardId, censusRows)
          : [],
      );
    } catch (_err) {
      setCensusOccupied(null);
      setWardBeds([]);
    } finally {
      setCensusLoading(false);
      setBedsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (ward) => {
    setSelectedWard(ward);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    setCensusOccupied(null);
    setWardBeds([]);
    try {
      const res = await getWardDetail(ward.id);
      const d = res?.data || {};
      // Map DDR field numbers to human keys
      const mapped = {};
      for (const ef of EDIT_FIELDS) {
        // Ward uses named fields; check both named key and .01-style numbers
        const val = d[ef.field] ?? d[ef.key];
        if (val !== undefined && val !== '') mapped[ef.key] = val;
      }
      setDetailData({ ...ward, ...mapped, id: ward.id, _wardRaw: d });
    } catch (err) {
      setDetailData(ward);
    } finally {
      setDetailLoading(false);
    }
    await loadWardOperations(ward.id);
  }, [loadWardOperations]);

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
  const totalWardBeds = wardBeds.length;
  const blockedBeds = wardBeds.filter((bed) => bed.status === 'blocked').length;
  const occupiedBeds = wardBeds.filter((bed) => bed.status === 'occupied').length;
  const availableBeds = wardBeds.filter((bed) => bed.status === 'available').length;

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

            {loading ? <TableSkeleton rows={10} cols={3} /> : wards.length === 0 ? (
              <div className="py-12 text-center border border-[#E2E4E8] rounded-lg bg-white">
                <p className="text-sm text-gray-500 mb-4">No wards configured yet. Create your first ward.</p>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '' }); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Ward
                </button>
              </div>
            ) : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            {!loading && wards.length > 0 && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
            )}

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
                <button onClick={() => { setSelectedWard(null); setDetailData(null); setEditing(false); setCensusOccupied(null); setWardBeds([]); }}
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
                {!editing && (() => {
                  const raw = display._wardRaw;
                  const bedCap = parseWardBedCapacity(raw);
                  const occ = censusOccupied;
                  const canShow = bedCap != null && bedCap > 0 && occ !== null;
                  if (censusLoading && bedCap != null && bedCap > 0) {
                    return (
                      <div className="mb-3 p-3 bg-white border border-[#E2E4E8] rounded-lg text-[12px] text-[#666] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                        Loading ward census…
                      </div>
                    );
                  }
                  if (!canShow) return null;
                  const pct = Math.min(100, Math.round((occ / bedCap) * 100));
                  return (
                    <div className="mb-3 p-3 bg-white border border-[#E2E4E8] rounded-lg">
                      <div className="text-[10px] font-bold text-[#999] uppercase tracking-wider">Occupancy</div>
                      <div className="text-[13px] mt-0.5 text-[#222]">
                        {occ}/{bedCap} beds occupied ({pct}%)
                      </div>
                    </div>
                  );
                })()}
                {!editing && (
                  <div className="mb-4 rounded-lg border border-[#E2E4E8] bg-white">
                    <div className="flex items-center justify-between border-b border-[#E2E4E8] px-4 py-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Bed Inventory</div>
                        <div className="text-[13px] text-[#222]">Review the ward's live room-bed inventory and current inpatient occupancy.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/patients/beds')}
                        className="rounded-md border border-[#E2E4E8] px-3 py-1.5 text-[11px] font-medium text-[#2E5984] hover:bg-[#F5F8FB]"
                      >
                        Open Bed Board
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 border-b border-[#E2E4E8] px-4 py-3">
                      {[
                        { label: 'Total Beds', value: totalWardBeds },
                        { label: 'Available', value: availableBeds },
                        { label: 'Occupied', value: occupiedBeds },
                        { label: 'Blocked', value: blockedBeds },
                      ].map((item) => (
                        <div key={item.label} className="rounded-md bg-[#F8FAFC] px-3 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{item.label}</div>
                          <div className="mt-0.5 text-[16px] font-semibold text-[#1A1A2E]">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {bedsLoading ? (
                      <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-[#666]">
                        <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                        Loading beds for this ward...
                      </div>
                    ) : totalWardBeds === 0 ? (
                      <div className="px-4 py-5 text-[12px] text-[#666]">No room-bed records are currently linked to this ward.</div>
                    ) : (
                      <div className="divide-y divide-[#E2E4E8]">
                        {wardBeds.map((bed) => {
                          return (
                            <div key={bed.ien} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-[13px] font-semibold text-[#222]">{bed.roomBed || `Bed ${bed.ien}`}</div>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BED_STATUS_STYLES[bed.status] || BED_STATUS_STYLES.blocked}`}>
                                      {bed.status}
                                    </span>
                                  </div>
                                  {bed.patientName ? (
                                    <div className="mt-1 text-[12px] text-[#555]">Occupied by {bed.patientName}</div>
                                  ) : (
                                    <div className="mt-1 text-[12px] text-[#777]">Ward {display.name}</div>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {bed.patientDfn && (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/patients/${bed.patientDfn}`)}
                                      className="rounded-md border border-[#E2E4E8] px-3 py-1.5 text-[11px] font-medium text-[#2E5984] hover:bg-[#F5F8FB]"
                                    >
                                      View Patient
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="border-t border-[#E2E4E8] px-4 py-3 text-[11px] text-[#666]">
                      Use Open Bed Board for room-bed edits and assignment workflows.
                    </div>
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
