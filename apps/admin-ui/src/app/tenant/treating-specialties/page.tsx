'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listTreatingSpecialties, TreatingSpecialty } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function TreatingSpecialtiesPage() {
  const [specialties, setSpecialties] = useState<TreatingSpecialty[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<TreatingSpecialty>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Specialty Name', sortable: true },
    { key: 'service', label: 'Service', sortable: true },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listTreatingSpecialties()
      .then(r => { setSpecialties(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Treating Specialties"
        description={loading ? 'Loading from VistA File 45.7 (Treating Specialty)…' : `${specialties.length} treating specialties`}
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
        data={specialties}
        columns={columns}
        loading={loading}
        searchFields={['name', 'service']}
        searchPlaceholder="Search treating specialties…"
        pageSize={25}
      />
    </div>
  );
}
