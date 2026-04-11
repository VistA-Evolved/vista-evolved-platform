import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import DataTable from '../../components/shared/DataTable';
import { SearchBar, Pagination, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getMailGroups, getMailGroupDetail, updateMailGroup, getMailGroupMembers, addMailGroupMember, removeMailGroupMember, getStaff } from '../../services/adminService';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Mail Group Management — Mail Administration page
 * @vista MAIL GROUP #3.8 via GET/PUT /mail-groups
 * Note: No POST /mail-groups route — groups are read/edit only.
 */

const columns = [
  { key: 'name', label: 'Group Name', bold: true },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type' },
  { key: 'organizer', label: 'Organizer' },
];

const PAGE_SIZE = 25;

const EDIT_FIELDS = [
  { key: 'type', label: 'Type', field: 'type', fieldNum: '4', help: 'Mail group type (e.g., public or private). Controls who can send messages to this group.' },
  { key: 'organizer', label: 'Organizer', field: 'organizer', fieldNum: '5', help: 'User who manages this mail group. The organizer can add/remove members and change settings.' },
  { key: 'selfEnroll', label: 'Self Enroll', field: 'selfEnroll', fieldNum: '7', help: 'Whether users can add themselves to this group without organizer approval.' },
  { key: 'restrictions', label: 'Restrictions', field: 'restrictions', fieldNum: '10', help: 'Access restrictions for this group. Controls who can send messages.' },
  { key: 'description', label: 'Description', field: 'description', help: 'Free-text description of the mail group purpose.' },
];

