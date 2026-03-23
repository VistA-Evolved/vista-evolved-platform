'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listPackages, VistAPackage } from '@/lib/api';
import { AlertCircle, RefreshCw, Archive } from 'lucide-react';

export default function PackagesPage() {
  const [pkgs, setPkgs] = useState<VistAPackage[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<VistAPackage>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'prefix', label: 'Prefix', className: 'w-24 font-mono text-sm font-bold', sortable: true },
    { key: 'name', label: 'Package Name', sortable: true },
    { key: 'version', label: 'Version', className: 'font-mono text-xs' },
    { key: 'developer', label: 'Developer', sortable: true },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listPackages()
      .then(r => { setPkgs(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Installed Packages"
        description={loading ? 'Loading from VistA File 9.4 (Package)…' : `${pkgs.length} packages installed in VistA`}
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
      {!loading && pkgs.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Archive className="h-12 w-12 opacity-30" />
          <p className="text-sm">No packages found.</p>
        </div>
      )}
      <DataTable
        data={pkgs}
        columns={columns}
        loading={loading}
        searchFields={['name', 'prefix', 'developer', 'version']}
        searchPlaceholder="Search packages by name, prefix, or developer…"
        pageSize={25}
      />
    </div>
  );
}
