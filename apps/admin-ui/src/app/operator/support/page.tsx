'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationPending } from '@/components/shared/integration-pending';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Support Console"
        description="Tenant support tickets, escalations, and impersonation tools"
        badge={<Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Integration Pending</Badge>}
      />
      <IntegrationPending
        label="Support Console — Integration Pending"
        detail="Support tools including read-only tenant impersonation, ticket management, and VistA log access for troubleshooting are planned for a future release."
      />
    </div>
  );
}
