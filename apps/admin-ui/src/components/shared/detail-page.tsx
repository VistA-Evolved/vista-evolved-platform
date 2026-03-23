'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Edit3, X, Check, Loader2 } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface DetailPageProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  tabs?: Tab[];
  children?: React.ReactNode;
  onEdit?: () => void;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
  editing?: boolean;
  saving?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function DetailPage({
  title, subtitle, badge, tabs, children,
  onEdit, onSave, onCancel,
  editing = false, saving = false,
  actions, className,
}: DetailPageProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id ?? '');

  const activeContent = tabs?.find(t => t.id === activeTab)?.content;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="px-6 py-5 border-b bg-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {onEdit && !editing && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {editing && (
              <>
                <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
        {tabs && tabs.length > 0 && (
          <div className="flex gap-1 mt-4 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-t border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tabs ? activeContent : children}
      </div>
    </div>
  );
}

export function DetailField({
  label, value, children, className,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-2 py-2.5', className)}>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm text-foreground">{children ?? value ?? '—'}</dd>
    </div>
  );
}

export function DetailSection({
  title, children, className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {title && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</h3>
          <Separator className="mb-2" />
        </>
      )}
      <dl>{children}</dl>
    </div>
  );
}
