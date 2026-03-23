'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listMenuOptions, MenuOption } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function MenuOptionsPage() {
  const [options, setOptions] = useState<MenuOption[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<MenuOption>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Option Name', className: 'font-mono text-xs', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'description', label: 'Description' },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listMenuOptions()
      .then(r => { setOptions(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Menu Options"
        description={loading ? 'Loading from VistA File 19 (Option)…' : `${options.length} options from VistA File 19`}
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
        data={options}
        columns={columns}
        loading={loading}
        searchFields={['name', 'type', 'description']}
        searchPlaceholder="Search options by name or type…"
        pageSize={25}
      />
    </div>
  );
}
