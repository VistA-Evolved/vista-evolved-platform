import { Link } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';

export default function DashboardPage() {
  return (
    <AppShell breadcrumb="Dashboard">
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-text mb-1">Welcome to VistA Evolved</h1>
        <p className="text-sm text-text-secondary mb-8">
          Select a workspace from the navigation rail to get started.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <WorkspaceCard
            icon="settings"
            title="Administration"
            description="Manage staff, permissions, facilities, and system configuration."
            href="/admin"
            status="available"
          />
          <WorkspaceCard
            icon="calendar_month"
            title="Scheduling"
            description="Appointments, clinic schedules, availability management."
            href="/scheduling"
            status="coming"
            wave="Wave 1"
          />
          <WorkspaceCard
            icon="group"
            title="Patients"
            description="Patient registration, search, demographics, and chart access."
            href="/patients"
            status="coming"
            wave="Wave 1-2"
          />
          <WorkspaceCard
            icon="monitor_heart"
            title="Clinical"
            description="Clinical notes, orders, results, allergies, and vitals."
            href="/clinical"
            status="coming"
            wave="Wave 1-2"
          />
          <WorkspaceCard
            icon="medication"
            title="Pharmacy"
            description="Prescription processing, formulary, medication verification."
            href="/pharmacy"
            status="coming"
            wave="Wave 2-3"
          />
          <WorkspaceCard
            icon="science"
            title="Laboratory"
            description="Lab orders, results, specimen tracking, and verification."
            href="/lab"
            status="coming"
            wave="Wave 2-3"
          />
        </div>
      </div>
    </AppShell>
  );
}

function WorkspaceCard({ icon, title, description, href, status, wave }) {
  const isAvailable = status === 'available';
  const content = (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isAvailable ? 'bg-[#E8EEF5] text-steel' : 'bg-surface-alt text-text-muted'}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-text">{title}</h3>
          {!isAvailable && wave && (
            <span className="text-[10px] uppercase tracking-wider font-medium text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
              {wave}
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
  const cls = `block p-5 rounded-lg border transition-all ${
    isAvailable
      ? 'border-border hover:border-steel hover:shadow-md cursor-pointer'
      : 'border-border/50 opacity-60 cursor-default'
  }`;
  if (isAvailable) {
    return <Link to={href} className={cls}>{content}</Link>;
  }
  return <div className={cls}>{content}</div>;
}
