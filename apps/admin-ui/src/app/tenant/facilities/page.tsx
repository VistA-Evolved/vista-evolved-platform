'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { listFacilities, VistaFacility } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const columns: Column<VistaFacility>[] = [
  { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
  { key: 'stationNumber', label: 'Station #', sortable: true, className: 'font-mono text-sm' },
  { key: 'name', label: 'Facility Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
];

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<VistaFacility[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listFacilities()
      .then(r => { setFacilities(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Facilities"
        description={loading ? 'Loading from VistA File 4 (Institution)…' : `${facilities.length} facilities from VistA File 4`}
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
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={facilities}
        columns={columns}
        loading={loading}
        searchFields={['name', 'stationNumber', 'type']}
        searchPlaceholder="Search facilities…"
        emptyMessage="No facilities returned from VistA."
        pageSize={25}
      />
    </div>
  );
}
