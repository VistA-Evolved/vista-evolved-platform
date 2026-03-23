'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listErrorTrap, ErrorTrapEntry } from '@/lib/api';
import { AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ErrorTrapPage() {
  const [errors, setErrors] = useState<ErrorTrapEntry[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<ErrorTrapEntry>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'date', label: 'Date/Time', sortable: true },
    { key: 'routine', label: 'Routine', className: 'font-mono text-xs', sortable: true },
    { key: 'error', label: 'Error Description' },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listErrorTrap()
      .then(r => { setErrors(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Error Processing"
        description={loading ? 'Loading from VistA Error Trap (^XTER global)…' : `${errors.length} error trap entries`}
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
      {!loading && errors.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 opacity-30" />
          <p className="text-sm font-medium">No errors in the error trap. System is clean.</p>
        </div>
      )}
      <DataTable
        data={errors}
        columns={columns}
        loading={loading}
        searchFields={['error', 'routine']}
        searchPlaceholder="Search error messages…"
        pageSize={25}
      />
    </div>
  );
}
