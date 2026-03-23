'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listHL7Interfaces, HL7Interface } from '@/lib/api';
import { AlertCircle, RefreshCw, Zap } from 'lucide-react';

export default function HL7Page() {
  const [interfaces, setInterfaces] = useState<HL7Interface[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<HL7Interface>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Interface Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'domain', label: 'Domain', sortable: true },
    { key: 'facility', label: 'Facility' },
    {
      key: 'active', label: 'Status', sortable: true,
      render: (row) => row.active !== false
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="muted">Inactive</Badge>,
    },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listHL7Interfaces()
      .then(r => { setInterfaces(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="HL7 Interfaces"
        description={loading ? 'Loading from VistA File 870 (HL Logical Link)…' : `${interfaces.length} interfaces from VistA File 870`}
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
      {!loading && interfaces.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Zap className="h-12 w-12 opacity-30" />
          <p className="text-sm">No HL7 interfaces found.</p>
        </div>
      )}
      <DataTable
        data={interfaces}
        columns={columns}
        loading={loading}
        searchFields={['name', 'type', 'domain', 'facility']}
        searchPlaceholder="Search interfaces by name, type, or domain…"
        pageSize={25}
      />
    </div>
  );
}
