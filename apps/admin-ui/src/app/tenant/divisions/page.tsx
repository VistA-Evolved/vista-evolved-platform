'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listDivisions, VistADivision } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<VistADivision[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<VistADivision>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'station', label: 'Station #', className: 'font-mono', sortable: true },
    { key: 'name', label: 'Division Name', sortable: true },
    { key: 'facility', label: 'Parent Facility' },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listDivisions()
      .then(r => { setDivisions(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Divisions"
        description={loading ? 'Loading from VistA File 40.8 (Medical Center Division)…' : `${divisions.length} divisions`}
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
        data={divisions}
        columns={columns}
        loading={loading}
        searchFields={['name', 'station', 'facility']}
        searchPlaceholder="Search divisions…"
        pageSize={25}
      />
    </div>
  );
}
