import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const sections = [
  {
    group: 'Register',
    icon: 'person_add',
    items: [
      { label: 'Patient Search', path: '/patients', icon: 'search' },
      { label: 'Register New', path: '/patients/register', icon: 'how_to_reg' },
      { label: 'Edit Demographics', path: '/patients/:id/edit', icon: 'edit', paramRequired: true },
    ],
  },
  {
    group: 'Eligibility',
    icon: 'verified',
    items: [
      { label: 'Insurance & Coverage', path: '/patients/:id/insurance', icon: 'health_and_safety', paramRequired: true },
      { label: 'Financial Assessment', path: '/patients/:id/assessment', icon: 'account_balance', paramRequired: true },
    ],
  },
  {
    group: 'ADT',
    icon: 'hotel',
    items: [
      { label: 'Admission', path: '/patients/:id/admit', icon: 'login', paramRequired: true },
      { label: 'Transfer', path: '/patients/:id/transfer', icon: 'swap_horiz', paramRequired: true },
      { label: 'Discharge', path: '/patients/:id/discharge', icon: 'logout', paramRequired: true },
      { label: 'Bed Management', path: '/patients/beds', icon: 'bed' },
    ],
  },
  {
    group: 'Flags',
    icon: 'flag',
    items: [
      { label: 'Patient Flags', path: '/patients/:id/flags', icon: 'outlined_flag', paramRequired: true },
      { label: 'Record Restrictions', path: '/patients/:id/restrictions', icon: 'shield', paramRequired: true },
    ],
  },
  {
    group: 'Reports',
    icon: 'summarize',
    items: [
      { label: 'Registration Reports', path: '/patients/reports', icon: 'bar_chart' },
    ],
  },
];

function resolvePath(path, patientId) {
  if (!path.includes(':id')) return path;
  if (!patientId) return null;
  return path.replace(':id', patientId);
}

export default function PatientsSubNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState({});

  const patientMatch = location.pathname.match(/^\/patients\/(\d+)/);
  const currentPatientId = patientMatch ? patientMatch[1] : null;

  const toggleGroup = (group) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const isActive = (item) => {
    const resolved = resolvePath(item.path, currentPatientId);
    if (!resolved) return false;
    if (resolved === '/patients') {
      return location.pathname === '/patients';
    }
    if (resolved === '/patients/register') {
      return location.pathname === '/patients/register';
    }
    if (item.path === '/patients/:id/edit' && currentPatientId) {
      return location.pathname === `/patients/${currentPatientId}/edit`;
    }
    return location.pathname === resolved;
  };

  const activeGroup = sections.find(s =>
    s.items.some(item => isActive(item))
  )?.group;

  const handleClick = (item) => {
    const resolved = resolvePath(item.path, currentPatientId);
    if (!resolved) return;
    navigate(resolved);
  };

  return (
    <aside className="fixed left-16 top-10 bottom-0 w-[220px] bg-[#F8F9FB] border-r border-[#E2E4E8] z-30 overflow-y-auto">
      <div className="px-3 pt-4 pb-2">
        <h2 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider px-2">
          Patients
        </h2>
      </div>

      {currentPatientId ? (
        <div className="mx-3 mb-3 px-2 py-1.5 bg-[#E8EEF5] rounded-md">
          <button
            onClick={() => navigate(`/patients/${currentPatientId}`)}
            className="text-[11px] text-[#2E5984] font-medium hover:underline flex items-center gap-1.5 w-full text-left"
          >
            <span className="material-symbols-outlined text-[14px]">person</span>
            Patient Dashboard
          </button>
        </div>
      ) : (
        <div className="mx-3 mb-3 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-[10px] text-amber-700 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Search and select a patient to enable all actions
          </p>
        </div>
      )}

      <nav className="px-2 pb-4">
        {sections.map((section) => {
          const isGroupActive = activeGroup === section.group;
          const isGroupCollapsed = collapsed[section.group] && !isGroupActive;

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
                <span className={`material-symbols-outlined text-[14px] text-[#999] transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`}>
                  expand_more
                </span>
              </button>

              {!isGroupCollapsed && (
                <div className="ml-1 mt-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item);
                    const disabled = item.paramRequired && !currentPatientId;
                    return (
                      <button
                        key={item.path}
                        onClick={() => !disabled && handleClick(item)}
                        disabled={disabled}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-left transition-colors text-[12px]
                          ${disabled
                            ? 'text-[#bbb] cursor-not-allowed border-l-[3px] border-transparent pl-[9px]'
                            : active
                              ? 'bg-[#E8EEF5] text-[#1A1A2E] font-medium border-l-[3px] border-[#2E5984] pl-[9px]'
                              : 'text-[#555] hover:bg-[#EBEDF0] hover:text-[#222] border-l-[3px] border-transparent pl-[9px]'}
                        `}
                        title={disabled ? 'Select a patient first' : ''}
                      >
                        <span className={`material-symbols-outlined text-[16px] ${disabled ? 'text-[#ccc]' : active ? 'text-[#2E5984]' : 'text-[#999]'}`}>
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
