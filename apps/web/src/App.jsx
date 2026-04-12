import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import AppShell from './components/shell/AppShell';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import { getSessionToken } from './services/api';
import { getSession } from './services/adminService';
import { PatientProvider } from './components/shared/PatientContext';
import { FacilityProvider } from './contexts/FacilityContext';
import SessionManager from './components/shared/SessionManager';
import ESignatureSetup from './components/shared/ESignatureSetup';
import ErrorBoundary from './components/shared/ErrorBoundary';

function StaffIdRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/admin/staff/${userId}/edit`} replace />;
}

// Lazy-loaded admin pages
const StaffDirectory = lazy(() => import('./pages/admin/StaffDirectory'));
const StaffForm = lazy(() => import('./pages/admin/StaffForm'));
const PermissionsCatalog = lazy(() => import('./pages/admin/PermissionsCatalog'));
const RoleTemplates = lazy(() => import('./pages/admin/RoleTemplates'));
const SiteManagement = lazy(() => import('./pages/admin/SiteManagement'));
const SecurityAuth = lazy(() => import('./pages/admin/SecurityAuth'));
const SystemConfig = lazy(() => import('./pages/admin/SystemConfig'));
const SystemHealth = lazy(() => import('./pages/admin/SystemHealth'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AlertsNotifications = lazy(() => import('./pages/admin/AlertsNotifications'));
const DepartmentsServices = lazy(() => import('./pages/admin/DepartmentsServices'));
const SiteParameters = lazy(() => import('./pages/admin/SiteParameters'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ClinicManagement = lazy(() => import('./pages/admin/ClinicManagement'));
const WardManagement = lazy(() => import('./pages/admin/WardManagement'));
const DeviceManagement = lazy(() => import('./pages/admin/DeviceManagement'));
const MailGroupManagement = lazy(() => import('./pages/admin/MailGroupManagement'));

// Lazy-loaded patient pages
const PatientSearch = lazy(() => import('./pages/patients/PatientSearch'));
const PatientDashboard = lazy(() => import('./pages/patients/PatientDashboard'));
const PatientDemographics = lazy(() => import('./pages/patients/PatientDemographics'));
const InsuranceCoverage = lazy(() => import('./pages/patients/InsuranceCoverage'));
const FinancialAssessment = lazy(() => import('./pages/patients/FinancialAssessment'));
const Admission = lazy(() => import('./pages/patients/Admission'));
const Transfer = lazy(() => import('./pages/patients/Transfer'));
const Discharge = lazy(() => import('./pages/patients/Discharge'));
const BedManagement = lazy(() => import('./pages/patients/BedManagement'));
const PatientFlags = lazy(() => import('./pages/patients/PatientFlags'));
const RecordRestrictions = lazy(() => import('./pages/patients/RecordRestrictions'));
const RegistrationReports = lazy(() => import('./pages/patients/RegistrationReports'));

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
      } catch (err) { /* non-fatal */ }
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
      } catch (err) {
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
              You do not have the required permissions to access the Admin workspace.
              Contact your system administrator to request access.
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
      <FacilityProvider>
      <PatientProvider>
        <SessionManager />
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-pulse text-sm text-[#999]">Loading...</div></div>}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />

          {/* Admin/Security workspace — wrapped in ErrorBoundary to catch render crashes */}
          <Route path="/admin" element={<RequireAdmin><Navigate to="/admin/staff" replace /></RequireAdmin>} />
          {/* People */}
          <Route path="/admin/staff" element={<RequireAdmin><ErrorBoundary><StaffDirectory /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/staff/new" element={<RequireAdmin><ErrorBoundary><StaffForm /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/staff/:userId/edit" element={<RequireAdmin><ErrorBoundary><StaffForm /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/staff/:userId" element={<RequireAdmin><ErrorBoundary><StaffIdRedirect /></ErrorBoundary></RequireAdmin>} />
          {/* Access Control */}
          <Route path="/admin/roles" element={<RequireAdmin><ErrorBoundary><RoleTemplates /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/permissions" element={<RequireAdmin><ErrorBoundary><PermissionsCatalog /></ErrorBoundary></RequireAdmin>} />
          {/* Organization */}
          <Route path="/admin/sites" element={<RequireAdmin><ErrorBoundary><SiteManagement /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/departments" element={<RequireAdmin><ErrorBoundary><DepartmentsServices /></ErrorBoundary></RequireAdmin>} />
          {/* System Settings */}
          <Route path="/admin/security" element={<RequireAdmin><ErrorBoundary><SecurityAuth /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/config" element={<RequireAdmin><ErrorBoundary><SystemConfig /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/module-settings" element={<RequireAdmin><ErrorBoundary><SiteParameters /></ErrorBoundary></RequireAdmin>} />
          {/* Monitoring */}
          <Route path="/admin/health" element={<RequireAdmin><ErrorBoundary><SystemHealth /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/audit" element={<RequireAdmin><ErrorBoundary><AuditLog /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/messages" element={<RequireAdmin><ErrorBoundary><AlertsNotifications /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/reports" element={<RequireAdmin><ErrorBoundary><AdminReports /></ErrorBoundary></RequireAdmin>} />
          {/* Session 5 — New Pages */}
          <Route path="/admin/dashboard" element={<RequireAdmin><ErrorBoundary><AdminDashboard /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/clinics" element={<RequireAdmin><ErrorBoundary><ClinicManagement /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/wards" element={<RequireAdmin><ErrorBoundary><WardManagement /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/devices" element={<RequireAdmin><ErrorBoundary><DeviceManagement /></ErrorBoundary></RequireAdmin>} />
          <Route path="/admin/mail-groups" element={<RequireAdmin><ErrorBoundary><MailGroupManagement /></ErrorBoundary></RequireAdmin>} />
          {/* Legacy redirects */}
          <Route path="/admin/parameters" element={<Navigate to="/admin/module-settings" replace />} />
          <Route path="/admin/monitor" element={<Navigate to="/admin/health" replace />} />
          <Route path="/admin/alerts" element={<Navigate to="/admin/messages" replace />} />

          {/* Patients/Registration workspace — wrapped in ErrorBoundary (#328) */}
          <Route path="/patients" element={<RequireAuth><ErrorBoundary><PatientSearch /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/register" element={<RequireAuth><ErrorBoundary><PatientDemographics /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/beds" element={<RequireAuth><ErrorBoundary><BedManagement /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/reports" element={<RequireAuth><ErrorBoundary><RegistrationReports /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId" element={<RequireAuth><ErrorBoundary><PatientDashboard /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/edit" element={<RequireAuth><ErrorBoundary><PatientDemographics /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/insurance" element={<RequireAuth><ErrorBoundary><InsuranceCoverage /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/assessment" element={<RequireAuth><ErrorBoundary><FinancialAssessment /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/admit" element={<RequireAuth><ErrorBoundary><Admission /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/transfer" element={<RequireAuth><ErrorBoundary><Transfer /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/discharge" element={<RequireAuth><ErrorBoundary><Discharge /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/flags" element={<RequireAuth><ErrorBoundary><PatientFlags /></ErrorBoundary></RequireAuth>} />
          <Route path="/patients/:patientId/restrictions" element={<RequireAuth><ErrorBoundary><RecordRestrictions /></ErrorBoundary></RequireAuth>} />

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
        </Suspense>
      </PatientProvider>
      </FacilityProvider>
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
