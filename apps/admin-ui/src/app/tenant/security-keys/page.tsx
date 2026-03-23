'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { listSecurityKeys, SecurityKey } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

const columns: Column<SecurityKey>[] = [
  { key: 'ien', label: 'IEN', className: 'w-20 font-mono text-xs', sortable: true },
  { key: 'name', label: 'Key Name', sortable: true },
  { key: 'description', label: 'Description' },
];

export default function SecurityKeysPage() {
  const [keys, setKeys] = useState<SecurityKey[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSecurityKeys()
      .then(r => { setKeys(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`Security Keys ${!loading ? `(${keys.length})` : ''}`}
        description="VistA security keys from File 19.1 — controls access to menus and RPCs"
        badge={<VistaSourceBadge source={source || (loading ? undefined : 'pending')} />}
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <DataTable
        data={keys}
        columns={columns}
        loading={loading}
        searchFields={['name', 'description']}
        searchPlaceholder="Search security keys…"
        emptyMessage="No security keys returned from VistA."
      />
    </div>
  );
}


