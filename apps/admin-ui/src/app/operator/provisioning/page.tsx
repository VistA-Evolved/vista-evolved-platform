'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationPending } from '@/components/shared/integration-pending';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function ProvisioningPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Provisioning Jobs"
        description="Track ongoing and historical tenant provisioning jobs"
        badge={<Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Integration Pending</Badge>}
      />
      <IntegrationPending
        label="Provisioning Job Queue — Integration Pending"
        detail="Provisioning job tracking requires the job runner service and job queue database. Jobs cover VistA distro container spin-up, routine installation, and pack activation."
      />
    </div>
  );
}
