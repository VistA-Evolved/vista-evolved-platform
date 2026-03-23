'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationPending } from '@/components/shared/integration-pending';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function UsagePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Usage & Metering"
        description="Per-tenant VistA RPC call counts, active user sessions, and billable events"
        badge={<Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Integration Pending</Badge>}
      />
      <IntegrationPending
        label="Usage Metering — Integration Pending"
        detail="Usage metrics will be collected from VistA via a metering sidecar and pushed to Lago as billable events. Requires the metering agent and Lago event ingestion pipeline."
      />
    </div>
  );
}
