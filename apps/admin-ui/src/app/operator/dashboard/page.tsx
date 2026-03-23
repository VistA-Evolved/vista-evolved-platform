'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { listTenants, getBillingStatus, Tenant } from '@/lib/api';
import {
  Building2, CreditCard, Activity, CheckCircle2, AlertCircle,
  Users, Globe, TrendingUp
} from 'lucide-react';

export default function OperatorDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [billing, setBilling] = useState<{ configured: boolean; provider: string; model: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([listTenants(), getBillingStatus()]).then(([tr, br]) => {
      if (tr.status === 'fulfilled') setTenants(tr.value.items);
      if (br.status === 'fulfilled') setBilling(br.value.billing);
    }).finally(() => setLoading(false));
  }, []);

  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const trialTenants = tenants.filter(t => t.status === 'trial').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Center"
        description="Platform-wide overview across all tenants and services"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <Card className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-500 p-2.5"><Building2 className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-2xl font-semibold">{tenants.length}</p>
                <p className="text-sm text-muted-foreground">Total Tenants</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-green-500 p-2.5"><Users className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-2xl font-semibold">{activeTenants}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-500 p-2.5"><Globe className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-2xl font-semibold">{trialTenants}</p>
                <p className="text-sm text-muted-foreground">Trials</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${billing?.configured ? 'bg-violet-500' : 'bg-gray-400'}`}>
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">{billing?.provider || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {billing?.configured ? 'Billing Active' : 'Billing Pending'}
                </p>
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Recent Tenants</h2>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants provisioned yet.</p>
          ) : (
            <div className="space-y-2">
              {tenants.slice(0, 5).map(t => (
                <div key={t.tenantId} className="flex items-center justify-between text-sm py-1">
                  <span className="font-medium truncate">{t.displayName}</span>
                  <Badge variant={t.status === 'active' ? 'success' : 'muted'}>{t.status}</Badge>
                </div>
              ))}
              {tenants.length > 5 && (
                <a href="/operator/tenants" className="text-xs text-primary hover:underline">
                  View all {tenants.length} tenants →
                </a>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Platform Services</h2>
          <div className="space-y-3">
            {[
              { label: 'Control Plane API', status: 'healthy' },
              { label: 'Billing (Lago)', status: billing?.configured ? 'healthy' : 'pending' },
              { label: 'Platform Database', status: 'healthy' },
              { label: 'VistA Distro', status: 'unknown' },
            ].map(svc => (
              <div key={svc.label} className="flex items-center justify-between text-sm">
                <span>{svc.label}</span>
                <div className="flex items-center gap-1.5">
                  {svc.status === 'healthy'
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : svc.status === 'pending'
                      ? <AlertCircle className="h-4 w-4 text-amber-500" />
                      : <AlertCircle className="h-4 w-4 text-gray-400" />
                  }
                  <span className={
                    svc.status === 'healthy' ? 'text-green-600'
                      : svc.status === 'pending' ? 'text-amber-600'
                        : 'text-muted-foreground'
                  }>{svc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
