'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationPending } from '@/components/shared/integration-pending';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export default function BootstrapPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="New Tenant Bootstrap"
        description="Provision a new VistA Evolved tenant from scratch"
        badge={<Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Integration Pending</Badge>}
      />
      <IntegrationPending
        label="Tenant Bootstrap Wizard — Integration Pending"
        detail="The guided bootstrap wizard will provision a new VistA distro container, configure market-specific packs, register Lago billing subscriptions, and create initial admin users. Requires the distro build pipeline and provisioning job runner."
      />
    </div>
  );
}
