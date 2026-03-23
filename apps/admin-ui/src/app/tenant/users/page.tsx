'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { listUsers, VistaUser } from '@/lib/api';
import { AlertCircle, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UsersPage() {
  const [users, setUsers] = useState<VistaUser[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<VistaUser>[] = useMemo(() => [
    {
      key: 'ien', label: 'ID',
      className: 'w-24 font-mono text-xs text-muted-foreground',
      sortable: true,
    },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'service', label: 'Service', sortable: true },
    { key: 'division', label: 'Division' },
    {
      key: 'active', label: 'Status',
      sortable: true,
      render: (row) => row.active
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="muted">Inactive</Badge>,
    },
    { key: 'npi', label: 'NPI', className: 'font-mono text-xs' },
  ], []);

  function load() {
    setLoading(true);
    setError(null);
    listUsers()
      .then(r => { setUsers(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Users"
        description={loading ? 'Loading from VistA File 200 (New Person)…' : `${users.length} users from VistA File 200`}
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
      {!loading && users.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-sm">No users returned from VistA.</p>
        </div>
      )}
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        searchFields={['name', 'title', 'service']}
        searchPlaceholder="Search by name, title, or service…"
        pageSize={25}
      />
    </div>
  );
}
