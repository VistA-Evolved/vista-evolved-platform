import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getClinics, getClinicDetail, createClinic, updateClinicField, inactivateClinic, reactivateClinic, getClinicAvailability } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Clinic Management — Clinical Setup page
 * @vista HOSPITAL LOCATION #44 via GET/POST/PUT /clinics
 */

const columns = [
  { key: 'name', label: 'Clinic Name', bold: true },
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: 'stopCode', label: 'Stop Code' },
  { key: 'apptLength', label: 'Appt Length' },
  { key: 'status', label: 'Status', render: (val) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${val === 'Active' ? 'bg-[#E8F5E9] text-[#2D6A4F]' : 'bg-[#FDE8E8] text-[#CC3333]'}`}>
      {val}
    </span>
  )},
];

const PAGE_SIZE = 25;

/* Editable fields via PUT /clinics/:ien/fields */
const EDIT_FIELDS = [
  { key: 'name', label: 'Clinic Name', field: '.01', help: 'Official name for this clinic (File #44 field .01). Appears in appointment scheduling, patient check-in, and workload reports.' },
  { key: 'abbreviation', label: 'Abbreviation', field: '2', help: 'Short abbreviation used in lists and reports.' },
  { key: 'stopCode', label: 'Stop Code', field: '8', help: 'DSS workload stop code for this clinic. Used for VA workload reporting and billing. Must match the primary service provided.' },
  { key: 'creditStopCode', label: 'Credit Stop Code', field: '2503', help: 'Secondary stop code for workload credit.' },
  { key: 'apptLength', label: 'Appointment Length (min)', field: '1912', help: 'Default duration in minutes for new appointments. Can be overridden per appointment.' },
  { key: 'maxOverbooks', label: 'Max Overbooks', field: '1918', help: 'Maximum allowed overbooks per day. Set to 0 to prevent overbooking entirely.' },
  { key: 'maxNoShows', label: 'Max Consecutive No-Shows', field: '1920', help: 'Allowable consecutive no-shows before the patient is flagged. Helps manage clinic utilization.' },
  { key: 'maxFutureBooking', label: 'Max Future Booking (days)', field: '2002', help: 'How many days in advance appointments can be scheduled. Prevents scheduling too far ahead.' },
  { key: 'variableApptLength', label: 'Variable Appt Length', field: '1913', help: 'Allow appointment durations to vary from the default.' },
  { key: 'holidayScheduling', label: 'Holiday Scheduling', field: '1918.5', help: 'Whether this clinic accepts appointments on observed holidays.' },
  { key: 'defaultProvider', label: 'Default Provider', field: '16', help: 'Provider automatically assigned to new appointments in this clinic.' },
];

export default function ClinicManagement() {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('details');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', stopCode: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'inactivate'|'reactivate' }
  const [availability, setAvailability] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getClinics();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `clinic-${i}`,
        name: d.name || '',
        abbreviation: d.abbreviation || '',
        stopCode: d.stopCode || '',
        apptLength: d.apptLength ? `${d.apptLength} min` : '',
        status: d.inactivateDate ? `Inactive (${d.inactivateDate})` : 'Active',
        _inactive: !!d.inactivateDate,
      }));
      setClinics(items);
    } catch (err) {
      setError(err.message || 'Failed to load clinics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = useCallback(async (clinic) => {
    setSelectedClinic(clinic);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    setDetailTab('details');
    setAvailability(null);
    try {
      const res = await getClinicDetail(clinic.id);
      const d = res?.data || {};
      setDetailData({ ...clinic, ...d, id: clinic.id });
    } catch {
      setDetailData(clinic);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadAvailability = useCallback(async (clinicId) => {
    try {
      const res = await getClinicAvailability(clinicId);
      setAvailability(res?.data || []);
    } catch {
      setAvailability([]);
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
          await updateClinicField(detailData.id, ef.field, editValues[ef.key]);
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
      await createClinic({ name: createForm.name.trim(), stopCode: createForm.stopCode.trim() });
      setShowCreateModal(false);
      setCreateForm({ name: '', stopCode: '' });
      await loadData();
    } catch (err) {
      setCreateError(err.message || 'Failed to create clinic');
    } finally {
      setCreating(false);
    }
  };

  const handleInactivateReactivate = async () => {
    if (!confirmAction || !detailData) return;
    try {
      if (confirmAction.type === 'inactivate') await inactivateClinic(detailData.id);
      else await reactivateClinic(detailData.id);
      setConfirmAction(null);
      setSaveMsg(confirmAction.type === 'inactivate' ? 'Clinic inactivated.' : 'Clinic reactivated.');
      setTimeout(() => setSaveMsg(null), 4000);
      await loadData();
      await loadDetail({ ...detailData, id: detailData.id });
    } catch (err) {
      setActionError(err.message);
      setConfirmAction(null);
    }
  };

  const filtered = clinics.filter(c => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.abbreviation.toLowerCase().includes(s) || c.stopCode.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Clinics">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const display = detailData || selectedClinic;

  return (
    <AppShell breadcrumb="Admin > Clinics">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${display ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Clinic Management</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage scheduled patient-care locations, appointment rules, and clinic availability.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({clinics.length} clinics)</span>}
                </p>
              </div>
              <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', stopCode: '' }); }}
                title="Create a new clinic in VistA File #44"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Clinic
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search clinics by name, abbreviation, or stop code..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>

            {loading ? <TableSkeleton rows={10} cols={5} /> : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />

            <details className="mt-6 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
              <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
              <p className="mt-2">This page replaces: <strong>Scheduling Manager Menu → Set Up a Clinic</strong></p>
              <p className="mt-1">VistA File: <strong>HOSPITAL LOCATION (#44)</strong></p>
              <p className="mt-1">Terminal provides: Create, edit, inactivate/reactivate, availability grid.</p>
              <p className="mt-1">Scheduling rules (overbooks, no-shows, future booking) are configured per-clinic.</p>
            </details>
          </div>
        </div>

        {display && (
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{display.name}</h2>
              <div className="flex items-center gap-2">
                {!editing && (
                  <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-white" title="Edit clinic fields">
                    <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                  </button>
                )}
                {display._inactive ? (
                  <button onClick={() => setConfirmAction({ type: 'reactivate' })}
                    title="Reactivate this clinic to allow new appointments"
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[#E8F5E9] text-[#2D6A4F] border border-[#2D6A4F] rounded-md hover:bg-[#D0ECD7]">
                    <span className="material-symbols-outlined text-[14px]">play_arrow</span> Reactivate
                  </button>
                ) : (
                  <button onClick={() => setConfirmAction({ type: 'inactivate' })}
                    title="Inactivating a clinic prevents new appointments from being scheduled. Existing appointments are NOT cancelled."
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[#CC3333] border border-[#CC3333] rounded-md hover:bg-[#FDE8E8]">
                    <span className="material-symbols-outlined text-[14px]">pause</span> Inactivate
                  </button>
                )}
                <button onClick={() => { setSelectedClinic(null); setDetailData(null); setEditing(false); }}
                  className="text-[#999] hover:text-[#222]" aria-label="Close detail panel">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[#E2E4E8] mb-4" role="tablist">
              {[{ id: 'details', label: 'Details' }, { id: 'scheduling', label: 'Scheduling' }].map(tab => (
                <button key={tab.id} onClick={() => { setDetailTab(tab.id); if (tab.id === 'scheduling' && !availability) loadAvailability(display.id); }}
                  role="tab" aria-selected={detailTab === tab.id}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${detailTab === tab.id ? 'border-[#1A1A2E] text-[#1A1A2E]' : 'border-transparent text-[#999] hover:text-text'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
            ) : detailTab === 'details' ? (
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
                      return <DetailField key={ef.key} label={ef.label} value={val} />;
                    })}
                    {display.type && <DetailField label="Clinic Type" value={display.type} />}
                    {display.status && <DetailField label="Status" value={display.status} />}
                    {!EDIT_FIELDS.some(ef => display[ef.key]) && (
                      <div className="text-center py-8 text-[#999]">
                        <span className="material-symbols-outlined text-[32px] block mb-2">info</span>
                        <p className="text-sm">No additional details available.</p>
                        <button onClick={handleEdit} className="mt-3 text-[#2E5984] text-sm hover:underline">Add details</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Scheduling tab — read-only display of availability */
              <div>
                <div className="p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2 mb-4">
                  <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
                  <span>Scheduling availability shows the configured appointment slots for this clinic. In the terminal: <strong>Scheduling Manager → Set up a clinic → Availability</strong>.</span>
                </div>
                {availability === null ? (
                  <div className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />
                ) : availability.length === 0 ? (
                  <div className="text-center py-8 text-[#999]">
                    <span className="material-symbols-outlined text-[32px] block mb-2">event_busy</span>
                    <p className="text-sm">No availability data configured for this clinic.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availability.map((slot, i) => (
                      <div key={i} className="p-3 bg-white border border-[#E2E4E8] rounded-lg text-sm">
                        <div className="font-medium text-text">{slot.date || slot.day || `Slot ${i + 1}`}</div>
                        {slot.data && <div className="text-xs text-[#666] mt-1 font-mono">{slot.data}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          open
          title={confirmAction.type === 'inactivate' ? 'Inactivate Clinic' : 'Reactivate Clinic'}
          message={confirmAction.type === 'inactivate'
            ? `Inactivate "${display?.name}"? New appointments cannot be scheduled. Existing appointments are NOT cancelled. The clinic can be reactivated later.`
            : `Reactivate "${display?.name}"? This clinic will accept new appointments again.`}
          confirmLabel={confirmAction.type === 'inactivate' ? 'Inactivate' : 'Reactivate'}
          onConfirm={handleInactivateReactivate}
          onCancel={() => setConfirmAction(null)}
          destructive={confirmAction.type === 'inactivate'}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#222]">Add Clinic</h3>
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
                <label className="block text-xs font-medium text-[#333] mb-1">Clinic Name <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Primary Care East"
                  title="Official name for this clinic (File #44 field .01). Appears in appointment scheduling, patient check-in, and workload reports."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Stop Code</label>
                <input type="text" value={createForm.stopCode} onChange={e => setCreateForm(f => ({ ...f, stopCode: e.target.value }))}
                  placeholder="e.g. 323"
                  title="DSS workload stop code for this clinic. Used for VA workload reporting and billing."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">Cancel</button>
              <button disabled={creating || !createForm.name.trim()} onClick={handleCreate}
                className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                {creating ? 'Creating...' : 'Create Clinic'}
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
