import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getClinics, getClinicDetail, createClinic, updateClinicField, inactivateClinic, reactivateClinic, getClinicAvailability, setClinicAvailability, getStopCodes, getStaff } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';
import { fmDateToIso } from '../../utils/transforms';

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
const STOP_CODE_LIST_ID = 'clinic-stop-code-list';
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

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

function normalizeStopCode(rawValue) {
  return String(rawValue || '').replace(/\D/g, '').slice(0, 3);
}

function normalizeStopCodeRows(rows) {
  return (rows || [])
    .map((row) => {
      const primaryCode = normalizeStopCode(row.code);
      const fallbackCode = normalizeStopCode(row.name);
      const code = primaryCode || fallbackCode;
      const description = primaryCode
        ? String(row.name || row.description || '').trim()
        : String(row.code || row.description || '').trim();
      return {
        ...row,
        code,
        description,
      };
    })
    .filter((row) => row.code);
}

function findStopCodeMatch(rows, rawCode) {
  const code = normalizeStopCode(rawCode);
  return rows.find((row) => row.code === code) || null;
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoToUsDate(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-');
  if (!year || !month || !day) return '';
  return `${month}/${day}/${year}`;
}

function formatAvailabilityDate(fmDate) {
  const iso = fmDateToIso(fmDate);
  if (!iso) return String(fmDate || 'Unknown date');
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function groupAvailabilityRows(rows) {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const fmDate = String(row.date || '').trim();
    const isoDate = fmDateToIso(fmDate).slice(0, 10);
    const key = isoDate || fmDate;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        fmDate,
        isoDate,
        displayDate: formatAvailabilityDate(fmDate),
        entries: [],
      });
    }
    grouped.get(key).entries.push({
      subIen: String(row.subIen || ''),
      data: String(row.data || ''),
    });
  });
  return Array.from(grouped.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function summarizeAvailability(entries) {
  const parts = entries.map((entry) => entry.data).filter(Boolean);
  if (parts.length <= 3) return parts.join(' | ');
  return `${parts.slice(0, 3).join(' | ')} +${parts.length - 3} more`;
}

function normalizeProviderRows(rows) {
  return (rows || [])
    .filter((row) => row && row.name && row.status === 'ACTIVE' && row.isProvider)
    .map((row) => ({
      duz: String(row.ien || row.duz || ''),
      name: String(row.name || '').trim(),
      title: String(row.title || '').trim(),
      service: String(row.service || '').trim(),
    }))
    .filter((row) => row.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findExactClinicNameMatches(clinics, rawName) {
  const normalizedName = String(rawName || '').trim().toUpperCase();
  if (!normalizedName) return [];
  return (clinics || []).filter((clinic) => String(clinic.name || '').trim().toUpperCase() === normalizedName);
}

function providerOptionLabel(provider) {
  const parts = [provider.name];
  if (provider.title) parts.push(provider.title);
  if (provider.service) parts.push(provider.service);
  return parts.join(' - ');
}

export default function ClinicManagement() {
  useEffect(() => { document.title = 'Clinic Management — VistA Evolved'; }, []);
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
  const [createForm, setCreateForm] = useState({
    name: '', stopCode: '', apptLength: '30', maxApptsPerSlot: '', defaultProvider: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [duplicateCreateWarning, setDuplicateCreateWarning] = useState(null);
  const [stopCodes, setStopCodes] = useState([]);
  const [stopCodesLoading, setStopCodesLoading] = useState(false);
  const [stopCodesError, setStopCodesError] = useState(null);
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'inactivate'|'reactivate' }
  const [availability, setAvailability] = useState(null);
  const [templateForm, setTemplateForm] = useState({ sourceDate: '', startDate: '', endDate: '', weekdays: [] });
  const [templateError, setTemplateError] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getClinics();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `clinic-${i}`,
        name: d.name || '',
        abbreviation: d.abbreviation || '',
        type: d.type || 'C',
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

  const loadStopCodeData = useCallback(async () => {
    setStopCodesLoading(true);
    setStopCodesError(null);
    try {
      const res = await getStopCodes();
      setStopCodes(normalizeStopCodeRows(res?.data || []));
    } catch (err) {
      setStopCodesError(err.message || 'Failed to load stop codes');
      setStopCodes([]);
    } finally {
      setStopCodesLoading(false);
    }
  }, []);

  useEffect(() => { loadStopCodeData(); }, [loadStopCodeData]);

  const loadProviderData = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const res = await getStaff({ max: 500 });
      setProviders(normalizeProviderRows(res?.data || []));
    } catch (err) {
      setProvidersError(err.message || 'Failed to load providers');
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => { loadProviderData(); }, [loadProviderData]);

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
      // Map DDR field numbers to human keys
      const mapped = {};
      for (const ef of EDIT_FIELDS) {
        const val = d[ef.field] ?? d[`${ef.field}E`] ?? d[`${ef.field}I`];
        if (val !== undefined && val !== '') mapped[ef.key] = val;
      }
      setDetailData({ ...clinic, ...mapped, id: clinic.id });
    } catch (err) {
      setDetailData(clinic);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadAvailability = useCallback(async (clinicId) => {
    try {
      const res = await getClinicAvailability(clinicId);
      setAvailability(res?.data || []);
    } catch (err) {
      setAvailability([]);
    }
  }, []);

  useEffect(() => {
    if (!availability || availability.length === 0) {
      setTemplateForm({ sourceDate: '', startDate: '', endDate: '', weekdays: [] });
      setTemplateError(null);
      return;
    }
    const grouped = groupAvailabilityRows(availability);
    setTemplateForm((prev) => {
      if (prev.sourceDate) return prev;
      return { ...prev, sourceDate: grouped[0]?.isoDate || grouped[0]?.fmDate || '' };
    });
  }, [availability]);

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
      const cleanedValues = {
        ...editValues,
        stopCode: normalizeStopCode(editValues.stopCode),
      };
      const stopCodeChanged = cleanedValues.stopCode !== normalizeStopCode(detailData.stopCode || '');
      if (stopCodeChanged && !findStopCodeMatch(stopCodes, cleanedValues.stopCode)) {
        throw new Error('Stop code must match a live File 40.7 entry.');
      }
      for (const ef of EDIT_FIELDS) {
        const nextValue = cleanedValues[ef.key] || '';
        if (nextValue !== (detailData[ef.key] || '')) {
          await updateClinicField(detailData.id, ef.field, nextValue);
        }
      }
      setEditing(false);
      setSaveMsg('Changes saved successfully.');
      setTimeout(() => setSaveMsg(null), 4000);
      await loadData();
      await loadDetail({ ...detailData, ...cleanedValues, id: detailData.id });
    } catch (err) {
      setActionError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (forceDuplicate = false) => {
    const allowDuplicate = forceDuplicate === true;
    if (!createForm.name.trim()) return;
    const sc = normalizeStopCode(createForm.stopCode);
    if (!/^\d{1,3}$/.test(sc)) {
      setCreateError('Stop code must be 1 to 3 digits and match File 40.7.');
      return;
    }
    if (!findStopCodeMatch(stopCodes, sc)) {
      setCreateError('Stop code must match a live File 40.7 entry.');
      return;
    }

    const duplicateMatches = findExactClinicNameMatches(clinics, createForm.name);
    if (duplicateMatches.length > 0 && !allowDuplicate) {
      setDuplicateCreateWarning({
        name: createForm.name.trim(),
        matchCount: duplicateMatches.length,
      });
      return;
    }

    setCreating(true);
    setCreateError(null);
    setDuplicateCreateWarning(null);
    try {
      const res = await createClinic({ name: createForm.name.trim(), stopCode: sc });
      const ien = res?.newIen;
      if (ien) {
        await updateClinicField(ien, '8', sc);
        const appt = createForm.apptLength?.trim();
        if (appt) await updateClinicField(ien, '1912', appt);
        const maxSlot = createForm.maxApptsPerSlot;
        if (maxSlot !== '' && maxSlot != null && !Number.isNaN(Number(maxSlot))) {
          await updateClinicField(ien, '1918', String(maxSlot));
        }
        const prov = createForm.defaultProvider.trim();
        if (prov) await updateClinicField(ien, '16', prov);
      }
      setShowCreateModal(false);
      setCreateForm({ name: '', stopCode: '', apptLength: '30', maxApptsPerSlot: '', defaultProvider: '' });
      await loadData();
    } catch (err) {
      setCreateError(err.message || 'Failed to create clinic');
    } finally {
      setCreating(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!display?.id) return;
    const grouped = groupAvailabilityRows(availability || []);
    const sourceGroup = grouped.find((group) => group.isoDate === templateForm.sourceDate || group.fmDate === templateForm.sourceDate);
    if (!sourceGroup) {
      setTemplateError('Select an existing availability date to use as the source pattern.');
      return;
    }
    if (!templateForm.startDate || !templateForm.endDate) {
      setTemplateError('Select a start and end date for the template range.');
      return;
    }
    if (templateForm.endDate < templateForm.startDate) {
      setTemplateError('End date must be on or after the start date.');
      return;
    }
    if (!templateForm.weekdays.length) {
      setTemplateError('Select at least one weekday to receive the template.');
      return;
    }

    setApplyingTemplate(true);
    setTemplateError(null);
    try {
      const existingDates = new Set(grouped.map((group) => group.isoDate).filter(Boolean));
      const selectedWeekdays = new Set(templateForm.weekdays);
      const cursor = new Date(`${templateForm.startDate}T00:00:00`);
      const end = new Date(`${templateForm.endDate}T00:00:00`);
      let appliedDates = 0;
      let skippedDates = 0;
      let appliedRows = 0;

      while (cursor <= end) {
        const isoDate = toLocalIsoDate(cursor);
        if (selectedWeekdays.has(cursor.getDay())) {
          if (existingDates.has(isoDate)) {
            skippedDates += 1;
          } else {
            for (const entry of sourceGroup.entries) {
              await setClinicAvailability(display.id, {
                date: isoToUsDate(isoDate),
                slotData: entry.data,
              });
              appliedRows += 1;
            }
            appliedDates += 1;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (!appliedDates) {
        setTemplateError('No dates were updated. All selected dates already had availability.');
        return;
      }

      setSaveMsg(`Applied schedule template to ${appliedDates} date(s) using ${appliedRows} availability row(s).${skippedDates ? ` Skipped ${skippedDates} date(s) that already had availability.` : ''}`);
      setTimeout(() => setSaveMsg(null), 5000);
      await loadAvailability(display.id);
    } catch (err) {
      setTemplateError(err.message || 'Failed to apply schedule template');
    } finally {
      setApplyingTemplate(false);
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
  const groupedAvailability = groupAvailabilityRows(availability || []);
  const createStopCodeMatch = findStopCodeMatch(stopCodes, createForm.stopCode);
  const editStopCodeMatch = findStopCodeMatch(stopCodes, editValues.stopCode);
  const createProviderValue = createForm.defaultProvider || '';
  const editProviderValue = editValues.defaultProvider || '';

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
              <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', stopCode: '', apptLength: '30', maxApptsPerSlot: '', defaultProvider: '' }); }}
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

            {loading ? <TableSkeleton rows={10} cols={5} /> : clinics.length === 0 ? (
              <div className="py-12 text-center border border-[#E2E4E8] rounded-lg bg-white">
                <p className="text-sm text-gray-500 mb-4">No clinics configured yet. Create your first clinic.</p>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', stopCode: '', apptLength: '30', maxApptsPerSlot: '', defaultProvider: '' }); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Clinic
                </button>
              </div>
            ) : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            {!loading && clinics.length > 0 && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />
            )}

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
                        {ef.key === 'defaultProvider' ? (
                          <select
                            value={editProviderValue}
                            onChange={e => setEditValues(prev => ({ ...prev, defaultProvider: e.target.value }))}
                            title={ef.help}
                            className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] bg-white"
                          >
                            <option value="">Select provider...</option>
                            {!providers.some((provider) => provider.name === editProviderValue) && editProviderValue && (
                              <option value={editProviderValue}>{editProviderValue} (current)</option>
                            )}
                            {providers.map((provider) => (
                              <option key={provider.duz || provider.name} value={provider.name}>{providerOptionLabel(provider)}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={editValues[ef.key] || ''}
                            onChange={e => setEditValues(prev => ({
                              ...prev,
                              [ef.key]: ef.key === 'stopCode' ? normalizeStopCode(e.target.value) : e.target.value,
                            }))}
                            title={ef.help}
                            list={ef.key === 'stopCode' ? STOP_CODE_LIST_ID : undefined}
                            maxLength={ef.key === 'stopCode' ? 3 : undefined}
                            className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                        )}
                        {ef.key === 'stopCode' && editValues.stopCode && (
                          <p className={`text-[10px] mt-0.5 ${editStopCodeMatch ? 'text-[#2D6A4F]' : 'text-[#CC3333]'}`}>
                            {editStopCodeMatch ? `File 40.7: ${editStopCodeMatch.description}` : 'Stop code not found in File 40.7.'}
                          </p>
                        )}
                        {ef.key === 'defaultProvider' && providersError && (
                          <p className="text-[10px] text-[#CC3333] mt-0.5">{providersError}</p>
                        )}
                        {ef.key === 'defaultProvider' && providersLoading && (
                          <p className="text-[10px] text-[#999] mt-0.5">Loading active providers...</p>
                        )}
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
              <div>
                <div className="p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2 mb-4">
                  <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
                  <span>Scheduling availability shows the configured appointment slots for this clinic. Templates copy one existing day&apos;s availability rows onto future empty dates without inventing new slot syntax.</span>
                </div>
                {availability === null ? (
                  <div className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />
                ) : availability.length === 0 ? (
                  <div className="text-center py-8 text-[#999]">
                    <span className="material-symbols-outlined text-[32px] block mb-2">event_busy</span>
                    <p className="text-sm">No availability data configured for this clinic.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[#222]">Schedule Template</h3>
                        <p className="text-[11px] text-[#666] mt-1">Choose a source date with working availability, then copy that pattern to selected weekdays in a date range. Existing dates are skipped because the current API does not support overwrite or delete.</p>
                      </div>
                      {templateError && (
                        <div className="p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[12px] text-[#CC3333] flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px]">error</span> {templateError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-[#333] mb-1">Source Date</label>
                          <select
                            value={templateForm.sourceDate}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, sourceDate: e.target.value }))}
                            className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] bg-white"
                          >
                            {groupedAvailability.map((group) => (
                              <option key={group.key} value={group.isoDate || group.fmDate}>{group.displayDate}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#333] mb-1">Start Date</label>
                          <input
                            type="date"
                            value={templateForm.startDate}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#333] mb-1">End Date</label>
                          <input
                            type="date"
                            value={templateForm.endDate}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#333] mb-1">Weekdays</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {WEEKDAY_OPTIONS.map((option) => {
                              const checked = templateForm.weekdays.includes(option.value);
                              return (
                                <label key={option.value} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] cursor-pointer ${checked ? 'border-[#2E5984] bg-[#EAF1F8] text-[#1A1A2E]' : 'border-[#E2E4E8] bg-white text-[#666]'}`}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={checked}
                                    onChange={() => setTemplateForm((prev) => ({
                                      ...prev,
                                      weekdays: checked
                                        ? prev.weekdays.filter((value) => value !== option.value)
                                        : [...prev.weekdays, option.value].sort((left, right) => left - right),
                                    }))}
                                  />
                                  {option.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-[#666]">Template source preview: <span className="font-mono text-[#333]">{summarizeAvailability((groupedAvailability.find((group) => group.isoDate === templateForm.sourceDate || group.fmDate === templateForm.sourceDate) || {}).entries || []) || 'No source selected'}</span></p>
                        <button
                          type="button"
                          disabled={applyingTemplate}
                          onClick={handleApplyTemplate}
                          className="px-4 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40"
                        >
                          {applyingTemplate ? 'Applying...' : 'Apply Template'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {groupedAvailability.map((group) => (
                        <div key={group.key} className="p-3 bg-white border border-[#E2E4E8] rounded-lg text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-text">{group.displayDate}</div>
                              <div className="text-[11px] text-[#666] mt-1">{group.entries.length} availability row{group.entries.length === 1 ? '' : 's'}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTemplateForm((prev) => ({ ...prev, sourceDate: group.isoDate || group.fmDate }))}
                              className="px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]"
                            >
                              Use As Template
                            </button>
                          </div>
                          <div className="text-xs text-[#666] mt-2 font-mono break-all">{summarizeAvailability(group.entries)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <datalist id={STOP_CODE_LIST_ID}>
        {stopCodes.map((row) => (
          <option key={row.ien || row.code} value={row.code}>{row.description}</option>
        ))}
      </datalist>

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
                <input type="text" value={createForm.name} onChange={e => { setDuplicateCreateWarning(null); setCreateForm(f => ({ ...f, name: e.target.value })); }}
                  placeholder="e.g. Primary Care East"
                  title="Official name for this clinic (File #44 field .01). Appears in appointment scheduling, patient check-in, and workload reports."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Stop Code <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={createForm.stopCode} onChange={e => setCreateForm(f => ({ ...f, stopCode: normalizeStopCode(e.target.value) }))}
                  placeholder={stopCodesLoading ? 'Loading File 40.7 stop codes...' : '1-3 digits, e.g. 323'}
                  maxLength={3}
                  title="DSS workload stop code — validated against live File 40.7 data."
                  list={STOP_CODE_LIST_ID}
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                {createForm.stopCode && (
                  <p className={`text-[10px] mt-1 ${createStopCodeMatch ? 'text-[#2D6A4F]' : 'text-[#CC3333]'}`}>
                    {createStopCodeMatch ? `File 40.7: ${createStopCodeMatch.description}` : 'Stop code not found in File 40.7.'}
                  </p>
                )}
                {stopCodesError && <p className="text-[10px] text-[#CC3333] mt-1">{stopCodesError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Appointment Length</label>
                <select value={createForm.apptLength} onChange={e => setCreateForm(f => ({ ...f, apptLength: e.target.value }))}
                  title="Default appointment duration in minutes"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] bg-white">
                  {[15, 20, 30, 45, 60].map(m => <option key={m} value={String(m)}>{m} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Max Appointments Per Slot</label>
                <input type="number" min={0} value={createForm.maxApptsPerSlot} onChange={e => setCreateForm(f => ({ ...f, maxApptsPerSlot: e.target.value }))}
                  placeholder="e.g. 2"
                  title="Maximum overbooks per day for this clinic (File #44 field 1918)."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Default Provider</label>
                <select value={createProviderValue} onChange={e => setCreateForm(f => ({ ...f, defaultProvider: e.target.value }))}
                  title="Default provider for this clinic (File #44 field 16)."
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] bg-white">
                  <option value="">Select provider...</option>
                  {providers.map((provider) => <option key={provider.duz || provider.name} value={provider.name}>{providerOptionLabel(provider)}</option>)}
                </select>
                {providersLoading && <p className="text-[10px] text-[#999] mt-1">Loading active providers...</p>}
                {providersError && <p className="text-[10px] text-[#CC3333] mt-1">{providersError}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">Cancel</button>
              <button disabled={creating || stopCodesLoading || !createForm.name.trim() || !createForm.stopCode.length || !createStopCodeMatch} onClick={() => handleCreate()}
                className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                {creating ? 'Creating...' : 'Create Clinic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateCreateWarning && (
        <ConfirmDialog
          open
          title="Duplicate Clinic Name"
          message={`A clinic named "${duplicateCreateWarning.name}" already exists in File 44. Create anyway?`}
          confirmLabel="Create Anyway"
          onConfirm={() => handleCreate(true)}
          onCancel={() => setDuplicateCreateWarning(null)}
        />
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
