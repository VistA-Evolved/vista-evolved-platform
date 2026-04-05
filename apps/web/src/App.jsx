import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/shell/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { getSessionToken } from './services/api';
import { getSession } from './services/adminService';
import { PatientProvider } from './components/shared/PatientContext';
import SessionManager from './components/shared/SessionManager';
import ESignatureSetup from './components/shared/ESignatureSetup';

import StaffDirectory from './pages/admin/StaffDirectory';
import StaffForm from './pages/admin/StaffForm';
import PermissionsCatalog from './pages/admin/PermissionsCatalog';
import RoleTemplates from './pages/admin/RoleTemplates';
import SiteParameters from './pages/admin/SiteParameters';
import SiteManagement from './pages/admin/SiteManagement';
import AuditLog from './pages/admin/AuditLog';
import AlertsNotifications from './pages/admin/AlertsNotifications';
import SystemMonitor from './pages/admin/SystemMonitor';
import MasterConfig from './pages/admin/MasterConfig';

import PatientSearch from './pages/patients/PatientSearch';
import PatientDashboard from './pages/patients/PatientDashboard';
import PatientDemographics from './pages/patients/PatientDemographics';
import InsuranceCoverage from './pages/patients/InsuranceCoverage';
import FinancialAssessment from './pages/patients/FinancialAssessment';
import Admission from './pages/patients/Admission';
import Transfer from './pages/patients/Transfer';
import Discharge from './pages/patients/Discharge';
import BedManagement from './pages/patients/BedManagement';
import PatientFlags from './pages/patients/PatientFlags';
import RecordRestrictions from './pages/patients/RecordRestrictions';
import RegistrationReports from './pages/patients/RegistrationReports';

const ESIG_DISMISSED_KEY = 've-esig-dismissed';
const PROVIDER_KEYS = ['ORES', 'ORELSE', 'PROVIDER', 'OR CPRS GUI CHART'];

