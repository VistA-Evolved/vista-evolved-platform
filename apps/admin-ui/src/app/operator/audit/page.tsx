'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { fmtDate } from '@/lib/utils';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  outcome: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<AuditEntry>[] = [
    { key: 'timestamp', label: 'Time', render: (r) => <span className="font-mono text-xs">{fmtDate(r.timestamp)}</span>, sortable: true },
    { key: 'actor', label: 'Actor', sortable: true },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'resource', label: 'Resource', sortable: true },
    {
      key: 'outcome', label: 'Outcome',
      render: (r) => <Badge variant={r.outcome === 'success' ? 'success' : 'destructive'}>{r.outcome}</Badge>,
    },
  ];

  useEffect(() => {
    fetch('/api/operator/audit')
      .then(r => r.json())
      .then(d => setEntries(d.items || d.data || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Trail"
        description="Control plane administrative actions and access log"
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={entries}
        columns={columns}
        loading={loading}
        searchFields={['actor', 'action', 'resource']}
        searchPlaceholder="Search audit log…"
        emptyMessage="No audit entries found."
      />
    </div>
  );
}
