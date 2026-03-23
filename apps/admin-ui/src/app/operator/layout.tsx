import { AppShell } from '@/components/layout/app-shell';
import { operatorNavItems } from '@/lib/nav-items';

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={operatorNavItems}
      variant="operator"
      title="Platform Operations"
    >
      {children}
    </AppShell>
  );
}
