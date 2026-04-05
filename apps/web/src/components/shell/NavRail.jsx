import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSession, getSiteWorkspaces } from '../../services/adminService';

const workspaces = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
  { id: 'patients', label: 'Patients', icon: 'group', path: '/patients' },
  { id: 'scheduling', label: 'Scheduling', icon: 'calendar_month', path: '/scheduling' },
  { id: 'clinical', label: 'Clinical', icon: 'monitor_heart', path: '/clinical' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'medication', path: '/pharmacy' },
  { id: 'lab', label: 'Lab', icon: 'science', path: '/lab' },
  { id: 'imaging', label: 'Imaging', icon: 'radiology', path: '/imaging' },
  { id: 'billing', label: 'Billing', icon: 'receipt_long', path: '/billing' },
  { id: 'supply', label: 'Supply', icon: 'inventory_2', path: '/supply' },
  { id: 'admin', label: 'Admin', icon: 'settings', path: '/admin' },
  { id: 'analytics', label: 'Analytics', icon: 'bar_chart', path: '/analytics' },
];

// Map navGroup ids from the session to workspace ids
const NAV_GROUP_TO_WORKSPACE = {
  dashboard: 'dashboard',
  users: 'admin',
  facilities: 'patients',
  clinical: 'clinical',
  billing: 'billing',
  system: 'admin',
  devices: 'admin',
  monitoring: 'admin',
  vistatools: 'admin',
  settings: 'admin',
};

export default function NavRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visibleIds, setVisibleIds] = useState(null);
  const [siteDisabledIds, setSiteDisabledIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await getSession();
        if (cancelled) return;
        const navGroups = session?.navGroups;
        if (navGroups && Array.isArray(navGroups)) {
          const allowed = new Set();
          allowed.add('dashboard'); // always show dashboard
          navGroups.forEach(g => {
            const wsId = NAV_GROUP_TO_WORKSPACE[g];
            if (wsId) allowed.add(wsId);
            // Also allow if navGroup name directly matches a workspace id
            if (workspaces.some(w => w.id === g)) allowed.add(g);
          });
          // Admin users (who have settings/system/users) get all workspaces
          if (navGroups.length >= 8) {
            workspaces.forEach(w => allowed.add(w.id));
          }
          setVisibleIds(allowed);
        }

        // Also check site-level workspace visibility
        try {
          const siteRes = await getSiteWorkspaces();
          if (!cancelled && siteRes?.data) {
            const disabled = new Set();
            Object.entries(siteRes.data).forEach(([ws, enabled]) => {
              if (!enabled) disabled.add(ws.toLowerCase());
            });
            setSiteDisabledIds(disabled);
          }
        } catch { /* site workspaces not configured yet — show all */ }
      } catch { /* session load failed — show all workspaces */ }
    })();

    return () => { cancelled = true; };
  }, []);

  const activeWorkspace = workspaces.find(w => location.pathname.startsWith(w.path)) || workspaces[0];

  const filteredWorkspaces = workspaces.filter(ws => {
    // Site-level disabled workspaces are hidden
    if (siteDisabledIds.has(ws.id)) return false;
    // If role-based filtering is loaded, apply it
    if (visibleIds) return visibleIds.has(ws.id);
    // Not loaded yet — show all
    return true;
  });

  return (
    <nav className="fixed left-0 top-[40px] bottom-0 w-16 bg-navy flex flex-col items-center py-3 gap-1 z-40 overflow-y-auto">
      {filteredWorkspaces.map((ws) => {
        const isActive = activeWorkspace.id === ws.id;
        return (
          <button
            key={ws.id}
            onClick={() => navigate(ws.path)}
            title={ws.label}
            className={`
              relative w-12 h-12 flex items-center justify-center rounded-md transition-colors
              ${isActive
                ? 'bg-[#2E3A5E] text-white'
                : 'text-white/60 hover:bg-[#2E3A5E] hover:text-white/90'}
            `}
          >
            {isActive && (
              <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-white rounded-r" />
            )}
            <span className="material-symbols-outlined text-[20px]">{ws.icon}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { workspaces };
