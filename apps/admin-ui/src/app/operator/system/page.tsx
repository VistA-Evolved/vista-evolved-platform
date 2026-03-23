'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export default function OperatorSystemPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/operator/system-config')
      .then(r => r.json())
      .then(d => setConfig(d.config || d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Configuration"
        description="Platform-wide configuration and environment settings"
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <Card className="p-5">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : config ? (
          <dl className="divide-y">
            {Object.entries(config).flatMap(([section, val]) => {
              if (typeof val === 'object' && val !== null) {
                return Object.entries(val as Record<string, unknown>).map(([k, v]) => (
                  <div key={`${section}.${k}`} className="flex justify-between gap-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground min-w-0 truncate">{section} / {k}</dt>
                    <dd className="font-medium text-right truncate">{String(v ?? '—')}</dd>
                  </div>
                ));
              }
              return [(
                <div key={section} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground truncate">{section}</dt>
                  <dd className="font-medium text-right truncate">{String(val ?? '—')}</dd>
                </div>
              )];
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No configuration data available.</p>
        )}
      </Card>
    </div>
  );
}
