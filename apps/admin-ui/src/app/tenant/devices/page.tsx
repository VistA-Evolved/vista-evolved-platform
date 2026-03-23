'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { listDevices, VistaDevice } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

const columns: Column<VistaDevice>[] = [
  { key: 'ien', label: 'IEN', className: 'w-20 font-mono text-xs', sortable: true },
  { key: 'name', label: 'Device Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'subtype', label: 'Subtype', sortable: true },
  { key: 'location', label: 'Location', sortable: true },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<VistaDevice[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDevices()
      .then(r => { setDevices(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`Devices ${!loading ? `(${devices.length})` : ''}`}
        description="Terminals, printers, and interfaces from VistA File 3.5 (Device)"
        badge={<VistaSourceBadge source={source || (loading ? undefined : 'pending')} />}
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={devices}
        columns={columns}
        loading={loading}
        searchFields={['name', 'type', 'subtype', 'location']}
        searchPlaceholder="Search devices…"
        emptyMessage="No devices returned from VistA."
      />
    </div>
  );
}


