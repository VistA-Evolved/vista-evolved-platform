'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface Market {
  id: string;
  name: string;
  region: string;
  currency: string;
  status: string;
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Market>[] = [
    { key: 'id', label: 'ID', className: 'font-mono text-xs', sortable: true },
    { key: 'name', label: 'Market Name', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'currency', label: 'Currency', sortable: true },
    {
      key: 'status', label: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'muted'}>{row.status}</Badge>,
    },
  ];

  useEffect(() => {
    fetch('/api/operator/markets')
      .then(r => r.json())
      .then(d => setMarkets(d.items || d.data || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Markets Registry"
        description="Legal markets and regions available for tenant provisioning"
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={markets}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search markets…"
        emptyMessage="No markets registered."
      />
    </div>
  );
}
