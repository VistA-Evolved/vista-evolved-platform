import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getBeds, getWards, updateBed, addBed, deleteBed, getCensus } from '../../services/patientService';

const STATUS_COLORS = {
  available: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800', label: 'Available' },
  occupied:  { bg: 'bg-blue-100',  border: 'border-blue-400',  text: 'text-blue-800',  label: 'Occupied' },
  reserved:  { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800', label: 'Cleaning' },
  blocked:   { bg: 'bg-red-100',   border: 'border-red-400',   text: 'text-red-800',   label: 'Blocked' },
};

const REFRESH_INTERVAL = 30000;

export default function BedManagement() {
  const navigate = useNavigate();
  const [beds, setBeds] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState(null);
  const [wardFilter, setWardFilter] = useState('all');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loadingWards, setLoadingWards] = useState(false);
  const [activeTab, setActiveTab] = useState('beds');
  const [censusData, setCensusData] = useState([]);
  const [censusLoading, setCensusLoading] = useState(false);
  const [showAddBed, setShowAddBed] = useState(false);
  const [newBedForm, setNewBedForm] = useState({ room: '', bed: '', ward: '' });
  const [bedSaving, setBedSaving] = useState(false);
  const [deleteBedTarget, setDeleteBedTarget] = useState(null);
  const refreshTimer = useRef(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [bedRes, wardRes] = await Promise.allSettled([
        getBeds(),
        getWards(),
      ]);
      if (bedRes.status === 'fulfilled') setBeds(bedRes.value.data || []);
      if (wardRes.status === 'fulfilled') setWards(wardRes.value.data || []);
      setLastRefresh(new Date());
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    refreshTimer.current = setInterval(() => fetchData(false), REFRESH_INTERVAL);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchData]);

  const wardList = wards.length > 0
    ? wards.map(w => ({ ien: w.ien, name: w.name }))
    : [...new Set(beds.map(b => b.unit))].map(u => ({ ien: u, name: u }));

  const filteredBeds = wardFilter === 'all'
    ? beds
    : beds.filter(b => {
        const wName = wardList.find(w => w.ien === wardFilter)?.name;
        return b.unit === wName || b.unit === wardFilter || b.wardIen === wardFilter;
      });

  const units = [...new Set(filteredBeds.map(b => b.unit))];
  const totalBeds = filteredBeds.length;
  const occupied = filteredBeds.filter(b => b.status === 'occupied').length;
  const available = filteredBeds.filter(b => b.status === 'available').length;
  const blocked = filteredBeds.filter(b => b.status === 'blocked').length;
  const cleaning = filteredBeds.filter(b => b.status === 'reserved').length;
  const occupancyPct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

  const handleBedClick = (bed) => {
    setSelectedBed(bed);
  };

  const handleAssignPatient = (bed) => {
    navigate('/patients', { state: { assignBed: bed.bed, assignUnit: bed.unit } });
  };

  const handleUnblock = async (bed) => {
    try {
      await updateBed(bed.ien || bed.id, { outOfService: '' });
      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, status: 'available' } : b));
      setSelectedBed(prev => prev?.id === bed.id ? { ...prev, status: 'available' } : prev);
    } catch {
      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, status: 'available' } : b));
      setSelectedBed(prev => prev?.id === bed.id ? { ...prev, status: 'available' } : prev);
    }
  };

  const handleBlock = async (bed) => {
    try {
      await updateBed(bed.ien || bed.id, { outOfService: 'Y' });
      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, status: 'blocked' } : b));
      setSelectedBed(prev => prev?.id === bed.id ? { ...prev, status: 'blocked' } : prev);
    } catch {
      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, status: 'blocked' } : b));
      setSelectedBed(prev => prev?.id === bed.id ? { ...prev, status: 'blocked' } : prev);
    }
  };

  const handleDeleteBed = (bed) => {
    setDeleteBedTarget(bed);
  };

  const confirmDeleteBed = async () => {
    const bed = deleteBedTarget;
    if (!bed) return;
    setDeleteBedTarget(null);
    try {
      await deleteBed(bed.ien || bed.id);
      setBeds(prev => prev.filter(b => b.id !== bed.id));
      if (selectedBed?.id === bed.id) setSelectedBed(null);
    } catch { /* Non-fatal */ }
  };

  const handleAddBed = async () => {
    if (!newBedForm.room.trim() || !newBedForm.bed.trim() || !newBedForm.ward) return;
    setBedSaving(true);
    try {
      await addBed({ room: newBedForm.room, bed: newBedForm.bed, wardIen: newBedForm.ward });
      setShowAddBed(false);
      setNewBedForm({ room: '', bed: '', ward: '' });
      fetchData(false);
    } catch { /* Non-fatal, refresh will reconcile */ }
    finally { setBedSaving(false); }
  };

  const loadCensus = useCallback(async () => {
    setCensusLoading(true);
    try {
      const ward = wardFilter !== 'all' ? wardFilter : undefined;
      const res = await getCensus(ward);
      setCensusData(res?.data || []);
    } catch { setCensusData([]); }
    finally { setCensusLoading(false); }
  }, [wardFilter]);

  return (
    <AppShell breadcrumb="Patients › Bed Management">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[28px] font-bold text-[#1A1A2E]">Bed Management</h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[11px] text-[#999]">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setShowAddBed(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1A1A2E] text-white text-[12px] font-medium rounded-md hover:bg-[#2E5984]">
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add Bed
            </button>
            <button
              onClick={() => fetchData(false)}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E4E8] text-[12px] rounded-md hover:bg-[#F0F4F8]">
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Beds', value: totalBeds, icon: 'bed', color: '#2E5984' },
            { label: 'Occupied', value: occupied, icon: 'person', color: '#1565C0' },
            { label: 'Available', value: available, icon: 'check_circle', color: '#2E7D32' },
            { label: 'Blocked', value: blocked, icon: 'block', color: '#C62828' },
            { label: 'Occupancy', value: `${occupancyPct}%`, icon: 'analytics', color: '#6A1B9A' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-[#E2E4E8] rounded-md p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: `${c.color}15` }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: c.color }}>{c.icon}</span>
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#1A1A2E]">{c.value}</p>
                <p className="text-[11px] text-[#666] uppercase tracking-wide">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[#E2E4E8] mb-5">
          <button onClick={() => setActiveTab('beds')}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'beds' ? 'border-[#1A1A2E] text-[#1A1A2E]' : 'border-transparent text-[#888] hover:text-[#333]'}`}>
            Bed Board
          </button>
          <button onClick={() => { setActiveTab('census'); loadCensus(); }}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === 'census' ? 'border-[#1A1A2E] text-[#1A1A2E]' : 'border-transparent text-[#888] hover:text-[#333]'}`}>
            Census
          </button>
        </div>

        {/* Ward Filter & Legend */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-medium text-[#555]">Filter by Nursing Unit:</label>
            <select
              value={wardFilter}
              onChange={e => { setWardFilter(e.target.value); setSelectedBed(null); }}
              className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm bg-white focus:outline-none focus:border-[#2E5984]">
              <option value="all">All Units</option>
              {wardList.map(w => <option key={w.ien} value={w.ien}>{w.name}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            {Object.entries(STATUS_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-[12px]">
                <div className={`w-3 h-3 rounded ${val.bg} ${val.border} border`} />
                <span className="text-[#555]">{val.label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
          </div>
        ) : activeTab === 'beds' ? (
          <div className="grid grid-cols-3 gap-5">
            {/* Bed Board */}
            <div className="col-span-2 space-y-5">
              {units.length === 0 ? (
                <div className="text-center py-12 border border-[#E2E4E8] rounded-md bg-[#FAFBFC]">
                  <span className="material-symbols-outlined text-[40px] text-[#ccc] mb-2 block">bed</span>
                  <p className="text-[#888]">No beds found for the selected filter</p>
                </div>
              ) : units.map(unit => {
                const unitBeds = filteredBeds.filter(b => b.unit === unit);
                return (
                  <div key={unit} className="border border-[#E2E4E8] rounded-md overflow-hidden">
                    <div className="px-4 py-3 bg-[#1A1A2E] text-white flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold">{unit}</h3>
                      <span className="text-[12px] text-white/70">
                        {unitBeds.filter(b => b.status === 'available').length} / {unitBeds.length} available
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-5 gap-2">
                      {unitBeds.map(bed => {
                        const st = STATUS_COLORS[bed.status] || STATUS_COLORS.blocked;
                        const isSelected = selectedBed?.id === bed.id;
                        return (
                          <button key={bed.id}
                            onClick={() => handleBedClick(bed)}
                            className={`p-3 rounded-md border-2 text-left transition-all ${st.bg} ${isSelected ? 'border-[#1A1A2E] ring-2 ring-[#2E5984]/30' : st.border} hover:shadow-md`}>
                            <p className={`text-[13px] font-bold ${st.text}`}>{bed.bed}</p>
                            {bed.status === 'occupied' && bed.patient && (
                              <p className="text-[10px] text-[#555] mt-0.5 truncate">{bed.patient}</p>
                            )}
                            <p className={`text-[9px] mt-1 font-medium uppercase tracking-wide ${st.text}`}>{st.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel */}
            <div className="border border-[#E2E4E8] rounded-md p-4 h-fit sticky top-14">
              {selectedBed ? (
                <div>
                  <h3 className="text-[16px] font-semibold text-[#1A1A2E] mb-3">Bed {selectedBed.bed}</h3>
                  <div className="space-y-3 text-[13px]">
                    <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                      <span className="text-[#888]">Unit</span>
                      <span className="text-[#333] font-medium">{selectedBed.unit}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                      <span className="text-[#888]">Status</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_COLORS[selectedBed.status]?.bg} ${STATUS_COLORS[selectedBed.status]?.text}`}>
                        {STATUS_COLORS[selectedBed.status]?.label}
                      </span>
                    </div>
                    {selectedBed.status === 'occupied' && selectedBed.patient && (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                          <span className="text-[#888]">Patient</span>
                          <span className="text-[#333] font-medium">{selectedBed.patient}</span>
                        </div>
                        {selectedBed.patientDfn && (
                          <button onClick={() => navigate(`/patients/${selectedBed.patientDfn}`)}
                            className="w-full mt-2 px-3 py-2 bg-[#E8EEF5] text-[#2E5984] text-[12px] font-medium rounded-md hover:bg-[#D5E1EF] transition-colors">
                            View Patient Dashboard
                          </button>
                        )}
                      </>
                    )}
                    {selectedBed.status === 'available' && (
                      <>
                        <button
                          onClick={() => handleAssignPatient(selectedBed)}
                          className="w-full mt-2 px-3 py-2 bg-[#1A1A2E] text-white text-[12px] font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                          Assign Patient
                        </button>
                        <button
                          onClick={() => handleBlock(selectedBed)}
                          className="w-full mt-1 px-3 py-2 border border-red-200 text-red-700 text-[12px] font-medium rounded-md hover:bg-red-50 transition-colors">
                          Block Bed
                        </button>
                      </>
                    )}
                    {selectedBed.status === 'blocked' && (
                      <button
                        onClick={() => handleUnblock(selectedBed)}
                        className="w-full mt-2 px-3 py-2 border border-red-200 text-red-700 text-[12px] font-medium rounded-md hover:bg-red-50 transition-colors">
                        Unblock Bed
                      </button>
                    )}
                    {selectedBed.status !== 'occupied' && (
                      <button
                        onClick={() => handleDeleteBed(selectedBed)}
                        className="w-full mt-1 px-3 py-2 border border-[#E2E4E8] text-[#888] text-[12px] font-medium rounded-md hover:bg-[#F5F8FB] transition-colors">
                        Remove Bed
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[32px] text-[#ccc] mb-2 block">bed</span>
                  <p className="text-[13px] text-[#999]">Select a bed to view details</p>
                </div>
              )}
            </div>
          </div>
        ) : /* Census Tab */ (
          <div>
            {censusLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
              </div>
            ) : censusData.length === 0 ? (
              <div className="text-center py-12 border border-[#E2E4E8] rounded-md bg-[#FAFBFC]">
                <span className="material-symbols-outlined text-[40px] text-[#ccc] mb-2 block">groups</span>
                <p className="text-[#888]">No census data available{wardFilter !== 'all' ? ' for this unit' : ''}</p>
              </div>
            ) : (
              <div className="border border-[#E2E4E8] rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#1A1A2E]">
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Patient</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Nursing Unit</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Room-Bed</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Admit Date</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">LOS</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Attending</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold text-xs uppercase tracking-wider">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {censusData.map((row, i) => (
                      <tr key={row.dfn || i} className={`border-t border-[#E2E4E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F5F8FB]'} hover:bg-[#E8EEF5] cursor-pointer`}
                          onClick={() => row.dfn && navigate(`/patients/${row.dfn}`)}>
                        <td className="px-4 py-2.5 font-medium text-[#2E5984]">{row.name || '—'}</td>
                        <td className="px-4 py-2.5 text-[#555]">{row.ward || row.unit || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[#333]">{row.roomBed || row.bed || '—'}</td>
                        <td className="px-4 py-2.5 text-[#555]">{row.admitDate || '—'}</td>
                        <td className="px-4 py-2.5 text-[#555]">{row.los != null ? `${row.los}d` : '—'}</td>
                        <td className="px-4 py-2.5 text-[#555]">{row.attending || '—'}</td>
                        <td className="px-4 py-2.5 text-[#555] max-w-[200px] truncate" title={row.diagnosis}>{row.diagnosis || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-[#F5F8FB] px-4 py-2 text-[11px] text-[#888] border-t border-[#E2E4E8]">
                  {censusData.length} patient{censusData.length !== 1 ? 's' : ''} on census
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-[11px] text-[#999] flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          Auto-refreshes every 30 seconds
        </div>
      </div>

      {/* Add Bed Modal */}
      {showAddBed && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddBed(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1A1A2E] mb-4">Add Bed</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#555] block mb-1">Nursing Unit</label>
                <select value={newBedForm.ward} onChange={e => setNewBedForm(f => ({ ...f, ward: e.target.value }))}
                  className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm">
                  <option value="">Select unit…</option>
                  {wardList.map(w => <option key={w.ien} value={w.ien}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#555] block mb-1">Room</label>
                <input type="text" value={newBedForm.room} onChange={e => setNewBedForm(f => ({ ...f, room: e.target.value }))}
                  className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm" placeholder="e.g. 101" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555] block mb-1">Bed</label>
                <input type="text" value={newBedForm.bed} onChange={e => setNewBedForm(f => ({ ...f, bed: e.target.value }))}
                  className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm" placeholder="e.g. A" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAddBed(false)} className="px-4 py-2 text-xs border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">Cancel</button>
              <button onClick={handleAddBed} disabled={bedSaving || !newBedForm.room.trim() || !newBedForm.bed.trim() || !newBedForm.ward}
                className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                {bedSaving ? 'Saving…' : 'Add Bed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBedTarget && (
        <ConfirmDialog
          title="Remove bed"
          message={`Remove bed ${deleteBedTarget.bed} in room ${deleteBedTarget.room || '?'}? This cannot be undone.`}
          confirmLabel="Remove bed"
          onConfirm={confirmDeleteBed}
          onCancel={() => setDeleteBedTarget(null)}
          destructive
        />
      )}
    </AppShell>
  );
}
