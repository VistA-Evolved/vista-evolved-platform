'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  content: React.ReactNode;
  isValid?: () => boolean;
}

interface GuidedWizardProps {
  steps: WizardStep[];
  onComplete: () => Promise<void> | void;
  onCancel?: () => void;
  completeLabel?: string;
  className?: string;
}

export function GuidedWizard({
  steps, onComplete, onCancel,
  completeLabel = 'Finish',
  className,
}: GuidedWizardProps) {
  const [current, setCurrent] = useState(0);
  const [completing, setCompleting] = useState(false);

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const canProceed = !step.isValid || step.isValid();

  async function handleNext() {
    if (!canProceed) return;
    if (isLast) {
      setCompleting(true);
      try {
        await onComplete();
      } finally {
        setCompleting(false);
      }
    } else {
      setCurrent(c => c + 1);
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors',
                  i < current
                    ? 'bg-primary border-primary text-primary-foreground'
                    : i === current
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                )}
              >
                {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                'text-sm hidden sm:block',
                i === current ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px', i < current ? 'bg-primary' : 'bg-border')} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        {step.description && (
          <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
        )}
        {step.content}
      </div>

      <div className="flex justify-between">
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          )}
          {!isFirst && (
            <Button variant="outline" onClick={() => setCurrent(c => c - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
        </div>
        <Button onClick={handleNext} disabled={!canProceed || completing}>
          {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLast ? completeLabel : (
            <>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