function RequireAuth({ children }) {
  const [showEsig, setShowEsig] = useState(false);
  const [esigUser, setEsigUser] = useState(null);

  useEffect(() => {
    if (!getSessionToken() || sessionStorage.getItem(ESIG_DISMISSED_KEY)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSession();
        if (cancelled) return;
        const keys = (res?.user?.keys || []).map(k => k.toUpperCase());
        const isProvider = PROVIDER_KEYS.some(k => keys.includes(k));
        if (isProvider && res?.user?.hasEsig === false) {
          setEsigUser(res.user);
          setShowEsig(true);
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!getSessionToken()) return <Navigate to="/login" replace />;
  return (
    <>
      {showEsig && esigUser && (
        <ESignatureSetup
          duz={esigUser.duz}
          userName={esigUser.name}
          onComplete={() => setShowEsig(false)}
          onSkip={() => { sessionStorage.setItem(ESIG_DISMISSED_KEY, 'true'); setShowEsig(false); }}
        />
      )}
      {children}
    </>
  );
}

/**
 * Admin workspace guard — checks that the logged-in user has admin-level
 * permissions via GET /auth/session. Caches result in sessionStorage.
 *
 * The Security Matrix specifies that only users with XUMGR, XU PARAM,
 * XUPROG, XUPROGMODE, or similar admin keys should access /admin/* routes.
 */
const ADMIN_SESSION_KEY = 've-admin-verified';
const ADMIN_KEYS = ['XUMGR', 'XUPROG', 'XUPROGMODE', 'XU PARAM', 'ZVE ADMIN AUDIT'];

function RequireAdmin({ children }) {
  const [status, setStatus] = useState(() => {
    if (!getSessionToken()) return 'no-token';
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') return 'allowed';
    return 'checking';
  });

  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSession();
        if (cancelled) return;
        const keys = (res?.user?.keys || []).map(k => k.toUpperCase());
        const isAdmin = ADMIN_KEYS.some(k => keys.includes(k));
        if (isAdmin) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
          setStatus('allowed');
        } else {
          setStatus('denied');
        }
      } catch {
        if (!cancelled) setStatus('denied');
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  if (status === 'no-token') return <Navigate to="/login" replace />;
  if (status === 'checking') return null; // brief loading state
  if (status === 'denied') {
    return (
      <AppShell breadcrumb="Access Denied">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <span className="material-symbols-outlined text-[48px] text-red-400 mb-3 block">lock</span>
            <h2 className="text-xl font-semibold text-text mb-2">Access Denied</h2>
            <p className="text-sm text-text-muted">
              You do not have the required security keys to access the Admin workspace.
              Contact your IRM to request XUMGR or equivalent access.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <PatientProvider>
        <SessionManager />
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />

          {/* Admin/Security workspace */}
          <Route path="/admin" element={<RequireAdmin><Navigate to="/admin/staff" replace /></RequireAdmin>} />
          <Route path="/admin/staff" element={<RequireAdmin><StaffDirectory /></RequireAdmin>} />
          <Route path="/admin/staff/new" element={<RequireAdmin><StaffForm /></RequireAdmin>} />
          <Route path="/admin/staff/:userId/edit" element={<RequireAdmin><StaffForm /></RequireAdmin>} />
          <Route path="/admin/permissions" element={<RequireAdmin><PermissionsCatalog /></RequireAdmin>} />
          <Route path="/admin/roles" element={<RequireAdmin><RoleTemplates /></RequireAdmin>} />
          <Route path="/admin/parameters" element={<RequireAdmin><SiteParameters /></RequireAdmin>} />
          <Route path="/admin/sites" element={<RequireAdmin><SiteManagement /></RequireAdmin>} />
          <Route path="/admin/audit" element={<RequireAdmin><AuditLog /></RequireAdmin>} />
          <Route path="/admin/alerts" element={<RequireAdmin><AlertsNotifications /></RequireAdmin>} />
          <Route path="/admin/monitor" element={<RequireAdmin><SystemMonitor /></RequireAdmin>} />
          <Route path="/admin/config" element={<RequireAdmin><MasterConfig /></RequireAdmin>} />

          {/* Patients/Registration workspace */}
          <Route path="/patients" element={<RequireAuth><PatientSearch /></RequireAuth>} />
          <Route path="/patients/register" element={<RequireAuth><PatientDemographics /></RequireAuth>} />
          <Route path="/patients/beds" element={<RequireAuth><BedManagement /></RequireAuth>} />
          <Route path="/patients/reports" element={<RequireAuth><RegistrationReports /></RequireAuth>} />
          <Route path="/patients/:patientId" element={<RequireAuth><PatientDashboard /></RequireAuth>} />
          <Route path="/patients/:patientId/edit" element={<RequireAuth><PatientDemographics /></RequireAuth>} />
          <Route path="/patients/:patientId/insurance" element={<RequireAuth><InsuranceCoverage /></RequireAuth>} />
          <Route path="/patients/:patientId/assessment" element={<RequireAuth><FinancialAssessment /></RequireAuth>} />
          <Route path="/patients/:patientId/admit" element={<RequireAuth><Admission /></RequireAuth>} />
          <Route path="/patients/:patientId/transfer" element={<RequireAuth><Transfer /></RequireAuth>} />
          <Route path="/patients/:patientId/discharge" element={<RequireAuth><Discharge /></RequireAuth>} />
          <Route path="/patients/:patientId/flags" element={<RequireAuth><PatientFlags /></RequireAuth>} />
          <Route path="/patients/:patientId/restrictions" element={<RequireAuth><RecordRestrictions /></RequireAuth>} />

          {/* Future workspaces — placeholder routes */}
          <Route path="/scheduling/*" element={<RequireAuth><WorkspacePlaceholder name="Scheduling" wave="1" /></RequireAuth>} />
          <Route path="/clinical/*" element={<RequireAuth><WorkspacePlaceholder name="Clinical" wave="1-2" /></RequireAuth>} />
          <Route path="/pharmacy/*" element={<RequireAuth><WorkspacePlaceholder name="Pharmacy" wave="2-3" /></RequireAuth>} />
          <Route path="/lab/*" element={<RequireAuth><WorkspacePlaceholder name="Laboratory" wave="2-3" /></RequireAuth>} />
          <Route path="/imaging/*" element={<RequireAuth><WorkspacePlaceholder name="Imaging" wave="2-3" /></RequireAuth>} />
          <Route path="/billing/*" element={<RequireAuth><WorkspacePlaceholder name="Billing" wave="3+" /></RequireAuth>} />
          <Route path="/supply/*" element={<RequireAuth><WorkspacePlaceholder name="Supply" wave="4+" /></RequireAuth>} />
          <Route path="/analytics/*" element={<RequireAuth><WorkspacePlaceholder name="Analytics" wave="2+" /></RequireAuth>} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PatientProvider>
    </BrowserRouter>
  );
}

function WorkspacePlaceholder({ name, wave }) {
  return (
    <AppShell breadcrumb={name}>
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-[48px] text-border mb-3 block">construction</span>
          <h2 className="text-xl font-semibold text-text mb-2">{name} Workspace</h2>
          <p className="text-sm text-text-muted mb-4">
            This workspace is planned for Build Wave {wave}.
          </p>
          <p className="text-xs text-text-muted">
            See <code className="bg-surface-alt px-1 py-0.5 rounded text-[11px]">docs/specs/</code> for
            the full specification.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
