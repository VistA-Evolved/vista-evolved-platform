'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listTenants, Tenant } from '@/lib/api';
import { AlertCircle, Plus } from 'lucide-react';
import { fmtDate } from '@/lib/utils';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Tenant>[] = [
    { key: 'tenantId', label: 'Tenant ID', className: 'font-mono text-xs w-44', sortable: true },
    { key: 'displayName', label: 'Name', sortable: true },
    { key: 'legalMarketId', label: 'Market', sortable: true },
    { key: 'launchTier', label: 'Tier', sortable: true },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const v: Record<string, string> = { active: 'success', trial: 'warning', suspended: 'destructive' };
        return <Badge variant={(v[row.status] || 'muted') as never}>{row.status}</Badge>;
      },
    },
    {
      key: 'createdAt', label: 'Created',
      render: (row) => <span className="text-muted-foreground">{fmtDate(row.createdAt as string)}</span>,
    },
    {
      key: 'actions', label: '',
      render: (row) => (
        <Button variant="outline" size="sm" asChild>
          <a href={`/operator/tenants/${row.tenantId}`}>View</a>
        </Button>
      ),
    },
  ];

  useEffect(() => {
    listTenants()
      .then(r => setTenants(r.items))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Tenant Registry ${!loading ? `(${tenants.length})` : ''}`}
        description="All provisioned VistA Evolved tenants"
        actions={
          <Button size="sm" asChild>
            <a href="/operator/bootstrap">
              <Plus className="mr-2 h-4 w-4" />
              New Tenant
            </a>
          </Button>
        }
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={tenants}
        columns={columns}
        loading={loading}
        searchFields={['displayName', 'tenantId', 'legalMarketId', 'launchTier', 'status']}
        searchPlaceholder="Search tenants…"
        emptyMessage="No tenants provisioned yet."
      />
    </div>
  );
}
