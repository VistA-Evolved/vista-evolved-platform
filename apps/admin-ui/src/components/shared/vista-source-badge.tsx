'use client'
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Database, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VistaSourceBadgeProps {
  source?: string;
  className?: string;
}

export function VistaSourceBadge({ source, className }: VistaSourceBadgeProps) {
  if (!source) return null;

  const isLive = source === 'vista' || source === 'real' || source === 'real-backend';
  const isPending = source === 'pending' || source === 'integration-pending';
  const isUnavailable = source === 'unavailable' || source === 'error';
  const isMock = source === 'mock' || source === 'stub' || source === 'default';

  if (isLive) {
    return (
      <Badge variant="success" className={cn('gap-1', className)}>
        <Database className="h-3 w-3" />
        VistA Live
      </Badge>
    );
  }
  if (isPending) {
    return (
      <Badge variant="warning" className={cn('gap-1', className)}>
        <Clock className="h-3 w-3" />
        Integration Pending
      </Badge>
    );
  }
  if (isUnavailable) {
    return (
      <Badge variant="destructive" className={cn('gap-1', className)}>
        <AlertCircle className="h-3 w-3" />
        Unavailable
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className={cn('gap-1', className)}>
      <Database className="h-3 w-3" />
      {source}
    </Badge>
  );
}
