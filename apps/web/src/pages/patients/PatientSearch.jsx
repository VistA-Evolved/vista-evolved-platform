import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { Pagination } from '../../components/shared/SharedComponents';
import { searchPatients, getPatientDashboardStats, getDivisions, assignBed } from '../../services/patientService';

const PAGE_SIZE = 10;

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    deceased: 'bg-gray-700 text-white',
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${styles[status] || styles.inactive}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}

function KpiCard({ label, value, icon, color }) {
  return (
    <div className="bg-white border border-[#E2E4E8] rounded-md p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-[22px] font-bold text-[#1A1A2E]">{value ?? '—'}</p>
        <p className="text-[11px] text-[#666] uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-t border-[#E2E4E8] animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

function formatDob(dob) {
  if (!dob) return '';
  const d = new Date(dob + 'T00:00:00');
  const age = Math.floor((Date.now() - d.getTime()) / 31557600000);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${age}y)`;
}

function formatSex(sex) {
  if (sex === 'M') return 'Male';
  if (sex === 'F') return 'Female';
  return sex || '—';
}

export default function PatientSearch() {
  useEffect(() => { document.title = 'Patient Search — VistA Evolved'; }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const assignBedContext = location.state?.assignBedContext;
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState('');
  const [idMode, setIdMode] = useState(false);
  const [dobFilter, setDobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [locationFilter, setLocationFilter] = useState('');

  const [patients, setPatients] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [divisions, setDivisions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [sensitiveModal, setSensitiveModal] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [acknowledgedDfns] = useState(() => new Set());
  const [assigningBed, setAssigningBed] = useState(false);
  const [registerDupModal, setRegisterDupModal] = useState(null);
  const [registerDupLoading, setRegisterDupLoading] = useState(false);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    getPatientDashboardStats()
      .then(res => setStats(res.data))
      .catch(() => {});

    getDivisions()
      .then(res => setDivisions(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDivisions([]));

    searchPatients('')
      .then(res => {
        const data = res.data || [];
        const withVisits = data
          .filter(p => p.recentVisits?.length > 0)
          .sort((a, b) => (b.recentVisits[0]?.date || '').localeCompare(a.recentVisits[0]?.date || ''));
        setRecentPatients(withVisits.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const executeSearch = useCallback(async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchPatients(searchQuery);
      setPatients(res.data || []);
      setHasSearched(true);
    } catch (err) {
      setError('Unable to reach the patient server. Please check your connection and try again.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);

    if (v.length === 0) {
      setHasSearched(false);
      setPatients([]);
      setPage(1);
      setSelectedPatient(null);
      return;
    }

    if (v.length >= 2) {
      debounceRef.current = setTimeout(() => {
        setPage(1);
        setSelectedPatient(null);
        executeSearch(v);
      }, 300);
    }
  };

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (locationFilter) {
      result = result.filter(p => p.registrationSite?.ien === locationFilter);
    }

    if (dobFilter) {
      result = result.filter(p => p.dob === dobFilter);
    }

    return result;
  }, [patients, statusFilter, locationFilter, dobFilter]);

  const pagedPatients = useMemo(
    () => filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPatients, page],
  );

  const completeBedAssignment = useCallback(async (patient) => {
    if (!assignBedContext || !patient?.dfn) return;
    setAssigningBed(true);
    setError(null);
    try {
      const res = await assignBed({
        patientDfn: patient.dfn,
        bedIen: assignBedContext.bedIen,
        wardIen: assignBedContext.wardIen,
        roomBed: assignBedContext.roomBed,
        unit: assignBedContext.unit,
      });
      if (!res.ok) {
        setError(res.error || 'Could not assign patient to bed');
        return;
      }
      navigate(`/patients/${patient.dfn}`, { replace: true, state: {} });
    } catch (err) {
      setError(err.message || 'Could not assign patient to bed');
    } finally {
      setAssigningBed(false);
    }
  }, [assignBedContext, navigate]);

  const guardRestricted = useCallback((patient, action) => {
    if (patient.isRestricted && !acknowledgedDfns.has(patient.dfn)) {
      setSensitiveModal(patient);
      setPendingAction(action);
      return true;
    }
    return false;
  }, [acknowledgedDfns]);

  const handleSensitiveAcknowledge = () => {
    if (!sensitiveModal) return;
    acknowledgedDfns.add(sensitiveModal.dfn);
    const action = pendingAction;
    const patient = sensitiveModal;
    setSensitiveModal(null);
    setPendingAction(null);
    if (action === 'navigate') {
      navigate(`/patients/${patient.dfn}`);
    } else if (action === 'edit') {
      navigate(`/patients/${patient.dfn}/edit`);
    } else if (action === 'assign-bed') {
      completeBedAssignment(patient);
    } else {
      setSelectedPatient(patient);
    }
  };

  const handleSensitiveCancel = () => {
    setSensitiveModal(null);
    setPendingAction(null);
  };

  const handleRowClick = (patient) => {
    if (assignBedContext) {
      if (guardRestricted(patient, 'assign-bed')) return;
      completeBedAssignment(patient);
      return;
    }
    if (guardRestricted(patient, 'preview')) return;
    setSelectedPatient(patient);
  };

  const handleNameClick = (e, patient) => {
    e.stopPropagation();
    if (assignBedContext) {
      if (guardRestricted(patient, 'assign-bed')) return;
      completeBedAssignment(patient);
      return;
    }
    if (guardRestricted(patient, 'navigate')) return;
    navigate(`/patients/${patient.dfn}`);
  };

  const handleEditClick = (e, patient) => {
    e.stopPropagation();
    if (guardRestricted(patient, 'edit')) return;
    navigate(`/patients/${patient.dfn}/edit`);
  };

  const handleRecentClick = (patient) => {
    if (assignBedContext) {
      if (guardRestricted(patient, 'assign-bed')) return;
      completeBedAssignment(patient);
      return;
    }
    if (guardRestricted(patient, 'navigate')) return;
    navigate(`/patients/${patient.dfn}`);
  };

  const handleRegisterNewPatient = async () => {
    const q = query.trim();
    const dob = dobFilter;
    if (q.length >= 2 && dob) {
      setRegisterDupLoading(true);
      setError(null);
      try {
        const res = await searchPatients(q);
        const matches = (res.data || []).filter(p => p.dob === dob);
        if (matches.length > 0) {
          setRegisterDupModal({ matches, dob });
          return;
        }
      } catch (_dupErr) {
        /* proceed to registration if duplicate search fails */
      } finally {
        setRegisterDupLoading(false);
      }
    }
    navigate('/patients/register');
  };

  const confirmRegisterDespiteDuplicates = () => {
    setRegisterDupModal(null);
    navigate('/patients/register');
  };

  const exportCSV = () => {
    if (filteredPatients.length === 0) return;
    const headers = ['Name', 'Date of Birth', 'Sex', 'Identifier', 'Location', 'Flags', 'Status'];
    const rows = filteredPatients.map(p => [
      p.name,
      p.dob || '',
      formatSex(p.sex),
      p.ssnLast4 ? `***${p.ssnLast4}` : '',
      p.registrationSite?.name || '',
      (p.flags || []).map(f => f.name).join('; '),
      p.status || '',
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `patient-list-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleRetry = () => {
    setError(null);
    if (query.length >= 2) {
      executeSearch(query);
    }
  };

  const hasActiveFilters = dobFilter || statusFilter !== 'active' || locationFilter;

  const clearFilters = () => {
    setDobFilter('');
    setStatusFilter('active');
    setLocationFilter('');
    setPage(1);
  };

  return (
    <AppShell breadcrumb="Patients">
      <div className="px-6 py-5">
        {/* ── Page Header ── */}
        {assignBedContext && (
          <div className="mb-4 px-4 py-3 bg-[#E8EEF5] border border-[#2E5984]/30 rounded-md text-sm text-[#1A1A2E] flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#2E5984] shrink-0">bed</span>
            <span>
              Select a patient below to assign to bed <strong>{location.state?.assignBed || assignBedContext.roomBed}</strong>
              {location.state?.assignUnit ? <> ({location.state.assignUnit})</> : null}. Admission will be submitted to VistA when you choose a row.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[28px] font-bold text-[#1A1A2E]">Patient Search</h1>
          <div className="flex items-center gap-3">
            {hasSearched && filteredPatients.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 border border-[#E2E4E8] text-sm font-medium text-[#1A1A2E] rounded-md hover:bg-[#F5F8FB] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Patient List
              </button>
            )}
            <button
              onClick={handleRegisterNewPatient}
              disabled={registerDupLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registerDupLoading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">person_add</span>
              )}
              Register New Patient
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-5">
            <KpiCard label="Total Patients" value={stats.totalPatients} icon="groups" color="#2E5984" />
            <KpiCard label="Active" value={stats.activePatients} icon="check_circle" color="#2E7D32" />
            <KpiCard label="Service Connected" value={stats.serviceConnectedVeterans} icon="military_tech" color="#E65100" />
            <KpiCard label="Flagged" value={stats.patientsWithFlags} icon="flag" color="#C62828" />
          </div>
        )}

        {/* ── Search Bar (largest visual element) ── */}
        <div className="mb-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#999] text-[22px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder={
                  idMode
                    ? 'Enter first letter of last name + last 4 digits e.g. S1234'
                    : 'Search by patient name...'
                }
                className="w-full h-14 pl-12 pr-4 border-2 border-[#E2E4E8] rounded-lg text-base text-[#333] placeholder:text-[#999] focus:outline-none focus:border-[#2E5984] focus:ring-2 focus:ring-[#2E5984]/20 transition-colors"
              />
              {query.length > 0 && query.length < 2 && (
                <p className="absolute -bottom-5 left-1 text-[11px] text-[#999]">
                  Type at least 2 characters to search
                </p>
              )}
            </div>
            <button
              onClick={() => setIdMode(prev => !prev)}
              title="Toggle ID search mode"
              className={`flex items-center gap-2 px-4 h-14 rounded-lg border-2 text-sm font-medium transition-colors whitespace-nowrap ${
                idMode
                  ? 'bg-[#2E5984] text-white border-[#2E5984]'
                  : 'bg-white text-[#555] border-[#E2E4E8] hover:bg-[#F5F8FB]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              ID Search
            </button>
          </div>

          {/* ── Filter Controls ── */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">DOB</label>
              <input
                type="date"
                value={dobFilter}
                onChange={e => { setDobFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] bg-white"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-wide text-[#666] font-semibold">Location</label>
              <select
                value={locationFilter}
                onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
                className="h-9 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] bg-white min-w-[180px]"
              >
                <option value="">All Locations</option>
                {divisions.map(d => (
                  <option key={d.ien} value={d.ien}>{d.name}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-[12px] text-[#2E5984] hover:underline font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {assigningBed && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#F0F4F8] border border-[#E2E4E8] rounded-md mb-4 text-sm text-[#555]">
            <span className="material-symbols-outlined animate-spin text-[18px] text-[#2E5984]">progress_activity</span>
            Assigning patient to bed…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md mb-4">
            <span className="material-symbols-outlined text-red-600 text-[20px]">error</span>
            <p className="text-sm text-red-800 flex-1">{error}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-sm font-medium text-red-700 hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Retry
            </button>
          </div>
        )}

        {/* ── Main Content Area ── */}
        <div className="flex gap-5">
          {/* Left: recent patients or search results */}
          <div className="flex-1 min-w-0">
            {/* Recent Patients Panel — visible before any search */}
            {!hasSearched && !loading && (
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#2E5984]">history</span>
                  Recent Patients
                </h2>
                {recentPatients.length === 0 ? (
                  <p className="text-sm text-[#999]">No recent patients to display. Use the search bar above to find a patient.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {recentPatients.map(p => (
                      <div
                        key={p.dfn}
                        onClick={() => handleRecentClick(p)}
                        className="bg-white border border-[#E2E4E8] rounded-md p-3.5 cursor-pointer hover:border-[#2E5984] hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-sm text-[#1A1A2E] group-hover:text-[#2E5984] truncate">
                            {p.name}
                          </p>
                          {p.flags?.length > 0 && (
                            <span className="material-symbols-outlined text-[16px] text-orange-500 shrink-0 ml-1">warning</span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#666] mt-1">{formatDob(p.dob)}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-[#999] truncate">{p.registrationSite?.name || '—'}</span>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Results Table */}
            {(hasSearched || loading) && (
              <>
                {!loading && filteredPatients.length > 0 && (
                  <p className="text-sm text-[#666] mb-2">
                    <strong className="text-[#1A1A2E]">{filteredPatients.length}</strong> patient{filteredPatients.length !== 1 ? 's' : ''} found
                  </p>
                )}

                <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1A1A2E] text-white text-left text-[12px] uppercase tracking-wide">
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Date of Birth</th>
                        <th className="px-4 py-3 font-semibold">Sex</th>
                        <th className="px-4 py-3 font-semibold">Identifier</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold w-[70px]">Flags</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold w-[70px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                      {!loading && pagedPatients.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center">
                            <span className="material-symbols-outlined text-[48px] text-[#ccc] mb-3 block">
                              person_search
                            </span>
                            <p className="text-[#666] mb-4">No patients found matching your search</p>
                            <button
                              onClick={handleRegisterNewPatient}
                              disabled={registerDupLoading}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[18px]">person_add</span>
                              Register New Patient
                            </button>
                          </td>
                        </tr>
                      )}

                      {!loading && pagedPatients.map((p, idx) => (
                        <tr
                          key={p.dfn}
                          onClick={() => handleRowClick(p)}
                          className={`border-t border-[#E2E4E8] cursor-pointer hover:bg-[#EDF2F7] transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F8FB]'
                          } ${selectedPatient?.dfn === p.dfn ? 'ring-2 ring-inset ring-[#2E5984]' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => handleNameClick(e, p)}
                              className="font-semibold text-[#1A1A2E] hover:text-[#2E5984] hover:underline text-left"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-[#555]">{formatDob(p.dob)}</td>
                          <td className="px-4 py-3 text-[#555]">{formatSex(p.sex)}</td>
                          <td className="px-4 py-3 font-mono text-[12px] text-[#555]">
                            {p.ssnLast4 ? `***${p.ssnLast4}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-[#555] truncate max-w-[180px]">
                            {p.registrationSite?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.flags?.length > 0 ? (
                              <span
                                className="material-symbols-outlined text-[18px] text-orange-500"
                                title={p.flags.map(f => f.name).join(', ')}
                              >
                                warning
                              </span>
                            ) : (
                              <span className="text-[#ccc]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => handleEditClick(e, p)}
                              className="text-[#2E5984] hover:text-[#1A1A2E] transition-colors"
                              title="Edit Demographics"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={filteredPatients.length}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>

          {/* ── Right-side Preview Panel ── */}
          {selectedPatient && (
            <div className="w-[360px] shrink-0 bg-white border border-[#E2E4E8] rounded-md overflow-hidden self-start sticky top-20">
              <div className="bg-[#1A1A2E] px-5 py-4 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Patient Preview</h3>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-lg font-bold text-[#1A1A2E]">{selectedPatient.name}</p>
                  {selectedPatient.preferredName && (
                    <p className="text-[12px] text-[#666]">Goes by: {selectedPatient.preferredName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold">Date of Birth</p>
                    <p className="text-[#333] mt-0.5">{formatDob(selectedPatient.dob)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold">Sex</p>
                    <p className="text-[#333] mt-0.5">{formatSex(selectedPatient.sex)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold">SSN (Last 4)</p>
                    <p className="text-[#333] font-mono mt-0.5">
                      {selectedPatient.ssnLast4 ? `***${selectedPatient.ssnLast4}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold">Status</p>
                    <div className="mt-0.5"><StatusBadge status={selectedPatient.status} /></div>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold mb-1">Location</p>
                  <p className="text-sm text-[#333]">{selectedPatient.registrationSite?.name || '—'}</p>
                  {selectedPatient.admitted && selectedPatient.roomBed && (
                    <p className="text-[12px] text-[#2E5984] mt-0.5">
                      Inpatient — Room {selectedPatient.roomBed}
                    </p>
                  )}
                </div>

                {selectedPatient.flags?.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold mb-1.5">Flags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPatient.flags.map((f, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[11px] font-medium"
                        >
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          {f.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient.recentVisits?.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[#999] font-semibold mb-1">Recent Visit</p>
                    <p className="text-sm text-[#333]">{selectedPatient.recentVisits[0].clinic}</p>
                    <p className="text-[12px] text-[#666]">
                      {selectedPatient.recentVisits[0].date} — {selectedPatient.recentVisits[0].type}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2 border-t border-[#E2E4E8]">
                  <button
                    onClick={() => navigate(`/patients/${selectedPatient.dfn}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">dashboard</span>
                    View Dashboard
                  </button>
                  <button
                    onClick={() => navigate(`/patients/${selectedPatient.dfn}/edit`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E2E4E8] text-sm font-medium text-[#1A1A2E] rounded-md hover:bg-[#F5F8FB] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit Demographics
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Possible duplicate(s) before registration ── */}
      {registerDupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-700 text-[22px]">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A2E]">Possible duplicate records</h3>
            </div>
            <p className="text-sm text-[#555] mb-4">
              Found {registerDupModal.matches.length} patient{registerDupModal.matches.length !== 1 ? 's' : ''} with the same search name and date of birth ({registerDupModal.dob}). Open an existing chart or continue only if this is a different person.
            </p>
            <ul className="max-h-40 overflow-y-auto border border-[#E2E4E8] rounded-md divide-y divide-[#E2E4E8] mb-5 text-sm">
              {registerDupModal.matches.map(p => (
                <li key={p.dfn} className="px-3 py-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-[#1A1A2E]">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => { setRegisterDupModal(null); navigate(`/patients/${p.dfn}`); }}
                    className="text-[12px] text-[#2E5984] font-medium hover:underline shrink-0"
                  >
                    Open chart
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRegisterDupModal(null)}
                className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRegisterDespiteDuplicates}
                className="px-4 py-2 text-sm bg-amber-700 text-white rounded-md hover:bg-amber-800 transition-colors"
              >
                Continue registration anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sensitive Patient Modal ── */}
      {sensitiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-600 text-[22px]">shield</span>
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A2E]">Sensitive Record</h3>
            </div>
            <p className="text-sm text-[#555] mb-6 leading-relaxed">
              This patient record is flagged as sensitive. Access is being logged.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleSensitiveCancel}
                className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSensitiveAcknowledge}
                className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors"
              >
                I Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
