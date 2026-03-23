'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationPending } from '@/components/shared/integration-pending';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Monitoring"
        description="Platform health, SLA metrics, and incident tracking across all tenants"
        badge={<Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Integration Pending</Badge>}
      />
      <IntegrationPending
        label="Platform Monitoring — Integration Pending"
        detail="Real-time health monitoring will aggregate tenant VistA uptime, RPC latency, error rates, and SLA compliance. Requires VistA health probe integration and time-series metrics storage."
      />
    </div>
  );
}