export default function MailGroupManagement() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [actionError, setActionError] = useState(null);

  /* Members sub-section */
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [removeMember, setRemoveMember] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMailGroups();
      const items = (res?.data || []).map((d, i) => ({
        id: d.ien || `mg-${i}`,
        name: d.name || '',
        type: d.type || '',
        organizer: d.organizer || '',
        selfEnroll: d.selfEnroll || '',
        restrictions: d.restrictions || '',
      }));
      setGroups(items);
    } catch (err) {
      setError(err.message || 'Failed to load mail groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = useCallback(async (group) => {
    setSelectedGroup(group);
    setDetailLoading(true);
    setEditing(false);
    setSaveMsg(null);
    setActionError(null);
    setMembers([]);
    try {
      const [detailRes, memRes] = await Promise.all([
        getMailGroupDetail(group.id),
        getMailGroupMembers(group.id),
      ]);
      const d = detailRes?.data || {};
      // Map DDR field numbers and named keys to human keys
      const mapped = {};
      for (const ef of EDIT_FIELDS) {
        const val = d[ef.field] ?? d[ef.key] ?? (ef.fieldNum ? (d[ef.fieldNum] ?? d[`${ef.fieldNum}E`] ?? d[`${ef.fieldNum}I`]) : undefined);
        if (val !== undefined && val !== '') mapped[ef.key] = val;
      }
      setDetailData({ ...group, ...mapped, id: group.id });
      setMembers(memRes?.data || []);
    } catch {
      setDetailData(group);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (groupId) => {
    setMembersLoading(true);
    try {
      const res = await getMailGroupMembers(groupId);
      setMembers(res?.data || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
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
      const updates = {};
      EDIT_FIELDS.forEach(ef => {
        if (editValues[ef.key] !== (detailData[ef.key] || '')) {
          updates[ef.field] = editValues[ef.key];
        }
      });
      if (Object.keys(updates).length > 0) {
        await updateMailGroup(detailData.id, updates);
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

  const handleSearchStaff = async () => {
    if (!staffSearch.trim()) return;
    setStaffLoading(true);
    try {
      const res = await getStaff();
      const all = res?.data || [];
      const s = staffSearch.toLowerCase();
      setStaffResults(all.filter(u => (u.name || '').toLowerCase().includes(s)).slice(0, 20));
    } catch {
      setStaffResults([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleAddMember = async (staffIen) => {
    if (!detailData) return;
    setActionError(null);
    try {
      await addMailGroupMember(detailData.id, staffIen);
      setShowAddMember(false);
      setStaffSearch('');
      setStaffResults([]);
      setSaveMsg('Member added successfully.');
      setTimeout(() => setSaveMsg(null), 4000);
      await loadMembers(detailData.id);
    } catch (err) {
      setActionError(err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async () => {
    if (!detailData || !removeMember) return;
    try {
      await removeMailGroupMember(detailData.id, removeMember.ien);
      setRemoveMember(null);
      setSaveMsg('Member removed.');
      setTimeout(() => setSaveMsg(null), 4000);
      await loadMembers(detailData.id);
    } catch (err) {
      setActionError(err.message || 'Failed to remove member');
      setRemoveMember(null);
    }
  };

  const filtered = groups.filter(g => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return g.name.toLowerCase().includes(s) || g.type.toLowerCase().includes(s) || g.organizer.toLowerCase().includes(s);
  });

  const totalFiltered = filtered.length;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Mail Groups">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const display = detailData || selectedGroup;

  return (
    <AppShell breadcrumb="Admin > Mail Groups">
      <div className="flex h-[calc(100vh-40px)]">
        <div className={`p-6 overflow-auto ${display ? 'w-full xl:w-[55%]' : 'w-full'}`}>
          <div className="max-w-[1400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#222]">Mail Group Management</h1>
                <p className="text-sm text-[#666] mt-1">
                  View and manage VistA mail groups, membership, and distribution settings.
                  {!loading && <span className="ml-2 text-[13px] text-[#999]">({groups.length} groups)</span>}
                </p>
              </div>
              {/* No Add button — no POST /mail-groups route */}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-[240px]">
                <SearchBar placeholder="Search mail groups by name, type, or organizer..." onSearch={(val) => { setSearchText(val); setPage(1); }} />
              </div>
            </div>

            {loading ? <TableSkeleton rows={10} cols={5} /> : (
              <DataTable columns={columns} data={pageSlice} idField="id" selectedId={display?.id} onRowClick={(row) => loadDetail(row)} />
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} total={totalFiltered} onPageChange={setPage} />

            <details className="mt-6 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
              <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
              <p className="mt-2">This page replaces: <strong>MailMan → Manage Mail Groups</strong></p>
              <p className="mt-1">VistA File: <strong>MAIL GROUP (#3.8)</strong></p>
              <p className="mt-1">Terminal provides: Edit group settings, manage members, set restrictions and auto-enrollment.</p>
              <p className="mt-1">Mail groups are used by VistA alerts, notifications, and internal messaging.</p>
            </details>
          </div>
        </div>

        {display && (
          <div className="hidden xl:block w-[45%] border-l border-[#E2E4E8] bg-[#F5F8FB] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#222]">{display.name}</h2>
              <div className="flex items-center gap-2">
                {!editing && (
                  <button onClick={handleEdit} className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-[#E2E4E8] rounded-md hover:bg-white" title="Edit mail group settings">
                    <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                  </button>
                )}
                <button onClick={() => { setSelectedGroup(null); setDetailData(null); setEditing(false); }}
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
                      <button disabled={saving} onClick={handleSave}
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
                  </div>
                )}

                {/* Members sub-section */}
                <div className="mt-6 pt-4 border-t border-[#E2E4E8]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#222]">Members ({members.length})</h3>
                    <button onClick={() => { setShowAddMember(true); setStaffSearch(''); setStaffResults([]); }}
                      title="Add a VistA user to this mail group"
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[#2E5984] border border-[#2E5984] rounded-md hover:bg-[#E8F1FA]">
                      <span className="material-symbols-outlined text-[14px]">person_add</span> Add Member
                    </button>
                  </div>
                  {membersLoading ? (
                    <div className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />
                  ) : members.length === 0 ? (
                    <div className="text-center py-4 text-[#999] text-sm">No members in this group.</div>
                  ) : (
                    <div className="space-y-1 max-h-[300px] overflow-auto">
                      {members.map((m, i) => (
                        <div key={m.ien || i} className="flex items-center justify-between p-2.5 bg-white border border-[#E2E4E8] rounded-lg">
                          <div>
                            <div className="text-[13px] font-medium text-[#222]">{m.name}</div>
                            {m.type && <div className="text-[10px] text-[#999]">{m.type}</div>}
                          </div>
                          <button onClick={() => setRemoveMember(m)}
                            title={`Remove ${m.name} from this mail group`}
                            className="text-[#CC3333] hover:text-[#990000] p-1">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {removeMember && (
        <ConfirmDialog
          open
          title="Remove Member"
          message={`Remove "${removeMember.name}" from the "${display?.name}" mail group? They will no longer receive messages sent to this group.`}
          confirmLabel="Remove"
          onConfirm={handleRemoveMember}
          onCancel={() => setRemoveMember(null)}
          destructive
        />
      )}

      {showAddMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#222]">Add Member</h3>
              <button onClick={() => setShowAddMember(false)} className="text-[#999] hover:text-[#222]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="text" value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchStaff(); }}
                placeholder="Search staff by name..."
                title="Type a name and press Enter or click Search to find VistA users"
                className="flex-1 h-9 px-3 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" autoFocus />
              <button onClick={handleSearchStaff} disabled={staffLoading}
                className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                {staffLoading ? '...' : 'Search'}
              </button>
            </div>
            {staffResults.length > 0 && (
              <div className="space-y-1 max-h-[250px] overflow-auto">
                {staffResults.map((s, i) => (
                  <button key={s.ien || i} onClick={() => handleAddMember(s.ien)}
                    className="w-full text-left p-2.5 bg-[#F5F8FB] border border-[#E2E4E8] rounded-lg hover:bg-[#E8F1FA] transition-colors">
                    <div className="text-[13px] font-medium text-[#222]">{s.name}</div>
                    {s.title && <div className="text-[10px] text-[#999]">{s.title}</div>}
                  </button>
                ))}
              </div>
            )}
            {staffResults.length === 0 && staffSearch && !staffLoading && (
              <div className="text-center py-4 text-sm text-[#999]">No staff found matching "{staffSearch}"</div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
