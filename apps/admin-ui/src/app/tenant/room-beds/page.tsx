'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listRoomBeds, RoomBed } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function RoomBedsPage() {
  const [beds, setBeds] = useState<RoomBed[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<RoomBed>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Room/Bed', sortable: true },
    { key: 'room', label: 'Room', sortable: true },
    { key: 'ward', label: 'Ward', sortable: true },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const v = (row.status || '').toLowerCase();
        if (v.includes('occupied') || v === 'o') return <Badge className="bg-orange-100 text-orange-800">Occupied</Badge>;
        if (v.includes('available') || v === 'a') return <Badge variant="success">Available</Badge>;
        return <Badge variant="muted">{row.status || '—'}</Badge>;
      },
    },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listRoomBeds()
      .then(r => { setBeds(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Rooms & Beds"
        description={loading ? 'Loading from VistA File 405.4 (Room-Bed)…' : `${beds.length} room/bed records`}
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
        data={beds}
        columns={columns}
        loading={loading}
        searchFields={['name', 'room', 'ward', 'status']}
        searchPlaceholder="Search by room, bed, or ward…"
        pageSize={25}
      />
    </div>
  );
}
