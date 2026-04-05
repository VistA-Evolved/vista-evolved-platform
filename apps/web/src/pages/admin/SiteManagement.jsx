import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchBar } from '../../components/shared/SharedComponents';
import { getSites, getSite, getTopology } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Site Management (Division Management)
 * @vista MEDICAL CENTER DIVISION #40.8 via DDR LISTER
 *
 * Live: GET /divisions → { data: [{ ien, name, stationNumber, status }] }
 * Returns 3 real VEHU divisions from the sandbox.
 */

const ALL_WORKSPACES = ['Dashboard', 'Patients', 'Scheduling', 'Clinical', 'Pharmacy', 'Lab', 'Imaging', 'Billing', 'Supply', 'Admin', 'Analytics'];

export default function SiteManagement() {
  const navigate = useNavigate();
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [allSites, setAllSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workspaceToggles, setWorkspaceToggles] = useState({});
  const [topology, setTopology] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [siteDetail, setSiteDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, topoRes] = await Promise.allSettled([getSites(), getTopology()]);
      if (topoRes.status === 'fulfilled') setTopology(topoRes.value?.data || topoRes.value || null);
      const sitesData = res.status === 'fulfilled' ? res.value : null;
      const sites = ((sitesData?.data) || []).map(d => ({
        id: d.ien,
        name: d.name,
        siteCode: d.stationNumber,
        status: d.status || 'active',
        type: d.name.includes('CBOC') ? 'Community Clinic' : d.name.includes('PRRTP') ? 'Residential Treatment' : 'Medical Center',
      }));
      setAllSites(sites);
      if (sites.length > 0) {
        setSelectedSite(sites[0]);
        const toggles = {};
        sites.forEach(s => {
          toggles[s.id] = {};
          ALL_WORKSPACES.forEach(ws => { toggles[s.id][ws] = true; });
        });
        setWorkspaceToggles(toggles);
      }
    } catch (err) {
      if (!allSites.length) setError(err.message || 'Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = allSites.filter(s => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.siteCode.includes(q) || s.type.toLowerCase().includes(q);
  });

  const TYPE_ICONS = {
    'Medical Center': 'local_hospital',
    'Community Clinic': 'health_and_safety',
    'Long-Term Care': 'elderly',
    'Residential Treatment': 'cottage',
  };

  const toggleWorkspace = (siteId, ws) => {
    setWorkspaceToggles(prev => ({
      ...prev,
      [siteId]: { ...(prev[siteId] || {}), [ws]: !(prev[siteId]?.[ws]) },
    }));
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Site Management">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Site Management">
      <div className="flex h-[calc(100vh-40px)]">
        <div className="w-[40%] border-r border-border overflow-auto p-4">
          <h1 className="text-[28px] font-bold text-text mb-1 px-2">Site Management</h1>
          <p className="text-xs text-text-secondary mb-4 px-2">
            {loading ? 'Loading sites from VistA...' : `${allSites.length} sites loaded from live VistA.`}
          </p>

          <div className="mb-4 px-2">
            <SearchBar placeholder="Search by name, code, or type..." onSearch={setSearchText} />
          </div>

          {loading ? (
            <div className="space-y-2 px-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-md" />)}</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(site => (
                <button key={site.id} onClick={() => setSelectedSite(site)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    selectedSite?.id === site.id ? 'bg-[#E8EEF5] border border-steel' : 'hover:bg-surface-alt border border-transparent'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-surface-alt flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-steel">{TYPE_ICONS[site.type] || 'location_on'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-text truncate">{site.name}</span>
                        <StatusBadge status={site.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] font-mono text-text-muted">{site.siteCode}</span>
                        <span className="text-[11px] text-text-secondary">{site.type}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-center py-8 text-text-muted text-sm">No sites found.</div>
              )}
            </div>
          )}
        </div>

        <div className="w-[60%] overflow-auto p-6">
          {selectedSite ? (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-text">{selectedSite.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-mono text-text-secondary">Site Code: {selectedSite.siteCode}</span>
                    <StatusBadge status={selectedSite.status} />
                    <span className="text-xs text-text-muted">{selectedSite.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!editMode) {
                        setDetailLoading(true);
                        try {
                          const res = await getSite(selectedSite.id);
                          setSiteDetail(res?.data || {});
                        } catch { setSiteDetail({}); }
                        finally { setDetailLoading(false); }
                      }
                      setEditMode(!editMode);
                    }}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    {editMode ? 'Cancel Edit' : 'Edit Site'}
                  </button>
                  <button onClick={() => navigate('/admin/parameters')}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    Site Parameters
                  </button>
                </div>
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 p-3 bg-info-bg rounded-md text-sm text-info mb-4">
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Loading site details...
                </div>
              )}

              {editMode && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800 mb-4">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
                  <div>
                    <p className="font-medium">View Only</p>
                    <p className="text-xs mt-0.5">Site detail editing requires a backend endpoint (PUT /api/ta/v1/divisions/:ien) that has not been built yet. Changes to workspace toggles are visual only and will not persist.</p>
                  </div>
                </div>
              )}

              <Section title="Site Profile">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <Field label="Name" value={selectedSite.name} />
                  <Field label="Site Code" value={selectedSite.siteCode} mono />
                  <Field label="Status" value={selectedSite.status} />
                  <Field label="Type" value={selectedSite.type} />
                  {siteDetail && editMode && (
                    <>
                      {siteDetail.address && <Field label="Address" value={siteDetail.address} />}
                      {siteDetail.phone && <Field label="Phone" value={siteDetail.phone} />}
                      {siteDetail.director && <Field label="Director" value={siteDetail.director} />}
                    </>
                  )}
                </div>
              </Section>

              <Section title="Active Workspaces">
                <p className="text-xs text-text-secondary mb-3">
                  Workspaces available at this site. Toggle to enable or disable.
                </p>
                <div className="space-y-1">
                  {ALL_WORKSPACES.map(ws => {
                    const isActive = workspaceToggles[selectedSite.id]?.[ws] ?? true;
                    return (
                      <div key={ws} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F5F8FB]">
                        <span className={`text-[13px] ${isActive ? 'text-[#222] font-medium' : 'text-[#999]'}`}>{ws}</span>
                        <button
                          onClick={() => toggleWorkspace(selectedSite.id, ws)}
                          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-[#1B7D3A]' : 'bg-[#DDD]'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Topology Section */}
              {topology && (
                <Section title="System Topology">
                  <div className="bg-white border border-border rounded-md p-3">
                    {typeof topology === 'object' && !Array.isArray(topology) ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {Object.entries(topology).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-text-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
                            <span className="font-mono text-text-secondary">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                          </div>
                        ))}
                      </div>
                    ) : Array.isArray(topology) ? (
                      <div className="space-y-1">
                        {topology.map((item, i) => (
                          <div key={i} className="text-xs text-text-secondary font-mono">{typeof item === 'string' ? item : JSON.stringify(item)}</div>
                        ))}
                      </div>
                    ) : (
                      <pre className="text-[10px] font-mono text-text-secondary overflow-auto max-h-40">{JSON.stringify(topology, null, 2)}</pre>
                    )}
                  </div>
                </Section>
              )}

              <div className="p-3 bg-info-bg rounded-md text-xs text-info mt-6">
                <strong>Multi-site context:</strong> When a staff member assigned to multiple sites switches their active site
                via the system bar, the application context changes: different patients, parameters, workspace availability,
                and report scope apply to the selected site.
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <p>Select a site to view details</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm text-text mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
