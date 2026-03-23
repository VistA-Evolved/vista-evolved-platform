'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { listWards, VistaWard } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

const columns: Column<VistaWard>[] = [
  { key: 'ien', label: 'IEN', className: 'w-20 font-mono text-xs', sortable: true },
  { key: 'name', label: 'Ward Name', sortable: true },
  { key: 'service', label: 'Service', sortable: true },
  { key: 'authorized', label: 'Auth. Beds', className: 'text-right' },
  { key: 'occupied', label: 'Occupied', className: 'text-right' },
];

export default function WardsPage() {
  const [wards, setWards] = useState<VistaWard[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWards()
      .then(r => { setWards(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`Wards ${!loading ? `(${wards.length})` : ''}`}
        description="Inpatient wards from VistA File 42 (Ward Location)"
        badge={<VistaSourceBadge source={source || (loading ? undefined : 'pending')} />}
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={wards}
        columns={columns}
        loading={loading}
        searchFields={['name', 'service']}
        searchPlaceholder="Search wards…"
        emptyMessage="No wards returned from VistA."
      />
    </div>
  );
}


