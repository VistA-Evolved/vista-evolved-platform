'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ExternalLink } from 'lucide-react';

const RUNBOOKS = [
  { title: 'Lago Billing Setup', path: 'lago-billing-setup.md', desc: 'RSA keys, Docker services, org provisioning, API key wiring' },
  { title: 'VistA Provisioning', path: 'vista-provisioning.md', desc: 'Unified routine installer, provision status endpoint' },
  { title: 'Vista Baselines', path: 'vista-baselines.md', desc: 'VEHU vs legacy lanes, switching, probe scripts' },
  { title: 'Vista Distro Lane', path: 'vista-distro-lane.md', desc: 'Build, run, swap, and cutover the local distro build' },
  { title: 'Vista Admin Guided Write Workflows', path: 'vista-admin-guided-write-workflows.md', desc: 'FileMan CRUD workflow patterns for admin routes' },
];

export default function RunbooksPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Runbooks"
        description="Operational procedures for platform administration"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RUNBOOKS.map(rb => (
          <Card key={rb.path} className="p-4 hover:border-primary transition-colors">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{rb.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rb.desc}</p>
                <p className="text-xs text-primary mt-1 font-mono">{rb.path}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Full documentation is available in the{' '}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">docs/runbooks/</code>{' '}
          directory of the platform repository, or via the MkDocs site at{' '}
          <a href="http://127.0.0.1:8000" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            127.0.0.1:8000 <ExternalLink className="h-3 w-3" />
          </a>.
        </p>
      </div>
    </div>
  );
}
