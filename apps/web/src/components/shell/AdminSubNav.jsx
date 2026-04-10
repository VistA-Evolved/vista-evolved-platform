import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const sections = [
  {
    group: 'Overview',
    icon: 'dashboard',
    items: [
      { label: 'Admin Dashboard', path: '/admin/dashboard', icon: 'space_dashboard' },
    ],
  },
  {
    group: 'People',
    icon: 'badge',
    items: [
      { label: 'Staff Directory', path: '/admin/staff', icon: 'group' },
      { label: 'Add Staff Member', path: '/admin/staff/new', icon: 'person_add' },
    ],
  },
  {
    group: 'Access Control',
    icon: 'key',
    items: [
      { label: 'Roles & Permissions', path: '/admin/roles', icon: 'shield_person' },
      { label: 'Permission Catalog', path: '/admin/permissions', icon: 'vpn_key' },
    ],
  },
  {
    group: 'Clinical Setup',
    icon: 'local_hospital',
    items: [
      { label: 'Clinics', path: '/admin/clinics', icon: 'clinical_notes' },
      { label: 'Wards', path: '/admin/wards', icon: 'bed' },
    ],
  },
  {
    group: 'Organization',
    icon: 'domain',
    items: [
      { label: 'Facilities & Sites', path: '/admin/sites', icon: 'apartment' },
      { label: 'Departments & Services', path: '/admin/departments', icon: 'account_tree' },
    ],
  },
  {
    group: 'System Settings',
    icon: 'tune',
    items: [
      { label: 'Security & Authentication', path: '/admin/security', icon: 'lock' },
      { label: 'System Configuration', path: '/admin/config', icon: 'settings_applications' },
      { label: 'Module Settings', path: '/admin/module-settings', icon: 'package_2' },
      { label: 'Devices', path: '/admin/devices', icon: 'print' },
    ],
  },
  {
    group: 'Mail Administration',
    icon: 'mail',
    items: [
      { label: 'Mail Groups', path: '/admin/mail-groups', icon: 'group_work' },
    ],
  },
  {
    group: 'Monitoring',
    icon: 'monitoring',
    items: [
      { label: 'System Health', path: '/admin/health', icon: 'monitor_heart' },
      { label: 'Audit Trail', path: '/admin/audit', icon: 'history' },
      { label: 'Messages & Alerts', path: '/admin/messages', icon: 'notifications_active' },
      { label: 'Reports', path: '/admin/reports', icon: 'assessment' },
    ],
  },
];

export default function AdminSubNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (group) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (path) => {
    if (path === '/admin/staff') {
      return (
        location.pathname === '/admin/staff' ||
        location.pathname === '/admin' ||
        /^\/admin\/staff\/\d+/.test(location.pathname)
      );
    }
    if (path === '/admin/staff/new') {
      return location.pathname === '/admin/staff/new';
    }
    return location.pathname === path;
  };

  const activeGroup = sections.find(s =>
    s.items.some(item => isActive(item.path))
  )?.group;

  return (
    <aside className="fixed left-16 top-10 bottom-0 w-[180px] lg:w-[220px] bg-[#F8F9FB] border-r border-[#E2E4E8] z-30 overflow-y-auto">
      <div className="px-3 pt-4 pb-2">
        <h2 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider px-2">
          Administration
        </h2>
      </div>

      <nav className="px-2 pb-4">
        {sections.map((section) => {
          const isGroupActive = activeGroup === section.group;
          const isCollapsed = collapsed[section.group] && !isGroupActive;

          return (
            <div key={section.group} className="mb-1">
              <button
                onClick={() => toggleGroup(section.group)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors
                  ${isGroupActive
                    ? 'text-[#1A1A2E] font-semibold'
                    : 'text-[#666] hover:text-[#333] hover:bg-[#EBEDF0]'}
                `}
              >
                <span className="material-symbols-outlined text-[16px]">{section.icon}</span>
                <span className="text-[11px] flex-1 uppercase tracking-wide">{section.group}</span>
                <span className={`material-symbols-outlined text-[14px] text-[#999] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                  expand_more
                </span>
              </button>

              {!isCollapsed && (
                <div className="ml-1 mt-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-left transition-colors text-[12px]
                          ${active
                            ? 'bg-[#E8EEF5] text-[#1A1A2E] font-medium border-l-[3px] border-[#2E5984] pl-[9px]'
                            : 'text-[#555] hover:bg-[#EBEDF0] hover:text-[#222] border-l-[3px] border-transparent pl-[9px]'}
                        `}
                      >
                        <span className={`material-symbols-outlined text-[16px] ${active ? 'text-[#2E5984]' : 'text-[#999]'}`}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

