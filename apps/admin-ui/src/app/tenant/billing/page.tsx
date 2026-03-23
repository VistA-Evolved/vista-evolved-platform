'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listInsuranceCompanies, InsuranceCompany } from '@/lib/api';
import { AlertCircle, RefreshCw, CreditCard, Building2 } from 'lucide-react';

export default function BillingPage() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<InsuranceCompany>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Insurance Company', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State' },
    { key: 'phone', label: 'Phone', className: 'font-mono text-xs' },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listInsuranceCompanies()
      .then(r => { setCompanies(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Billing Parameters"
        description="Insurance configuration and billing setup from VistA"
        badge={<VistaSourceBadge source={source || (loading ? undefined : error ? 'error' : 'pending')} />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Quick nav to related billing pages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/tenant/insurance', label: 'Insurance Companies', icon: Building2, desc: `${companies.length} payers from File 36` },
          { href: '/tenant/treating-specialties', label: 'Treating Specialties', icon: CreditCard, desc: 'Specialty-based billing codes' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-start gap-3 rounded-xl border p-4 hover:shadow-md transition-all">
              <div className="rounded-lg bg-blue-50 p-2 shrink-0"><Icon className="h-4 w-4 text-blue-600" /></div>
              <div><p className="font-semibold text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Insurance Companies (File 36)</h2>
        <DataTable
          data={companies}
          columns={columns}
          loading={loading}
          searchFields={['name', 'city', 'state']}
          searchPlaceholder="Search insurance companies…"
          pageSize={25}
        />
      </div>

      {/* IB parameters integration pending */}
      <div className="rounded-xl border border-dashed p-6 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">IB Billing Parameters</h3>
        <p className="text-sm text-muted-foreground">
          Integrated Billing (IB) parameters, AR configuration, and claims management views
          require the IB package to be configured in VistA. Current sandbox has empty IB/AR globals.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {['IB Site Parameters', 'AR Setup', 'Revenue Code', 'HIPAA Transmission', 'Bill/Claims', 'EOB Processing', 'Third Party Config', 'CPT Code Mapping'].map(item => (
            <div key={item} className="rounded-lg border p-3 text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
