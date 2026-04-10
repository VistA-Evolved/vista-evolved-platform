import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getDevices, getDeviceDetail, createDevice, updateDeviceField, deleteDevice, testPrintDevice } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Device Management — System Settings page
 * @vista DEVICE #3.5 via GET/POST/PUT/DELETE /devices
 */

const columns = [
  { key: 'name', label: 'Device Name', bold: true },
  { key: 'dollarI', label: '$I (Port)' },
  { key: 'type', label: 'Type' },
  { key: 'subtype', label: 'Subtype' },
];

const PAGE_SIZE = 25;

const EDIT_FIELDS = [
  { key: 'name', label: 'Device Name', field: '.01', help: 'Logical name of this device (File #3.5 field .01). Referenced by print queues, HL7 interfaces, and user preferences.' },
  { key: 'dollarI', label: '$I (Port)', field: '1', help: 'M $I value — the port or channel identifier used by VistA to communicate with this device.' },
  { key: 'askDevice', label: 'Ask Device', field: '2', help: 'Prompt text shown when a user selects this device for output. Leave blank for no prompt.' },
  { key: 'type', label: 'Type', field: '3', help: 'Device class (e.g., TERMINAL, PRINTER, VIRTUAL, HFS). Determines how VistA opens the device.' },
  { key: 'subtype', label: 'Subtype', field: '4', help: 'Device subtype defining escape sequences and formatting (e.g., P-OTHER, C-VT100).' },
  { key: 'location', label: 'Location', field: '5', help: 'Physical location of this device within the facility.' },
  { key: 'rightMargin', label: 'Right Margin', field: '6', help: 'Right margin (number of columns). Standard is 80 for terminals, 132 for wide printers.' },
  { key: 'formFeed', label: 'Form Feed', field: '7', help: 'Form feed character or sequence sent between pages. Leave blank for default behavior.' },
  { key: 'pageLength', label: 'Page Length', field: '8', help: 'Number of lines per page. Standard is 24 for terminals, 60 for printers.' },
  { key: 'closeExecute', label: 'Close Execute', field: '9', help: 'M code executed when the device is closed. Use for cleanup or post-processing.' },
  { key: 'openParameters', label: 'Open Parameters', field: '10', help: 'Parameters passed to the M OPEN command when opening this device.' },
  { key: 'closeParameters', label: 'Close Parameters', field: '11', help: 'Parameters passed to the M CLOSE command when closing this device.' },
  { key: 'outOfService', label: 'Out of Service', field: '50', help: 'When set, this device cannot be selected for printing or output. Existing queued jobs may still attempt to use it.' },
];

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', dollarI: '', type: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'delete' | 'testPrint' }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDevices();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `device-${i}`,
        name: d.name || '',
        dollarI: d.dollarI || '',
        type: d.type || '',
        subtype: d.subtype || '',
      }));
      setDevices(items);
    } catch (err) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = useCallback(async (device) => {
    setSelectedDevice(device);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    try {
      const res = await getDeviceDetail(device.id);
      const d = res?.data || {};
      setDetailData({ ...device, ...d, id: device.id });
    } catch {
      setDetailData(device);
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
          await updateDeviceField(detailData.id, ef.field, editValues[ef.key]);
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
      await createDevice({ name: createForm.name.trim(), dollarI: createForm.dollarI.trim(), type: createForm.type.trim() });
      setShowCreateModal(false);
      setCreateForm({ name: '', dollarI: '', type: '' });
      await loadData();
    } catch (err) {
      setCreateError(err.message || 'Failed to create device');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!detailData) return;
    try {
      await deleteDevice(detailData.id);
      setConfirmAction(null);
      setSelectedDevice(null);
      setDetailData(null);
      await loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to delete device');
      setConfirmAction(null);
    }
  };

  const handleTestPrint = async () => {
    if (!detailData) return;
    try {
      await testPrintDevice(detailData.id);
      setConfirmAction(null);
      setSaveMsg('Test print job sent to device.');
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (err) {
      setActionError(err.message || 'Test print failed');
      setConfirmAction(null);
    }
  };

  const filtered = devices.filter(d => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return d.name.toLowerCase().includes(s) || d.dollarI.toLowerCase().includes(s) || d.type.toLowerCase().includes(s) || d.subtype.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Devices">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const display = detailData || selectedDevice;

  return (
    <AppShell breadcrumb="Admin > Devices">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${display ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Device Management</h1>
                <p className="text-sm text-[#666] mt-1">
                  Manage system hardware devices — printers, terminals, and virtual ports.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({devices.length} devices)</span>}
                </p>
              </div>
              <button onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateForm({ name: '', dollarI: '', type: '' }); }}
                title="Create a new device entry in VistA File #3.5"
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Device
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search devices by name, port, type, or subtype..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>

            {loading ? <TableSkeleton rows={10} cols={4} /> : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />

            <details className="mt-6 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
              <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
              <p className="mt-2">This page replaces: <strong>Kernel → Device Management</strong></p>
              <p className="mt-1">VistA File: <strong>DEVICE (#3.5)</strong></p>
              <p className="mt-1">Terminal provides: Create, edit, delete devices. Test print to verify connectivity.</p>
              <p className="mt-1">$I values must match the M environment. Common types: TERMINAL, PRINTER, VIRTUAL, HFS.</p>
            </details>
          </div>
        </div>

        {display && (
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{display.name}</h2>
              <div className="flex items-center gap-2">
                {!editing && (
                  <>
                    <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-white" title="Edit device fields">
                      <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                    </button>
                    <button onClick={() => setConfirmAction({ type: 'testPrint' })}
                      title="Send a test print job to verify the device is reachable and configured correctly"
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[#2E5984] border border-[#2E5984] rounded-md hover:bg-[#E8F1FA]">
                      <span className="material-symbols-outlined text-[14px]">print</span> Test Print
                    </button>
                    <button onClick={() => setConfirmAction({ type: 'delete' })}
                      title="Permanently delete this device entry from VistA"
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[#CC3333] border border-[#CC3333] rounded-md hover:bg-[#FDE8E8]">
                      <span className="material-symbols-outlined text-[14px]">delete</span> Delete
                    </button>
                  </>
                )}
                <button onClick={() => { setSelectedDevice(null); setDetailData(null); setEditing(false); }}
                  className="text-[#999] hover:text-[#222]" aria-label="Close detail panel">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
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
                        <p className="text-sm">No additional details available.</p>
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

      {confirmAction?.type === 'delete' && (
        <ConfirmDialog
          open
          title="Delete Device"
          message={`Permanently delete "${display?.name}"? This removes the device entry from VistA File #3.5. Any print queues or references pointing to this device will break. This action cannot be undone.`}
          confirmLabel="Delete Device"
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
          destructive
        />
      )}

      {confirmAction?.type === 'testPrint' && (
        <ConfirmDialog
          open
          title="Test Print"
          message={`Send a test print job to "${display?.name}"? This verifies the device is reachable and configured correctly.`}
          confirmLabel="Send Test Print"
          onConfirm={handleTestPrint}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#222]">Add Device</h3>
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
                <label className="block text-xs font-medium text-[#333] mb-1">Device Name <span className="text-[#CC3333]">*</span></label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. PRINTER-3A-EAST"
                  title="Logical name of this device (File #3.5 field .01)"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">$I (Port)</label>
                <input type="text" value={createForm.dollarI} onChange={e => setCreateForm(f => ({ ...f, dollarI: e.target.value }))}
                  placeholder="e.g. |TCP|5000"
                  title="M $I value — the port or channel identifier used by VistA to communicate with this device"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#333] mb-1">Type</label>
                <input type="text" value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                  placeholder="e.g. PRINTER, TERMINAL, VIRTUAL"
                  title="Device class — determines how VistA opens the device"
                  className="w-full h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">Cancel</button>
              <button disabled={creating || !createForm.name.trim()} onClick={handleCreate}
                className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                {creating ? 'Creating...' : 'Create Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
