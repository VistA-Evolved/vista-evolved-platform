import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: React.ReactNode;
  className?: string;
  vistaContext?: string;
}

export function HelpTooltip({ content, className, vistaContext }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className={cn('h-3.5 w-3.5 text-muted-foreground cursor-help inline-block', className)} />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <div className="space-y-1">
          <p className="text-xs">{content}</p>
          {vistaContext && (
            <p className="text-[10px] text-muted-foreground/70 border-t pt-1 mt-1">
              VistA: {vistaContext}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
