import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { getDashboard, getVistaStatus } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * Administration Dashboard — aggregated system overview
 * @vista Pulls counts from GET /dashboard (users, clinics, wards, beds, devices, HL7, keys, e-sig)
 */

const METRIC_CARDS = [
  { key: 'activeUserCount', label: 'Active Staff', icon: 'group', path: '/admin/staff', color: 'bg-[#E8EEF5] text-[#2E5984]' },
  { key: 'clinicCount', label: 'Clinics', icon: 'medical_services', path: '/admin/clinics', color: 'bg-[#E8F5E9] text-[#2D6A4F]' },
  { key: 'wardCount', label: 'Wards', icon: 'bed', path: '/admin/wards', color: 'bg-[#FFF3E0] text-[#E65100]' },
  { key: 'bedCount', label: 'Beds', icon: 'king_bed', path: '/admin/wards', color: 'bg-[#FCE4EC] text-[#AD1457]' },
  { key: 'deviceCount', label: 'Devices', icon: 'print', path: '/admin/devices', color: 'bg-[#F3E5F5] text-[#7B1FA2]' },
  { key: 'hl7InterfaceCount', label: 'HL7 Interfaces', icon: 'cable', path: '/admin/health', color: 'bg-[#E3F2FD] text-[#1565C0]' },
  { key: 'roleCount', label: 'Security Keys', icon: 'vpn_key', path: '/admin/permissions', color: 'bg-[#FFFDE7] text-[#F57F17]' },
  { key: 'esigActiveCount', label: 'E-Sig Active', icon: 'draw', path: '/admin/staff', color: 'bg-[#E0F7FA] text-[#00695C]' },
];

const QUICK_ACTIONS = [
  { label: 'Add Staff Member', icon: 'person_add', path: '/admin/staff/new' },
  { label: 'Add Clinic', icon: 'add_circle', path: '/admin/clinics' },
  { label: 'System Health', icon: 'monitor_heart', path: '/admin/health' },
  { label: 'Audit Trail', icon: 'history', path: '/admin/audit' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vistaStatus, setVistaStatus] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, vistaRes] = await Promise.allSettled([getDashboard(), getVistaStatus()]);
      if (dashRes.status === 'fulfilled') setData(dashRes.value?.data || dashRes.value || null);
      else setError(dashRes.reason?.message || 'Failed to load dashboard');
      if (vistaRes.status === 'fulfilled') setVistaStatus(vistaRes.value?.vista || vistaRes.value || null);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (error && !data) {
    return (
      <AppShell breadcrumb="Admin > Dashboard">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  const vistaOk = vistaStatus?.vistaReachable === true;

  return (
    <AppShell breadcrumb="Admin > Dashboard">
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-text">Administration Dashboard</h1>
            <p className="text-xs text-[#999] mt-1">System overview and quick access to administrative functions.</p>
          </div>
          <button onClick={loadData} title="Refresh dashboard data"
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F4F5F7]">
            <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
          </button>
        </div>

        {/* Connection status */}
        <div className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${vistaOk ? 'bg-[#E8F5E9] text-[#2D6A4F] border border-[#2D6A4F]' : 'bg-[#FDE8E8] text-[#CC3333] border border-[#CC3333]'}`}>
          <span className="material-symbols-outlined text-[16px]">{vistaOk ? 'check_circle' : 'error'}</span>
          {vistaOk ? 'VistA backend connected and responding.' : 'VistA backend is unreachable. Data may be stale.'}
        </div>

        {/* Metric cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(8)].map((_, i) => <div key={i} className="h-28 animate-pulse bg-[#E2E4E8] rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {METRIC_CARDS.map(card => {
              const value = data?.[card.key] ?? '—';
              return (
                <button key={card.key} onClick={() => navigate(card.path)}
                  title={`View ${card.label}`}
                  className="bg-white border border-[#E2E4E8] rounded-lg p-5 text-left hover:shadow-md transition-shadow group">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                      <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#999] group-hover:text-[#2E5984] transition-colors">arrow_forward</span>
                  </div>
                  <div className="text-2xl font-bold text-text">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                  <div className="text-xs text-[#999] mt-0.5">{card.label}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick actions */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {QUICK_ACTIONS.map(action => (
              <button key={action.path} onClick={() => navigate(action.path)}
                title={action.label}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E2E4E8] rounded-lg text-sm font-medium text-text hover:bg-[#F4F5F7] transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* System info */}
        {data && (
          <div className="bg-white border border-[#E2E4E8] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">System Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {data.facilityCount != null && <InfoItem label="Facilities" value={data.facilityCount} />}
              {data.apiRouteCount != null && <InfoItem label="API Routes" value={data.apiRouteCount} />}
              {data.vistaFileCount != null && <InfoItem label="VistA Files" value={data.vistaFileCount} />}
              {data.mRoutineCount != null && <InfoItem label="M Routines" value={data.mRoutineCount} />}
              {data.uiRouteCount != null && <InfoItem label="UI Routes" value={data.uiRouteCount} />}
              {data.terminalTypeCount != null && <InfoItem label="Terminal Types" value={data.terminalTypeCount} />}
              {data.userCount != null && <InfoItem label="Total Users" value={data.userCount} />}
              {data.vistaGrounding && <InfoItem label="VistA Grounding" value={data.vistaGrounding} />}
            </div>
          </div>
        )}

        <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
          <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
          <p className="mt-2">No direct terminal equivalent. Terminal administrators access system counts through FileMan inquiries and individual menu options.</p>
          <p className="mt-1">This dashboard aggregates information from multiple VistA files into one view.</p>
        </details>
      </div>
    </AppShell>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <span className="text-[#999]">{label}:</span>{' '}
      <span className="font-medium text-text">{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
    </div>
  );
}
