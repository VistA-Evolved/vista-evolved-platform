import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchBar } from '../../components/shared/SharedComponents';
import { getSites, getSite, getTopology, updateSite, createSite, getSiteWorkspaces, updateSiteWorkspace, getFacilities, deleteSite } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { formatPhone } from '../../utils/transforms';

/**
 * Site Management (Division Management)
 * @vista MEDICAL CENTER DIVISION #40.8 via DDR LISTER
 *
 * Live: GET /divisions → { data: [{ ien, name, stationNumber, status }] }
 * Returns 3 real VEHU divisions from the sandbox.
 */

const ALL_WORKSPACES = ['Dashboard', 'Patients', 'Scheduling', 'Clinical', 'Pharmacy', 'Lab', 'Imaging', 'Billing', 'Supply', 'Admin', 'Analytics'];

export default function SiteManagement() {
  useEffect(() => { document.title = 'Site Management — VistA Evolved'; }, []);
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
  const [createError, setCreateError] = useState('');
  const [facilityData, setFacilityData] = useState(null);
  const [deleteSiteTarget, setDeleteSiteTarget] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, topoRes, facRes] = await Promise.allSettled([getSites(), getTopology(), getFacilities()]);
      if (topoRes.status === 'fulfilled') setTopology(topoRes.value?.data || topoRes.value || null);
      if (facRes.status === 'fulfilled') {
        const facilities = facRes.value?.data || [];
        setFacilityData(facilities.length > 0 ? facilities[0] : null);
      }
      if (res.status === 'rejected') {
        setError(res.reason?.message || 'Failed to load sites');
        setLoading(false);
        return;
      }
      const sitesData = res.value;
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
          } catch (err) {
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
    } catch (err) {
      // Revert on failure and show error
      setWorkspaceToggles(prev => ({
        ...prev,
        [siteId]: { ...(prev[siteId] || {}), [ws]: !newState },
      }));
      setSaveMsg(`Error: Failed to save workspace toggle — ${err?.message || 'Unknown error'}`);
    }
    setToggleSaving('');
  };

  const handleDeleteSite = async () => {
    if (!deleteSiteTarget) return;
    try {
      await deleteSite(deleteSiteTarget.id);
      setDeleteSiteTarget(null);
      setSelectedSite(null);
      setEditMode(false);
      loadData();
    } catch (err) {
      setSaveMsg(`Error: ${err.message}`);
      setDeleteSiteTarget(null);
    }
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Divisions">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Divisions">
      <div className="flex h-[calc(100vh-40px)]">
        <div className="w-full xl:w-[40%] border-r border-border overflow-auto p-4">
          <h1 className="text-[22px] font-bold text-text mb-1 px-2">Divisions</h1>
          <p className="text-xs text-text-secondary mb-4 px-2">
            Medical Center Divisions (File 40.8) — administrative units within the facility.
            {!loading && <span className="ml-1">{allSites.length} divisions loaded.</span>}
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

        <div className="hidden xl:block w-[60%] overflow-auto p-6">
          {selectedSite ? (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-[22px] font-bold text-text">{selectedSite.name}</h2>
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
                        } catch (err) { setSiteDetail({}); setEditForm({}); setSaveMsg(`Error loading site details: ${err?.message || 'Unknown error'}`); }
                        finally { setDetailLoading(false); }
                      }
                      setSaveMsg('');
                      setEditMode(!editMode);
                    }}
                    title={editMode ? 'Cancel editing this site' : 'Edit site name, address, and contact details'}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    {editMode ? 'Cancel Edit' : 'Edit Site'}
                  </button>
                  <button onClick={() => setShowAddSite(true)}
                    title="Create a new division entry in VistA File #40.8"
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
                    Add Site
                  </button>
                  <button onClick={() => navigate('/admin/parameters')}
                    title="View and edit package-specific system parameters"
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
                      <div>
                        <label className="text-[10px] font-medium text-text-muted uppercase">ZIP</label>
                        <input type="text" value={editForm.zip || ''} onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))}
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
                              setSaveMsg('Success — Site details saved.');
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
                      <button onClick={() => setDeleteSiteTarget(selectedSite)}
                        className="ml-auto px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700">
                        Delete Site
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
                      {siteDetail.phone && <Field label="Phone" value={formatPhone(siteDetail.phone)} />}
                      {siteDetail.director && <Field label="Director" value={siteDetail.director} />}
                    </>
                  )}
                </div>
              </Section>

              {/* Institution fields from File #4 */}
              {facilityData && (
                <Section title="Facility Information">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    {facilityData.name && <Field label="Institution Name" value={facilityData.name} />}
                    {facilityData.stationNumber && <Field label="Station Number" value={facilityData.stationNumber} mono />}
                    {facilityData.address && <Field label="Address" value={facilityData.address} />}
                    {facilityData.city && <Field label="City" value={facilityData.city} />}
                    {facilityData.state && <Field label="State" value={facilityData.state} />}
                    {facilityData.zip && <Field label="ZIP" value={facilityData.zip} mono />}
                    {facilityData.phone && <Field label="Phone" value={formatPhone(facilityData.phone)} mono />}
                    {facilityData.director && <Field label="Director" value={facilityData.director} />}
                    {facilityData.timezone && <Field label="Timezone" value={facilityData.timezone} />}
                  </div>
                </Section>
              )}

              <Section title="Active Workspaces">
                <div className="mb-3 p-3 bg-[#FFFDE7] border border-[#F9A825] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[14px] text-[#F9A825] mt-0.5">info</span>
                  <span>Workspace visibility controls which modules appear in the navigation for staff at this site. Disabling a workspace hides it from the sidebar — it does not delete data or revoke permissions. Changes take effect on next page load.</span>
                </div>
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
                            role="switch" aria-checked={isActive} aria-label={`Toggle ${ws} workspace`}
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
                  <div className="bg-white border border-border rounded-md p-4">
                    {/* Visual tree: parent → child divisions */}
                    <div className="space-y-1">
                      {/* Facility root node */}
                      <div className="flex items-center gap-2 text-sm font-semibold text-text">
                        <span className="material-symbols-outlined text-[18px] text-steel">account_tree</span>
                        {topology.facilityName || topology.siteName || 'VistA System'}
                        {topology.stationNumber && <span className="text-[10px] font-mono text-text-muted ml-1">({topology.stationNumber})</span>}
                      </div>
                      {/* Division child nodes from allSites */}
                      {allSites.length > 0 ? (
                        <div className="ml-5 border-l-2 border-[#E2E4E8] pl-4 space-y-1.5 mt-1">
                          {allSites.map(site => (
                            <div key={site.id} className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[14px] text-text-muted">
                                {site.type === 'Medical Center' ? 'local_hospital' : site.type === 'Community Clinic' ? 'health_and_safety' : 'location_on'}
                              </span>
                              <span className={`text-xs ${site.id === selectedSite?.id ? 'font-semibold text-steel' : 'text-text-secondary'}`}>{site.name}</span>
                              <span className="text-[10px] font-mono text-text-muted">{site.siteCode}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${site.status === 'active' ? 'bg-[#E8F5E9] text-[#2D6A4F]' : 'bg-[#FDE8E8] text-[#CC3333]'}`}>{site.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ml-5 text-xs text-text-muted mt-1">No divisions loaded.</p>
                      )}
                      {/* Additional topology metadata */}
                      {(topology.connectionMode || topology.environment) && (
                        <div className="mt-3 pt-3 border-t border-[#E2E4E8] grid grid-cols-2 gap-2 text-xs">
                          {topology.connectionMode && (
                            <div><span className="text-text-muted">Connection:</span> <span className="font-mono text-text-secondary">{topology.connectionMode}</span></div>
                          )}
                          {topology.environment && (
                            <div><span className="text-text-muted">Environment:</span> <span className="text-text-secondary">{topology.environment}</span></div>
                          )}
                          {topology.dbEngine && (
                            <div><span className="text-text-muted">Database:</span> <span className="font-mono text-text-secondary">{topology.dbEngine}</span></div>
                          )}
                          {topology.version && (
                            <div><span className="text-text-muted">Version:</span> <span className="font-mono text-text-secondary">{topology.version}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              <div className="p-3 bg-info-bg rounded-md text-xs text-info mt-6">
                <strong>Multi-site context:</strong> When a staff member assigned to multiple sites switches their active site
                via the system bar, the application context changes: different patients, parameters, workspace availability,
                and report scope apply to the selected site.
              </div>

              <details className="mt-4 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
                <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
                <p className="mt-2">This page replaces the terminal&apos;s <strong>Division Management</strong> menu.</p>
                <p className="mt-1">Terminal path: <strong>Systems Manager Menu → Site Management → Division Management</strong></p>
                <p className="mt-1">VistA stores divisions in <strong>MEDICAL CENTER DIVISION file (#40.8)</strong> and institutions in <strong>INSTITUTION file (#4)</strong>.</p>
                <p className="mt-1">Workspace visibility toggles are stored in <strong>^XTMP(&quot;ZVE-WKSP&quot;)</strong>.</p>
              </details>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <p>Select a site to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Site Confirm */}
      {deleteSiteTarget && (
        <ConfirmDialog
          open
          title="Delete Site"
          message={`Permanently delete "${deleteSiteTarget.name}" from VistA? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteSite}
          onCancel={() => setDeleteSiteTarget(null)}
          destructive
        />
      )}

      {/* Add Site Modal */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddSite(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[450px] p-6" role="dialog" aria-modal="true" aria-label="Add New Site" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-lg mb-4">Add New Site</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Site Name *</label>
                <input type="text" value={newSiteForm.name} onChange={e => setNewSiteForm(f => ({ ...f, name: e.target.value }))}
                  title="Official name for this division (File #40.8 field .01)"
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Station Number</label>
                <input type="text" value={newSiteForm.stationNumber} onChange={e => setNewSiteForm(f => ({ ...f, stationNumber: e.target.value }))}
                  title="3-digit station number identifying this division"
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase">Type</label>
                <select value={newSiteForm.type} onChange={e => setNewSiteForm(f => ({ ...f, type: e.target.value }))}
                  title="Facility classification for this division"
                  className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel mt-1">
                  <option>Medical Center</option>
                  <option>Community Clinic</option>
                  <option>Long-Term Care</option>
                  <option>Residential Treatment</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              {createError && (
                <div className="flex-1 p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-md text-[11px] text-[#CC3333] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {createError}
                </div>
              )}
              <button onClick={() => { setShowAddSite(false); setCreateError(''); }} className="px-4 py-2 text-sm border border-border rounded-md">Cancel</button>
              <button
                disabled={!newSiteForm.name || saving}
                onClick={async () => {
                  setSaving(true);
                  setCreateError('');
                  try {
                    await createSite(newSiteForm);
                    setShowAddSite(false);
                    setNewSiteForm({ name: '', stationNumber: '', type: 'Medical Center' });
                    setCreateError('');
                    await loadData();
                  } catch (err) {
                    setCreateError(err.message || 'Failed to create site');
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
