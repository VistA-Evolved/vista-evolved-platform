import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchBar } from '../../components/shared/SharedComponents';
import { getSites, getSite, getTopology, updateSite, createSite, getSiteWorkspaces, updateSiteWorkspace } from '../../services/adminService';
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
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [toggleSaving, setToggleSaving] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({ name: '', stationNumber: '', type: 'Medical Center' });

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
        // Load workspace visibility from VistA per division
        const toggles = {};
        for (const s of sites) {
          try {
            const wsRes = await getSiteWorkspaces(s.id);
            if (wsRes?.data) {
              toggles[s.id] = {};
              ALL_WORKSPACES.forEach(ws => {
                toggles[s.id][ws] = wsRes.data[ws] !== false;
              });
            } else {
              toggles[s.id] = {};
              ALL_WORKSPACES.forEach(ws => { toggles[s.id][ws] = true; });
            }
          } catch {
            toggles[s.id] = {};
            ALL_WORKSPACES.forEach(ws => { toggles[s.id][ws] = true; });
          }
        }
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

  const toggleWorkspace = async (siteId, ws) => {
    const newState = !(workspaceToggles[siteId]?.[ws]);
    setToggleSaving(ws);
    // Optimistic update
    setWorkspaceToggles(prev => ({
      ...prev,
      [siteId]: { ...(prev[siteId] || {}), [ws]: newState },
    }));
    try {
      await updateSiteWorkspace(siteId, ws, newState);
    } catch {
      // Revert on failure
      setWorkspaceToggles(prev => ({
        ...prev,
        [siteId]: { ...(prev[siteId] || {}), [ws]: !newState },
      }));
    }
    setToggleSaving('');
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
                          const d = res?.data || {};
                          setSiteDetail(d);
                          setEditForm({ name: d.name || selectedSite.name, phone: d.phone || '', address: d.address || '', city: d.city || '', state: d.state || '', zip: d.zip || '' });
                        } catch { setSiteDetail({}); setEditForm({}); }
                        finally { setDetailLoading(false); }
                      }
                      setSaveMsg('');
                      setEditMode(!editMode);
                    }}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    {editMode ? 'Cancel Edit' : 'Edit Site'}
                  </button>
                  <button onClick={() => setShowAddSite(true)}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    Add Site
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
                <div className="space-y-4 mb-4">
                  {saveMsg && (
                    <div className={`p-3 rounded-md text-sm ${saveMsg.includes('Success') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                      {saveMsg}
                    </div>
                  )}
                  <Section title="Edit Site Profile">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium text-text-muted uppercase">Name</label>
                        <input type="text" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-text-muted uppercase">Phone</label>
                        <input type="text" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-medium text-text-muted uppercase">Address</label>
                        <input type="text" value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                          className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-text-muted uppercase">City</label>
                        <input type="text" value={editForm.city || ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                          className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-text-muted uppercase">State</label>
                        <input type="text" value={editForm.state || ''} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                          className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          setSaveMsg('');
                          try {
                            const res = await updateSite(selectedSite.id, editForm);
                            if (res.ok) {
                              setSaveMsg('Success — Site details saved to VistA.');
                              await loadData();
                            } else {
                              setSaveMsg(`Error: ${res.error || 'Save failed'}`);
                            }
                          } catch (err) {
                            setSaveMsg(`Error: ${err.message}`);
                          }
                          setSaving(false);
                        }}
                        className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => { setEditMode(false); setSaveMsg(''); }}
                        className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                        Cancel
                      </button>
                    </div>
                  </Section>
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
                        <div className="flex items-center gap-2">
                          {toggleSaving === ws && <span className="material-symbols-outlined text-[14px] text-steel animate-spin">progress_activity</span>}
                          <button
                            onClick={() => toggleWorkspace(selectedSite.id, ws)}
                            disabled={!!toggleSaving}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-[#1B7D3A]' : 'bg-[#DDD]'} ${toggleSaving ? 'opacity-50' : ''}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </div>
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

      {/* Add Site Modal */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddSite(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[450px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-lg mb-4">Add New Site</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Site Name *</label>
                <input type="text" value={newSiteForm.name} onChange={e => setNewSiteForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Station Number</label>
                <input type="text" value={newSiteForm.stationNumber} onChange={e => setNewSiteForm(f => ({ ...f, stationNumber: e.target.value }))}
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Type</label>
                <select value={newSiteForm.type} onChange={e => setNewSiteForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1">
                  <option>Medical Center</option>
                  <option>Community Clinic</option>
                  <option>Long-Term Care</option>
                  <option>Residential Treatment</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAddSite(false)} className="px-4 py-2 text-sm border border-border rounded-md">Cancel</button>
              <button
                disabled={!newSiteForm.name || saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await createSite(newSiteForm);
                    setShowAddSite(false);
                    setNewSiteForm({ name: '', stationNumber: '', type: 'Medical Center' });
                    await loadData();
                  } catch (err) {
                    alert(err.message || 'Failed to create site');
                  }
                  setSaving(false);
                }}
                className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel disabled:opacity-40">
                {saving ? 'Creating...' : 'Create Site'}
              </button>
            </div>
          </div>
        </div>
      )}
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
