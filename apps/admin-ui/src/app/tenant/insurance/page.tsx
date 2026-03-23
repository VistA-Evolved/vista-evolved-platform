'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { listInsuranceCompanies, InsuranceCompany } from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function InsurancePage() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<InsuranceCompany>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Insurance Company', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'state', label: 'State' },
    { key: 'phone', label: 'Phone', className: 'font-mono text-xs' },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listInsuranceCompanies()
      .then(r => { setCompanies(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Insurance Companies"
        description={loading ? 'Loading from VistA File 36 (Insurance Company)…' : `${companies.length} insurance companies`}
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
        data={companies}
        columns={columns}
        loading={loading}
        searchFields={['name', 'city', 'state']}
        searchPlaceholder="Search insurance companies…"
        pageSize={25}
      />
    </div>
  );
}
