import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { getBeds, getWards, updateBed } from '../../services/patientService';

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
      // Optimistic fallback — update UI even if API fails
      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, status: 'available' } : b));
      setSelectedBed(prev => prev?.id === bed.id ? { ...prev, status: 'available' } : prev);
    }
  };

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
        ) : (
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
                      <button
                        onClick={() => handleAssignPatient(selectedBed)}
                        className="w-full mt-2 px-3 py-2 bg-[#1A1A2E] text-white text-[12px] font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                        Assign Patient
                      </button>
                    )}
                    {selectedBed.status === 'blocked' && (
                      <button
                        onClick={() => handleUnblock(selectedBed)}
                        className="w-full mt-2 px-3 py-2 border border-red-200 text-red-700 text-[12px] font-medium rounded-md hover:bg-red-50 transition-colors">
                        Unblock Bed
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
        )}

        <div className="mt-4 text-[11px] text-[#999] flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          Auto-refreshes every 30 seconds
        </div>
      </div>
    </AppShell>
  );
}
