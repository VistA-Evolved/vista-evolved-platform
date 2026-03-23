import { AppShell } from '@/components/layout/app-shell';
import { tenantNavItems } from '@/lib/nav-items';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={tenantNavItems}
      variant="tenant"
      title="Site Administration"
    >
      {children}
    </AppShell>
  );
}
