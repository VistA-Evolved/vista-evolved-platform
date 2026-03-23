'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getBillingStatus } from '@/lib/api';
import { CheckCircle2, AlertCircle, CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BillingOperatorPage() {
  const [billing, setBilling] = useState<{ configured: boolean; provider: string; model: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBillingStatus()
      .then(r => setBilling(r.billing))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Billing & Entitlements"
        description="Lago usage-based billing engine and tenant subscription management"
        badge={
          loading ? undefined
          : billing?.configured
            ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Lago Connected</Badge>
            : <Badge variant="warning"><AlertCircle className="mr-1 h-3 w-3" />Not Configured</Badge>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="http://127.0.0.1:3041" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Lago UI
            </a>
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Provider</p>
            </div>
            <p className="text-2xl font-semibold">{billing?.provider || '—'}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium mb-2">Billing Model</p>
            <p className="text-2xl font-semibold">{billing?.model || '—'}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium mb-2">Status</p>
            <div className="flex items-center gap-2 mt-1">
              {billing?.configured
                ? <><CheckCircle2 className="h-5 w-5 text-green-500" /><span className="text-green-700 font-medium">Configured</span></>
                : <><AlertCircle className="h-5 w-5 text-amber-500" /><span className="text-amber-700 font-medium">Pending Setup</span></>
              }
            </div>
          </Card>
        </div>
      )}

      {!billing?.configured && !loading && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <h3 className="font-semibold text-amber-800 mb-1">Setup Required</h3>
          <p className="text-sm text-amber-700">
            Lago billing is not yet configured. Follow the{' '}
            <a href="/operator/runbooks" className="underline">billing setup runbook</a>{' '}
            to provision the Lago service and wire the API key into the control-plane-api.
          </p>
        </Card>
      )}
    </div>
  );
}
