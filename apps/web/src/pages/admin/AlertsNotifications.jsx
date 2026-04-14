import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getAlerts, updateAlert, getStaff, createAlert, getMailManInbox, getMailManBaskets, getMailManMessage, sendMailManMessage, deleteMailManMessage } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Alerts & Notifications Management
 * @vista BULLETIN file via /bulletins endpoint
 *
 * Live: GET /bulletins → { data: [...] }
 * The sandbox may have 0 bulletins — that's expected. We show an empty state.
 */

const PRIORITY_STYLES = {
  high:   { cls: 'bg-danger-bg text-danger', icon: 'priority_high' },
  normal: { cls: 'bg-info-bg text-info', icon: 'remove' },
  low:    { cls: 'bg-[#F5F5F5] text-text-muted', icon: 'expand_more' },
};

const MAIL_UNREAD_MAX = 200;

function buildMailFolderTabs(baskets) {
  const rows = Array.isArray(baskets) ? baskets : [];
  const wasteBasket = rows.find((basket) => basket.name === 'WASTE');
  const visibleCustomBaskets = rows.filter((basket) => basket.name && basket.name !== 'IN' && basket.name !== 'WASTE');
  const incomingCount = rows.filter((basket) => basket.name !== 'WASTE').reduce((sum, basket) => sum + (basket.messageCount || 0), 0);

  return [
    { key: 'IN', label: 'Inbox', count: incomingCount },
    ...visibleCustomBaskets.map((basket) => ({ key: basket.name, label: basket.name, count: basket.messageCount || 0 })),
    { key: 'SENT', label: 'Sent', count: 0 },
    { key: 'WASTE', label: 'Deleted', count: wasteBasket?.messageCount || 0 },
  ];
}

/** Match MailMan "From" display text to a NEW PERSON (#200) row for reply addressing. */
function matchStaffFromMailFromLine(fromStr, list) {
  if (!fromStr || !list?.length) return { duz: '', name: '' };
  const n = fromStr.trim().toLowerCase();
  const first = fromStr.split(',')[0]?.trim().toLowerCase() || n;
  const exact = list.find(s => String(s.name).toLowerCase() === n);
  if (exact) return { duz: String(exact.duz), name: exact.name };
  const partial = list.find(s => n.includes(String(s.name).toLowerCase()) || String(s.name).toLowerCase().includes(first));
  if (partial) return { duz: String(partial.duz), name: partial.name };
  return { duz: '', name: '' };
}

