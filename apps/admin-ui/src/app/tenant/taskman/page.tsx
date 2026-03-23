'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listTaskManTasks, TaskManTask } from '@/lib/api';
import { AlertCircle, RefreshCw, Clock } from 'lucide-react';

export default function TaskManPage() {
  const [tasks, setTasks] = useState<TaskManTask[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns: Column<TaskManTask>[] = useMemo(() => [
    { key: 'ien', label: 'Task #', className: 'w-24 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Task Name', sortable: true },
    { key: 'routine', label: 'Routine', className: 'font-mono text-xs', sortable: true },
    { key: 'rescheduling', label: 'Rescheduling', sortable: true },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const v = (row.status || '').toLowerCase();
        if (v === 'running') return <Badge variant="success">Running</Badge>;
        if (v === 'scheduled') return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
        return <Badge variant="muted">{row.status || 'Unknown'}</Badge>;
      },
    },
  ], []);

  function load() {
    setLoading(true); setError(null);
    listTaskManTasks()
      .then(r => { setTasks(r.data || []); setSource('vista'); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="TaskMan Tasks"
        description={loading ? 'Loading from VistA TaskMan (File 14.4)…' : `${tasks.length} scheduled tasks`}
        badge={<VistaSourceBadge source={source || (loading ? undefined : error ? 'error' : 'pending')} />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {!loading && tasks.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Clock className="h-12 w-12 opacity-30" />
          <p className="text-sm">No scheduled tasks.</p>
        </div>
      )}
      <DataTable
        data={tasks}
        columns={columns}
        loading={loading}
        searchFields={['name', 'routine', 'status']}
        searchPlaceholder="Search tasks by name or routine…"
        pageSize={25}
      />
    </div>
  );
}
