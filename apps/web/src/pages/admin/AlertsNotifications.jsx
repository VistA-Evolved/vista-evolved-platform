import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getAlerts, updateAlert, getStaff, createAlert, getMailManInbox, getMailManMessage, sendMailManMessage, deleteMailManMessage } from '../../services/adminService';
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

export default function AlertsNotifications() {
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
  const [confirmDeleteAlert, setConfirmDeleteAlert] = useState(false);

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

  const newCount = alerts.filter(a => a.status === 'new').length;

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Alerts & Notifications">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Alerts & Notifications">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-text">Alerts & Notifications</h1>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? 'Loading from VistA...' : `${alerts.length} alerts loaded from live VistA bulletin system.`}
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

        <div className="flex items-center gap-1 border-b border-border mb-6">
          <button onClick={() => setTab('alerts')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'alerts' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Alerts
            {newCount > 0 && <span className="ml-1.5 text-[10px] bg-danger-bg text-danger px-1.5 py-0.5 rounded-full font-bold">{newCount}</span>}
          </button>
          <button onClick={() => setTab('messages')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'messages' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Messages
          </button>
          <button onClick={() => setTab('config')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'config' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Configuration
          </button>
        </div>

        {tab === 'alerts' && (
          <div className="flex gap-6">
            <div className={`${selectedAlert ? 'w-[35%]' : 'w-full'}`}>
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-[#E2E4E8] rounded-md" />)}</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <span className="material-symbols-outlined text-[40px] block mb-3">notifications_none</span>
                  <h3 className="text-lg font-semibold text-text mb-1">No Alerts</h3>
                  <p className="text-sm">No active alerts or bulletins in the VistA system. This is normal for a sandbox environment.</p>
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
                  <button onClick={() => setSelectedAlert(null)} className="text-text-muted hover:text-text">
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
                      <summary className="cursor-pointer hover:text-text">Raw VistA Data</summary>
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
                        } catch { /* handled by API */ }
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
                        } catch { /* handled by API */ }
                        finally { setActionLoading(null); }
                      }}
                      className="px-3 py-2 text-xs border border-border rounded-md hover:bg-white disabled:opacity-50">
                      {actionLoading === 'ack' ? 'Acknowledging...' : 'Acknowledge & Dismiss'}
                    </button>
                    <button disabled={actionLoading === 'forward'}
                      onClick={async () => {
                        setForwardModal(selectedAlert);
                        setStaffSearch('');
                        if (staffList.length === 0) {
                          setStaffLoading(true);
                          try {
                            const res = await getStaff();
                            setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
                          } catch { setStaffList([]); }
                          finally { setStaffLoading(false); }
                        }
                      }}
                      className="px-3 py-2 text-xs border border-border rounded-md hover:bg-white disabled:opacity-50">
                      Forward
                    </button>
                    <button disabled={actionLoading === 'delete'}
                      onClick={() => setConfirmDeleteAlert(true)}
                      className="px-3 py-2 text-xs border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] disabled:opacity-50">
                      {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          />
        )}

        {tab === 'config' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm text-text mb-3">Alert Configuration</h3>
              <p className="text-xs text-text-secondary mb-4">
                VistA alert routing is controlled by the BULLETIN file and MailMan distribution groups. 
                Escalation paths are determined by the alert type configuration in each VistA package.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-surface-alt rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-info">info</span>
                    <span className="font-medium text-xs text-text">Alert Delivery</span>
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    Alerts are delivered via the VistA bulletin system. Each package (Lab, Pharmacy, Orders, etc.) 
                    defines its own alert types and routing rules. Modify alert routing through the individual 
                    package parameter files or via the MailMan mail group management.
                  </div>
                </div>
                <div className="p-3 bg-surface-alt rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-warning">warning</span>
                    <span className="font-medium text-xs text-text">Unprocessed Alert Behavior</span>
                  </div>
                  <div className="text-[10px] text-text-secondary">
                    VistA alerts that remain unacknowledged follow the surrogacy chain defined in the 
                    NEW PERSON file (#200, field 20.6). Ensure surrogate entries are configured for 
                    all providers who receive clinical alerts.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Forward Modal */}
      {forwardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setForwardModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[440px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-text">Forward Alert</h3>
              <button onClick={() => setForwardModal(null)} className="text-text-muted hover:text-text">
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
                          } catch { /* handled by API */ }
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
            } catch { /* handled by API */ }
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

  useEffect(() => {
    if (open && staffList.length === 0) {
      setStaffLoading(true);
      getStaff().then(res => setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })))).catch(() => {}).finally(() => setStaffLoading(false));
    }
  }, [open, staffList.length, setStaffList, setStaffLoading]);

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
      <div className="bg-white rounded-lg shadow-xl w-[520px] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Send New Alert</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">To</label>
            <div className="relative">
              <input type="text" value={toName || search} onChange={e => { setSearch(e.target.value); setShowPicker(true); setTo(''); setToName(''); }}
                placeholder="Search staff..." className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
              {showPicker && search && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                  {staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 15).map(s => (
                    <button key={s.duz} onClick={() => { setTo(s.duz); setToName(s.name); setSearch(''); setShowPicker(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt">{s.name}</button>
                  ))}
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
  mailFolder, setMailFolder, staffList, setStaffList, staffLoading, setStaffLoading }) {

  const loadMessages = useCallback(async (folder) => {
    setMessagesLoading(true);
    try {
      const res = await getMailManInbox(folder);
      setMessages(res?.data || []);
    } catch { setMessages([]); }
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
    } catch { setMessageBody(null); }
    finally { setMessageBodyLoading(false); }
  };

  const handleDelete = async (ien) => {
    try {
      await deleteMailManMessage(ien);
      setMessages(prev => prev.filter(m => m.ien !== ien));
      if (selectedMessage?.ien === ien) { setSelectedMessage(null); setMessageBody(null); }
    } catch { /* silent */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {['IN', 'WASTE'].map(f => (
            <button key={f} onClick={() => { setMailFolder(f); setSelectedMessage(null); setMessageBody(null); }}
              className={`px-3 py-1.5 text-xs rounded-md border ${mailFolder === f ? 'bg-[#E8EEF5] border-steel text-steel font-medium' : 'border-border text-text-secondary hover:bg-surface-alt'}`}>
              {f === 'IN' ? 'Inbox' : 'Deleted'}
            </button>
          ))}
        </div>
        <button onClick={() => setComposeModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-navy text-white rounded-md hover:bg-steel">
          <span className="material-symbols-outlined text-[14px]">edit</span> Compose
        </button>
      </div>

      <div className="flex gap-6">
        <div className={`${selectedMessage ? 'w-[40%]' : 'w-full'}`}>
          {messagesLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-[#E2E4E8] rounded-md" />)}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <span className="material-symbols-outlined text-[40px] block mb-3">mail</span>
              <h3 className="text-lg font-semibold text-text mb-1">{mailFolder === 'WASTE' ? 'No Deleted Messages' : 'No Messages'}</h3>
              <p className="text-sm">Your VistA MailMan {mailFolder === 'WASTE' ? 'trash' : 'inbox'} is empty.</p>
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
                      <div className="text-[10px] text-text-muted mt-0.5">{msg.date}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedMessage && (
          <div className="w-[60%] bg-surface-alt border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-text">{messageBody?.subject || selectedMessage.subject}</h3>
              <button onClick={() => { setSelectedMessage(null); setMessageBody(null); }} className="text-text-muted hover:text-text">
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
                <div className="flex gap-2">
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
          onClose={() => setComposeModal(false)}
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

function ComposeMailModal({ onClose, onSent, staffList, setStaffList, staffLoading, setStaffLoading }) {
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (staffList.length === 0) {
      setStaffLoading(true);
      getStaff().then(res => setStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })))).catch(() => {}).finally(() => setStaffLoading(false));
    }
  }, [staffList.length, setStaffList, setStaffLoading]);

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
      <div className="bg-white rounded-lg shadow-xl w-[520px] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Compose Message</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1">To</label>
            <div className="relative">
              <input type="text" value={toName || search} onChange={e => { setSearch(e.target.value); setShowPicker(true); setTo(''); setToName(''); }}
                placeholder="Search staff..." className="w-full h-9 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
              {showPicker && search && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                  {staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 15).map(s => (
                    <button key={s.duz} onClick={() => { setTo(s.duz); setToName(s.name); setSearch(''); setShowPicker(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt">{s.name}</button>
                  ))}
                </div>
              )}
            </div>
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
