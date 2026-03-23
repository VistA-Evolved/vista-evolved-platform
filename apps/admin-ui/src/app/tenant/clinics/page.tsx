'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { listClinics, VistaClinic } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<VistaClinic[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<VistaClinic>[] = [
    { key: 'ien', label: 'IEN', className: 'w-20 font-mono text-xs', sortable: true },
    { key: 'name', label: 'Clinic Name', sortable: true },
    { key: 'facility', label: 'Facility', sortable: true },
    { key: 'provider', label: 'Provider', sortable: true },
    { key: 'stopCode', label: 'Stop Code' },
    {
      key: 'active', label: 'Status',
      render: (row) => row.active !== false
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="muted">Inactive</Badge>,
    },
  ];

  useEffect(() => {
    listClinics()
      .then(r => { setClinics(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`Clinics ${!loading ? `(${clinics.length})` : ''}`}
        description="Hospital locations from VistA File 44 (Hospital Location)"
        badge={<VistaSourceBadge source={source || (loading ? undefined : 'pending')} />}
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={clinics}
        columns={columns}
        loading={loading}
        searchFields={['name', 'facility', 'provider', 'stopCode']}
        searchPlaceholder="Search clinics…"
        emptyMessage="No clinics returned from VistA."
      />
    </div>
  );
}

