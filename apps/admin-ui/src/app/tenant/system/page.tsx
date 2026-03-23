'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getVistaStatus, getSystemStatus } from '@/lib/api';
import { AlertCircle, RefreshCw, CheckCircle2, WifiOff, Server, User, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VistaStatusData {
  ok?: boolean;
  url?: string;
  vistaReachable?: boolean;
  duz?: string;
  userName?: string;
}

interface VistaStatusResp {
  ok: boolean;
  vista?: VistaStatusData;
  currentUser?: { duz: string; userName: string };
  connectionMode?: string;
  source?: string;
}

export default function SystemPage() {
  const [vistaStatus, setVistaStatus] = useState<VistaStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    getVistaStatus()
      .then(r => setVistaStatus(r as unknown as VistaStatusResp))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const connected = vistaStatus?.vista?.vistaReachable === true;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="System Status"
        description="VistA runtime status, connection health, and site parameters"
        badge={<VistaSourceBadge source={loading ? undefined : error ? 'error' : connected ? 'vista' : 'pending'} />}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* VistA Connection */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">VistA Connection</h3>
            </div>
            {loading ? <Skeleton className="h-6 w-16" /> : (
              connected
                ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Connected</Badge>
                : <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3" />Offline</Badge>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : vistaStatus?.vista ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Host</dt>
                <dd className="font-mono font-medium">{vistaStatus.vista.url || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium capitalize">{vistaStatus.connectionMode?.replace(/-/g, ' ') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{vistaStatus.vista.vistaReachable ? 'Reachable' : 'Unreachable'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No connection data</p>
          )}
        </Card>

        {/* Current Session */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Current Session</h3>
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : vistaStatus?.currentUser ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">User</dt>
                <dd className="font-medium truncate">{vistaStatus.currentUser.userName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">DUZ</dt>
                <dd className="font-mono font-medium">{vistaStatus.currentUser.duz}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No session data</p>
          )}
        </Card>

        {/* System info */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Platform</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Product</dt>
              <dd className="font-medium">VistA Evolved</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="font-medium">Site Administration</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">VistA Instance</dt>
              <dd className="font-mono font-medium text-xs">{vistaStatus?.vista?.url || 'checking…'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Future integration pending items */}
      <div className="rounded-xl border border-dashed p-6 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Additional System Views</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {['Kernel Site Parameters', 'TaskMan Status', 'Error Processing', 'Package Inventory', 'MailMan Config', 'Module Entitlements', 'Menu Management', 'Capacity Planning'].map(item => (
            <div key={item} className="rounded-lg border p-3 text-muted-foreground flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">These views require additional VistA M-routine deployment. See the <a href="/operator/provisioning" className="underline">Provisioning</a> page.</p>
      </div>
    </div>
  );
}
