'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listMailGroups, MailGroup } from '@/lib/api';
import { AlertCircle, RefreshCw, Mail } from 'lucide-react';

export default function MailGroupsPage() {
  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<MailGroup>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Group Name', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'members', label: 'Members', className: 'text-center', sortable: true },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listMailGroups()
      .then(r => { setGroups(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Mail Groups"
        description={loading ? 'Loading from VistA MailMan File 3.8…' : `${groups.length} mail groups from VistA MailMan`}
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
      {!loading && groups.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Mail className="h-12 w-12 opacity-30" />
          <p className="text-sm">No mail groups found.</p>
        </div>
      )}
      <DataTable
        data={groups}
        columns={columns}
        loading={loading}
        searchFields={['name', 'description']}
        searchPlaceholder="Search mail groups…"
        pageSize={25}
      />
    </div>
  );
}
