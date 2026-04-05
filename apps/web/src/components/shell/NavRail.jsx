import { useLocation, useNavigate } from 'react-router-dom';

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

export default function NavRail() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeWorkspace = workspaces.find(w => location.pathname.startsWith(w.path)) || workspaces[0];

  return (
    <nav className="fixed left-0 top-[40px] bottom-0 w-16 bg-navy flex flex-col items-center py-3 gap-1 z-40 overflow-y-auto">
      {workspaces.map((ws) => {
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
