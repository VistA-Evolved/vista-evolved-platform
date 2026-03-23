'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listEsigStatus, EsigStatus } from '@/lib/api';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function EsigPage() {
  const [users, setUsers] = useState<EsigStatus[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<EsigStatus>[] = useMemo(() => [
    { key: 'ien', label: 'DUZ', className: 'w-24 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'User Name', sortable: true },
    {
      key: 'hasEsig', label: 'E-Signature',
      render: (row) => row.hasEsig
        ? <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" />Set</Badge>
        : <Badge variant="muted">Not Set</Badge>,
    },
    { key: 'esigDate', label: 'Last Set', sortable: true },
    { key: 'providerStatus', label: 'Provider Status', sortable: true },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listEsigStatus()
      .then(r => { setUsers(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const withEsig = users.filter(u => u.hasEsig).length;

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="E-Signature Status"
        description={loading ? 'Loading e-signature status from VistA…' : `${withEsig} of ${users.length} users have e-signature set`}
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
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        searchFields={['name', 'providerStatus']}
        searchPlaceholder="Search users…"
        pageSize={25}
      />
    </div>
  );
}