export default function AlertsNotifications() {
  useEffect(() => { document.title = 'Alerts & Notifications — VistA Evolved'; }, []);
  const [tab, setTab] = useState('alerts');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [forwardModal, setForwardModal] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [newAlertModal, setNewAlertModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageBody, setMessageBody] = useState(null);
  const [messageBodyLoading, setMessageBodyLoading] = useState(false);
  const [composeModal, setComposeModal] = useState(false);
  const [mailFolder, setMailFolder] = useState('IN');
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [mailBaskets, setMailBaskets] = useState([]);
  const [confirmDeleteAlert, setConfirmDeleteAlert] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAlerts();
      const data = res?.data || [];
      // Normalize bulletin data to alert format
      const normalized = (Array.isArray(data) ? data : []).map((b, i) => ({
        id: b.ien || String(i),
        subject: b.name || b.subject || b.text || `Bulletin ${b.ien || i}`,
        from: b.from || 'System',
        timestamp: b.dateTime || '',
        priority: 'normal',
        status: 'new',
        type: 'system',
        raw: b,
      }));
      setAlerts(normalized);
    } catch (err) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadMailBaskets = useCallback(async () => {
    try {
      const res = await getMailManBaskets();
      const list = res?.data || [];
      setMailBaskets(list);
      setMailUnreadCount(list.filter((basket) => basket.name !== 'WASTE').reduce((sum, basket) => sum + (basket.unreadCount || 0), 0));
    } catch (_err) {
      setMailBaskets([]);
      setMailUnreadCount(0);
    }
  }, []);

  useEffect(() => { loadMailBaskets(); }, [loadMailBaskets]);

  const newCount = alerts.filter(a => a.status === 'new').length;

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Messages & Alerts">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Messages & Alerts">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-text">Messages & Alerts</h1>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? 'Loading...' : `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNewAlertModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-navy text-white rounded-md hover:bg-steel transition-colors">
              <span className="material-symbols-outlined text-[16px]">add_alert</span> New Alert
            </button>
            <button onClick={loadData} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
              <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border mb-6" role="tablist">
          <button onClick={() => setTab('alerts')} role="tab" aria-selected={tab === 'alerts'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'alerts' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Alerts
            {newCount > 0 && <span className="ml-1.5 text-[10px] bg-danger-bg text-danger px-1.5 py-0.5 rounded-full font-bold">{newCount}</span>}
          </button>
          <button onClick={() => setTab('messages')} role="tab" aria-selected={tab === 'messages'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'messages' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Messages
            {mailUnreadCount > 0 && <span className="ml-1.5 text-[10px] bg-[#E8EEF5] text-steel px-1.5 py-0.5 rounded-full font-bold">{mailUnreadCount}</span>}
          </button>
          <button onClick={() => setTab('notifications')} role="tab" aria-selected={tab === 'notifications'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'notifications' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Notifications
          </button>
        </div>

        {actionError && (
          <div className="mb-4 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-sm text-[#CC3333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {actionError}
            </div>
            <button onClick={() => setActionError(null)} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {tab === 'alerts' && (
          <div>
            <p className="text-xs text-[#666] mb-3">
              System alerts from VistA's Bulletin system. Alerts are triggered by clinical and administrative events
              and delivered to configured mail groups and individual recipients.
            </p>
          <div className="flex gap-6">
            <div className={`${selectedAlert ? 'w-[35%]' : 'w-full'}`}>
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />)}</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <span className="material-symbols-outlined text-[40px] block mb-3">notifications_none</span>
                  <h3 className="text-lg font-semibold text-text mb-1">No Alerts</h3>
                  <p className="text-sm">No active alerts at this time.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => {
                    const p = PRIORITY_STYLES[alert.priority] || PRIORITY_STYLES.normal;
                    return (
                      <button key={alert.id} onClick={() => setSelectedAlert(alert)}
                        className={`w-full text-left p-4 rounded-md border transition-colors ${
                          selectedAlert?.id === alert.id ? 'border-steel bg-[#E8EEF5]' : 'border-border bg-white'
                        }`}>
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${p.cls}`}>
                            <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-text">{alert.subject}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-text-muted">From: {alert.from}</span>
                              {alert.timestamp && <span className="text-[10px] font-mono text-text-muted">{alert.timestamp}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedAlert && (
              <div className="w-[65%] bg-surface-alt border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-text">Alert Detail</h3>
                  <button onClick={() => setSelectedAlert(null)} className="text-text-muted hover:text-text" aria-label="Close">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-md border border-border">
                    <div className="font-medium text-text mb-1">{selectedAlert.subject}</div>
                    <div className="text-text-secondary">From: {selectedAlert.from}</div>
                    {selectedAlert.timestamp && <div className="text-text-secondary">Time: {selectedAlert.timestamp}</div>}
                  </div>
                  {selectedAlert.raw && (
                    <details className="text-[10px] text-text-muted">
                      <summary className="cursor-pointer hover:text-text">Technical Details</summary>
                      <pre className="mt-1 p-2 bg-white rounded text-[10px] font-mono overflow-auto max-h-40">{JSON.stringify(selectedAlert.raw, null, 2)}</pre>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button disabled={actionLoading === 'read'}
                      onClick={async () => {
                        setActionLoading('read');
                        try {
                          await updateAlert(selectedAlert.id, { status: 'read' });
                          setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...a, status: 'read' } : a));
                          setSelectedAlert(prev => ({ ...prev, status: 'read' }));
                        } catch (err) { setActionError(err?.message || "Operation failed"); }
                        finally { setActionLoading(null); }
                      }}
                      className="px-3 py-2 text-xs border border-border rounded-md hover:bg-white disabled:opacity-50">
                      {actionLoading === 'read' ? 'Updating...' : 'Mark as Read'}
                    </button>
                    <button disabled={actionLoading === 'ack'}
                      onClick={async () => {
                        setActionLoading('ack');
                        try {
                          await updateAlert(selectedAlert.id, { status: 'acknowledged' });
                          setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
                          setSelectedAlert(null);
                        } catch (err) { setActionError(err?.message || "Operation failed"); }
                        finally { setActionLoading(null); }
                      }}
                      className="px-3 py-2 text-xs border border-border rounded-md hover:bg-white disabled:opacity-50">
                      {actionLoading === 'ack' ? 'Acknowledging...' : 'Acknowledge & Dismiss'}
                    </button>
                    <button disabled={actionLoading === 'forward'}
                      title="Forward this alert to another staff member or mail group."
                      onClick={async () => {
                        setForwardModal(selectedAlert);
                        setStaffSearch('');
                        if (staffList.length === 0) {
                          setStaffLoading(true);
                          try {
                            const res = await getStaff();
                            setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
                          } catch (err) { setStaffList([]); }
                          finally { setStaffLoading(false); }
                        }
                      }}
                      className="px-3 py-2 text-xs border border-border rounded-md hover:bg-white disabled:opacity-50">
                      Forward
                    </button>
                    <button disabled={actionLoading === 'delete'}
                      title="Delete this alert. This action cannot be undone."
                      onClick={() => setConfirmDeleteAlert(true)}
                      className="px-3 py-2 text-xs border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] disabled:opacity-50">
                      {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        )}

        {tab === 'messages' && (
          <MailManTab
            messages={messages} setMessages={setMessages}
            messagesLoading={messagesLoading} setMessagesLoading={setMessagesLoading}
            selectedMessage={selectedMessage} setSelectedMessage={setSelectedMessage}
            messageBody={messageBody} setMessageBody={setMessageBody}
            messageBodyLoading={messageBodyLoading} setMessageBodyLoading={setMessageBodyLoading}
            composeModal={composeModal} setComposeModal={setComposeModal}
            mailFolder={mailFolder} setMailFolder={setMailFolder}
            staffList={staffList} setStaffList={setStaffList}
            staffLoading={staffLoading} setStaffLoading={setStaffLoading}
            mailUnreadCount={mailUnreadCount} setMailUnreadCount={setMailUnreadCount}
            mailBaskets={mailBaskets}
            reloadMailBaskets={loadMailBaskets}
          />
        )}

        {tab === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <div className="p-4 bg-[#F5F8FB] rounded-lg text-sm text-[#666] mb-4">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
                <div>
                  <p className="font-medium text-[#333] mb-1">About Alert Routing</p>
                  <p>This section describes how VistA routes alerts and notifications. Alert routing configuration is managed through
                  Kernel Site Parameters (IRM Mail Group, After-Hours Mail Group) and package-specific settings.</p>
                  <p className="mt-1">To configure which mail groups receive system alerts, go to
                  <strong> Security & Authentication → Advanced Settings</strong>.</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm text-text mb-3">Alert Routing</h3>
              <p className="text-xs text-text-secondary mb-4">
                Alerts are routed based on the originating clinical module (Lab, Pharmacy, Orders, etc.).
                Each module defines its own alert types and delivery rules.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-surface-alt rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-info">info</span>
                    <span className="font-medium text-xs text-text">Delivery</span>
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    System alerts are delivered to staff based on their role and department assignments.
                    Routing rules are configured per clinical module.
                  </div>
                </div>
                <div className="p-3 bg-surface-alt rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-warning">warning</span>
                    <span className="font-medium text-xs text-text">Escalation</span>
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    Unacknowledged alerts follow the escalation chain defined in each staff member's profile.
                    Ensure surrogate entries are configured for all providers who receive clinical alerts.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
          <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
          <p className="mt-2">This page replaces: <strong>EVE → Manage Mailman</strong> and the VistA Alerts system.</p>
          <p className="mt-1"><strong>Alerts tab:</strong> VistA Bulletin system (File #3.6). Alerts are triggered by system events and routed to configured recipients.</p>
          <p className="mt-1"><strong>Messages tab:</strong> MailMan (Files #3.9, #3.7). Internal messaging system with inbox, compose, forward, and delete.</p>
          <p className="mt-1"><strong>Notifications tab:</strong> Describes alert routing configuration. In terminal: EVE → Manage Mailman → Alert Management.</p>
        </details>
      </div>

      {/* Forward Modal */}
      {forwardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setForwardModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[440px] max-h-[60vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Forward Alert" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-text">Forward Alert</h3>
              <button onClick={() => setForwardModal(null)} className="text-text-muted hover:text-text" aria-label="Close">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-text-secondary mb-2">Select a staff member to forward "{forwardModal.subject}" to:</p>
              <input type="text" value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff by name..."
                className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
            </div>
            <div className="flex-1 overflow-auto px-5 pb-5">
              {staffLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 animate-pulse bg-[#E2E4E8] rounded" />)}</div>
              ) : (
                <div className="space-y-1">
                  {staffList
                    .filter(s => !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()))
                    .slice(0, 30)
                    .map(s => (
                      <button key={s.duz} disabled={actionLoading === 'forward'}
                        onClick={async () => {
                          setActionLoading('forward');
                          try {
                            await updateAlert(forwardModal.id, { action: 'forward', forwardTo: s.duz });
                            setForwardModal(null);
                          } catch (err) { setActionError(err?.message || "Operation failed"); }
                          finally { setActionLoading(null); }
                        }}
                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-alt text-sm disabled:opacity-50">
                        <span className="text-text">{s.name}</span>
                        <span className="text-[11px] text-steel font-medium">Forward</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Alert Modal */}
      <NewAlertModal
        open={newAlertModal}
        onClose={() => setNewAlertModal(false)}
        staffList={staffList}
        setStaffList={setStaffList}
        staffLoading={staffLoading}
        setStaffLoading={setStaffLoading}
        onSent={loadData}
      />

      {confirmDeleteAlert && selectedAlert && (
        <ConfirmDialog
          title="Delete Alert"
          message="Delete this alert? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            setConfirmDeleteAlert(false);
            setActionLoading('delete');
            try {
              await updateAlert(selectedAlert.id, { status: 'deleted' });
              setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
              setSelectedAlert(null);
            } catch (err) { setActionError(err?.message || "Operation failed"); }
            finally { setActionLoading(null); }
          }}
          onCancel={() => setConfirmDeleteAlert(false)}
          destructive
        />
      )}


    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  New Alert Modal
 * ═══════════════════════════════════════════════════════════════════════════ */

function NewAlertModal({ open, onClose, staffList, setStaffList, staffLoading, setStaffLoading, onSent }) {
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (open && staffList.length === 0) {
      setStaffLoading(true);
      getStaff().then(res => setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })))).catch(() => {}).finally(() => setStaffLoading(false));
    }
  }, [open, staffList.length, setStaffList, setStaffLoading]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getStaff({ search: search.trim() });
        setSearchResults((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
      } catch (_) { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (!open) return null;

  const handleSend = async () => {
    if (!to || !subject) { setErr('Recipient and subject required'); return; }
    setSending(true); setErr('');
    try {
      await createAlert({ to, subject, body, priority });
      setTo(''); setToName(''); setSubject(''); setBody(''); setPriority('NORMAL');
      onSent();
      onClose();
    } catch (e) { setErr(e.message || 'Failed to send alert'); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[520px] flex flex-col" role="dialog" aria-modal="true" aria-label="Send New Alert" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Send New Alert</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">To</label>
            <div className="relative">
              <input type="text" value={toName || search} onChange={e => { setSearch(e.target.value); setShowPicker(true); setTo(''); setToName(''); }}
                placeholder="Search staff..." className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
              {showPicker && search && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                  {searchLoading ? (
                    <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-muted">No matching staff found</div>
                  ) : (
                    searchResults.slice(0, 15).map(s => (
                      <button key={s.duz} onClick={() => { setTo(s.duz); setToName(s.name); setSearch(''); setShowPicker(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt">{s.name}</button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Alert subject"
              className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1">Body <span className="text-text-muted">(optional)</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text">Priority:</label>
            {['NORMAL', 'HIGH'].map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`px-3 py-1.5 text-xs rounded-md border ${priority === p ? (p === 'HIGH' ? 'bg-danger-bg border-[#CC3333] text-[#CC3333] font-bold' : 'bg-[#E8EEF5] border-steel text-steel font-bold') : 'border-border text-text-secondary hover:bg-surface-alt'}`}>
                {p}
              </button>
            ))}
          </div>
          {err && <div className="text-xs text-[#CC3333]">{err}</div>}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">Cancel</button>
          <button onClick={handleSend} disabled={sending || !to || !subject}
            className="px-4 py-2 text-sm bg-navy text-white rounded-md hover:bg-steel disabled:opacity-40">{sending ? 'Sending...' : 'Send Alert'}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MailMan Tab
 * ═══════════════════════════════════════════════════════════════════════════ */

function MailManTab({ messages, setMessages, messagesLoading, setMessagesLoading, selectedMessage, setSelectedMessage,
  messageBody, setMessageBody, messageBodyLoading, setMessageBodyLoading, composeModal, setComposeModal,
  mailFolder, setMailFolder, staffList, setStaffList, staffLoading, setStaffLoading, mailUnreadCount, setMailUnreadCount,
  mailBaskets, reloadMailBaskets }) {

  const [composeDraft, setComposeDraft] = useState(null);
  const folderTabs = buildMailFolderTabs(mailBaskets);

  const loadMessages = useCallback(async (folder) => {
    setMessagesLoading(true);
    try {
      const res = await getMailManInbox(folder);
      const list = res?.data || [];
      setMessages(list);
    } catch (err) { setMessages([]); }
    finally { setMessagesLoading(false); }
  }, [setMessages, setMessagesLoading]);

  useEffect(() => { loadMessages(mailFolder); }, [mailFolder, loadMessages]);

  const openMessage = async (msg) => {
    setSelectedMessage(msg);
    setMessageBodyLoading(true);
    try {
      const res = await getMailManMessage(msg.ien);
      setMessageBody(res?.data || null);
      setMessages(prev => prev.map(m => m.ien === msg.ien ? { ...m, read: true } : m));
      if (mailFolder === 'IN' && !msg.read) {
        setMailUnreadCount((count) => Math.max(0, count - 1));
      }
      if (!msg.read) await reloadMailBaskets();
    } catch (err) { setMessageBody(null); }
    finally { setMessageBodyLoading(false); }
  };

  const [deleteError, setDeleteError] = useState(null);

  const handleDelete = async (ien) => {
    setDeleteError(null);
    try {
      await deleteMailManMessage(ien);
      const deletedMessage = messages.find((message) => message.ien === ien);
      setMessages(prev => prev.filter(m => m.ien !== ien));
      if (mailFolder === 'IN' && deletedMessage && !deletedMessage.read) {
        setMailUnreadCount((count) => Math.max(0, count - 1));
      }
      await reloadMailBaskets();
      if (selectedMessage?.ien === ien) { setSelectedMessage(null); setMessageBody(null); }
    } catch (err) { setDeleteError(err?.message || 'Delete failed'); }
  };

  return (
    <div>
      {deleteError && (
        <div className="mb-3 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-xs text-[#CC3333] flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-auto text-[#CC3333] hover:underline text-[10px]">Dismiss</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {folderTabs.map((folder) => (
            <button key={folder.key} onClick={() => { setMailFolder(folder.key); setSelectedMessage(null); setMessageBody(null); }}
              className={`px-3 py-1.5 text-xs rounded-md border ${mailFolder === folder.key ? 'bg-[#E8EEF5] border-steel text-steel font-medium' : 'border-border text-text-secondary hover:bg-surface-alt'}`}>
              {folder.label}
              {folder.key === 'IN' && mailUnreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-steel px-1.5 py-0.5 text-[10px] font-bold text-white">{mailUnreadCount}</span>
              )}
              {folder.key !== 'IN' && folder.count > 0 && (
                <span className="ml-1.5 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-bold text-[#4B5563]">{folder.count}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => { setComposeDraft(null); setComposeModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-navy text-white rounded-md hover:bg-steel">
          <span className="material-symbols-outlined text-[14px]">edit</span> Compose
        </button>
      </div>

      <div className="flex gap-6">
        <div className={`${selectedMessage ? 'w-full xl:w-[40%]' : 'w-full'}`}>
          {messagesLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-md" />)}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <span className="material-symbols-outlined text-[40px] block mb-3">mail</span>
              <h3 className="text-lg font-semibold text-text mb-1">{mailFolder === 'WASTE' ? 'No Deleted Messages' : mailFolder === 'SENT' ? 'No Sent Messages' : mailFolder === 'IN' ? 'No Messages' : `No Messages in ${mailFolder}`}</h3>
              <p className="text-sm">Your {mailFolder === 'WASTE' ? 'deleted items' : mailFolder === 'SENT' ? 'sent folder' : mailFolder === 'IN' ? 'inbox' : `${mailFolder} basket`} is empty.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map(msg => (
                <button key={msg.ien} onClick={() => openMessage(msg)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedMessage?.ien === msg.ien ? 'border-steel bg-[#E8EEF5]' : msg.read ? 'border-border bg-white' : 'border-border bg-[#F0F4FF]'
                  }`}>
                  <div className="flex items-center gap-2">
                    {!msg.read && <div className="w-2 h-2 rounded-full bg-steel flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${msg.read ? 'text-text-secondary' : 'font-semibold text-text'}`}>{msg.from}</span>
                        {msg.priority === 'high' && <span className="text-[9px] bg-danger-bg text-danger px-1.5 py-0.5 rounded font-bold">HIGH</span>}
                      </div>
                      <div className="text-xs text-text truncate">{msg.subject}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                        <span>{msg.date}</span>
                        {mailFolder === 'IN' && msg.basket && msg.basket !== 'IN' && (
                          <span className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 font-medium text-[#4B5563]">{msg.basket}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedMessage && (
          <div className="hidden xl:block w-[60%] bg-surface-alt border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-text">{messageBody?.subject || selectedMessage.subject}</h3>
              <button onClick={() => { setSelectedMessage(null); setMessageBody(null); }} className="text-text-muted hover:text-text" aria-label="Close">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            {messageBodyLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-4 animate-pulse bg-[#E2E4E8] rounded" />)}</div>
            ) : messageBody ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                  <span>From: <strong>{messageBody.from}</strong></span>
                  <span>{messageBody.date}</span>
                  {messageBody.priority === 'high' && <span className="text-[9px] bg-danger-bg text-danger px-1.5 py-0.5 rounded font-bold">HIGH</span>}
                </div>
                <div className="p-3 bg-white rounded-md border border-border text-xs text-text whitespace-pre-wrap font-mono leading-relaxed min-h-[100px]">
                  {messageBody.body || '(empty)'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const subj = messageBody?.subject || selectedMessage?.subject || '';
                      const from = messageBody?.from || selectedMessage?.from || '';
                      let list = staffList;
                      if (list.length === 0) {
                        setStaffLoading(true);
                        try {
                          const res = await getStaff();
                          list = (res?.data || []).map(u => ({ duz: u.ien, name: u.name }));
                          setStaffList(list);
                        } catch (_staffErr) {
                          list = [];
                        } finally {
                          setStaffLoading(false);
                        }
                      }
                      const { duz, name } = matchStaffFromMailFromLine(from, list);
                      const subjectLine = subj.startsWith('Re:') ? subj : `Re: ${subj}`;
                      setComposeDraft({ to: duz, toName: name, subject: subjectLine, body: '' });
                      setComposeModal(true);
                    }}
                    className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-white bg-[#E8EEF5] text-steel font-medium"
                  >
                    Reply
                  </button>
                  <button onClick={() => handleDelete(selectedMessage.ien)}
                    className="px-3 py-1.5 text-xs border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8]">Delete</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Could not load message body.</p>
            )}
          </div>
        )}
      </div>

      {composeModal && (
        <ComposeMailModal
          initialDraft={composeDraft}
          onClose={() => { setComposeModal(false); setComposeDraft(null); }}
          onSent={() => loadMessages(mailFolder)}
          staffList={staffList}
          setStaffList={setStaffList}
          staffLoading={staffLoading}
          setStaffLoading={setStaffLoading}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Compose Mail Modal
 * ═══════════════════════════════════════════════════════════════════════════ */

function ComposeMailModal({ onClose, onSent, staffList, setStaffList, staffLoading, setStaffLoading, initialDraft }) {
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (staffList.length === 0) {
      setStaffLoading(true);
      getStaff().then(res => setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })))).catch(() => {}).finally(() => setStaffLoading(false));
    }
  }, [staffList.length, setStaffList, setStaffLoading]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getStaff({ search: search.trim() });
        setSearchResults((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
      } catch (_) { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (initialDraft) {
      setTo(initialDraft.to || '');
      setToName(initialDraft.toName || '');
      setSubject(initialDraft.subject || '');
      setBody(initialDraft.body || '');
    } else {
      setTo('');
      setToName('');
      setSubject('');
      setBody('');
    }
    setErr('');
    setSearch('');
    setShowPicker(false);
  }, [initialDraft]);

  const handleSend = async () => {
    if (!to || !subject) { setErr('Recipient and subject required'); return; }
    setSending(true); setErr('');
    try {
      await sendMailManMessage(to, subject, body);
      onSent();
      onClose();
    } catch (e) { setErr(e.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[520px] flex flex-col" role="dialog" aria-modal="true" aria-label="Compose Message" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Compose Message</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">Recipient</label>
            <p className="text-[10px] text-text-secondary mb-1">Search the staff directory by name and select a user.</p>
            <div className="relative">
              <input type="text" value={toName ? toName : search} onChange={e => { setSearch(e.target.value); setShowPicker(true); setTo(''); setToName(''); }}
                placeholder="Type to search staff…" autoComplete="off"
                className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
              {showPicker && search && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                  {searchLoading ? (
                    <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-muted">No matching staff found</div>
                  ) : (
                    searchResults.slice(0, 15).map(s => (
                      <button type="button" key={s.duz} onClick={() => { setTo(String(s.duz)); setToName(s.name); setSearch(''); setShowPicker(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt">{s.name}</button>
                    ))
                  )}
                </div>
              )}
            </div>
            {toName && to && (
              <p className="text-[10px] text-text-secondary mt-1">Sending to <span className="font-medium text-text">{toName}</span></p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
              className="w-full px-3 py-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
          </div>
          {err && <div className="text-xs text-[#CC3333]">{err}</div>}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">Cancel</button>
          <button onClick={handleSend} disabled={sending || !to || !subject}
            className="px-4 py-2 text-sm bg-navy text-white rounded-md hover:bg-steel disabled:opacity-40">{sending ? 'Sending...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
