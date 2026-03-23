'use client'
import React from 'react';
import { Clock, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationPendingProps {
  label?: string;
  detail?: string;
  className?: string;
  rpc?: string;
  compact?: boolean;
}

export function IntegrationPending({
  label = 'Integration Pending',
  detail,
  className,
  rpc,
  compact = false,
}: IntegrationPendingProps) {
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-amber-600', className)}>
        <Clock className="h-3 w-3" />
        {label}
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center gap-3', className)}>
      <div className="rounded-full bg-amber-50 p-4">
        <Clock className="h-8 w-8 text-amber-500" />
      </div>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        {detail && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{detail}</p>}
        {rpc && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Database className="h-3 w-3" />
            Target RPC: <code className="font-mono">{rpc}</code>
          </div>
        )}
      </div>
    </div>
  );
}
