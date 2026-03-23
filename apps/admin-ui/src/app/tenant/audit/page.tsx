'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getFileManAudit } from '@/lib/api';
import { AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

interface AuditEntry {
  ien?: string;
  date?: string;
  user?: string;
  file?: string;
  field?: string;
  action?: string;
  oldValue?: string;
  newValue?: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true); setError(null);
    getFileManAudit()
      .then(r => { setEntries((r.data as AuditEntry[]) || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="FileMan Audit Trail"
        description={loading ? 'Loading from VistA File 1.1 (Audit)…' : `${entries.length} audit records from VistA File 1.1`}
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

      {!loading && entries.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 opacity-30" />
          <p className="text-sm font-medium">No audit records returned.</p>
          <p className="text-xs">FileMan audit logging may need to be enabled for the relevant files.</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-50 p-2 shrink-0">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    {e.date && <span className="text-xs font-mono text-muted-foreground">{e.date}</span>}
                    {e.user && <span className="text-xs font-medium">{e.user}</span>}
                    {e.action && <span className="text-xs text-blue-700 font-medium uppercase">{e.action}</span>}
                  </div>
                  <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
                    {e.file && <span>File: <span className="font-mono">{e.file}</span></span>}
                    {e.field && <span>Field: <span className="font-mono">{e.field}</span></span>}
                  </div>
                  {(e.oldValue || e.newValue) && (
                    <div className="flex gap-4 flex-wrap text-xs">
                      {e.oldValue && <span className="text-red-600">Old: {e.oldValue}</span>}
                      {e.newValue && <span className="text-green-700">New: {e.newValue}</span>}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
