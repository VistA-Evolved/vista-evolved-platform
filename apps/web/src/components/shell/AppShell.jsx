import { useLocation } from 'react-router-dom';
import NavRail from './NavRail';
import SystemBar from './SystemBar';
import AdminSubNav from './AdminSubNav';
import PatientsSubNav from './PatientsSubNav';

export default function AppShell({ breadcrumb, children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isPatients = location.pathname.startsWith('/patients');
  const hasSidebar = isAdmin || isPatients;

  return (
    <div className="min-h-screen bg-white font-sans">
      <SystemBar breadcrumb={breadcrumb} />
      <NavRail />
      {isAdmin && <AdminSubNav />}
      {isPatients && <PatientsSubNav />}
      <main className={`mt-10 min-h-content ${hasSidebar ? 'ml-[calc(4rem+220px)]' : 'ml-16'}`}>
        {children}
      </main>
    </div>
  );
}
