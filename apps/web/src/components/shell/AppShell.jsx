import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NavRail from './NavRail';
import SystemBar from './SystemBar';
import AdminSubNav from './AdminSubNav';
import PatientsSubNav from './PatientsSubNav';
import { getVistaStatus } from '../../services/adminService';

function SandboxBanner() {
  const [isProduction, setIsProduction] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getVistaStatus().then(res => {
      if (!cancelled && res?.productionMode && res.productionMode !== 'production') setIsProduction(false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (isProduction) return null;
  return (
    <div data-sandbox-banner className="bg-[#FFF3E0] border-b border-[#FFB74D] px-4 py-1.5 text-center text-[11px] font-semibold text-[#E65100] flex items-center justify-center gap-1.5">
      <span className="material-symbols-outlined text-[14px]">science</span>
      SANDBOX / TEST ENVIRONMENT — Changes here do not affect production systems
    </div>
  );
}

export default function AppShell({ breadcrumb, children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isPatients = location.pathname.startsWith('/patients');
  const hasSidebar = isAdmin || isPatients;

  return (
    <div className="min-h-screen bg-white font-sans">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-[#2E5984]">
        Skip to main content
      </a>
      <SystemBar breadcrumb={breadcrumb} />
      <NavRail />
      {isAdmin && <AdminSubNav />}
      {isPatients && <PatientsSubNav />}
      {isAdmin && <SandboxBanner />}
      <main id="main-content" role="main" aria-live="polite" className={`mt-10 min-h-content ${hasSidebar ? 'ml-[calc(4rem+180px)] lg:ml-[calc(4rem+220px)]' : 'ml-16'}`}>
        {children}
      </main>
    </div>
  );
}
