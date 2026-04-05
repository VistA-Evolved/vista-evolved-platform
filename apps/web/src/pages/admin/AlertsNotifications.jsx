import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { getAlerts, updateAlert, getStaff } from '../../services/adminService';
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
          <button onClick={loadData} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
            <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-border mb-6">
          <button onClick={() => setTab('alerts')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'alerts' ? 'border-navy text-navy' : 'border-transparent text-text-secondary hover:text-text'
            }`}>
            Alerts
            {newCount > 0 && <span className="ml-1.5 text-[10px] bg-danger-bg text-danger px-1.5 py-0.5 rounded-full font-bold">{newCount}</span>}
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
                      onClick={async () => {
                        if (!window.confirm('Delete this alert?')) return;
                        setActionLoading('delete');
                        try {
                          await updateAlert(selectedAlert.id, { status: 'deleted' });
                          setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
                          setSelectedAlert(null);
                        } catch { /* handled by API */ }
                        finally { setActionLoading(null); }
                      }}
                      className="px-3 py-2 text-xs border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] disabled:opacity-50">
                      {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="font-semibold text-sm text-text mb-3">Escalation Rules</h3>
              <p className="text-xs text-text-secondary mb-4">
                Configure how unresolved alerts escalate through the chain of responsibility.
              </p>
              <div className="space-y-3">
                {[
                  { type: 'Critical Lab Result', delay: '30 min', chain: 'Ordering Provider → Covering Provider → Department Chief → Facility Director' },
                  { type: 'Unsigned Orders', delay: '2 hours', chain: 'Ordering Provider → Cosigner → Department Chief' },
                  { type: 'System Interface Failure', delay: '15 min', chain: 'IT On-Call → IT Manager → CIO' },
                ].map(rule => (
                  <div key={rule.type} className="p-3 bg-surface-alt rounded-md">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs text-text">{rule.type}</span>
                      <span className="text-[10px] text-text-muted">Escalate after: {rule.delay}</span>
                    </div>
                    <div className="text-[10px] text-text-secondary">{rule.chain}</div>
                  </div>
                ))}
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
    </AppShell>
  );
}
