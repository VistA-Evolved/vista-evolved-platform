'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface Pack {
  id: string;
  name: string;
  version: string;
  market: string;
  status: string;
  capabilityCount?: number;
}

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<Pack>[] = [
    { key: 'id', label: 'Pack ID', className: 'font-mono text-xs', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'market', label: 'Market', sortable: true },
    { key: 'capabilityCount', label: 'Capabilities' },
    {
      key: 'status', label: 'Status',
      render: (row) => <Badge variant={row.status === 'available' ? 'success' : 'muted'}>{row.status}</Badge>,
    },
  ];

  useEffect(() => {
    fetch('/api/operator/packs')
      .then(r => r.json())
      .then(d => setPacks(d.items || d.data || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pack Catalog"
        description="Available capability packs for tenant provisioning"
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={packs}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search packs…"
        emptyMessage="No packs found."
      />
    </div>
  );
}
