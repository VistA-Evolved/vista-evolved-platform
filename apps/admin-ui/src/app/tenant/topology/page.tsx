'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { getSiteTopology } from '@/lib/api';
import { AlertCircle, RefreshCw, Building2, Globe, BedDouble, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopoNode {
  ien: string;
  name: string;
  stationNumber?: string;
  abbreviation?: string;
  [key: string]: unknown;
}

interface TopologyData {
  institutions: TopoNode[];
  divisions: TopoNode[];
  clinics: TopoNode[];
  wards: TopoNode[];
}

export default function TopologyPage() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getSiteTopology()
      .then((r: any) => {
        if (r.ok && r.data) setData(r.data as TopologyData);
        else setError(r.error || 'Failed to load topology');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sections = data ? [
    { title: 'Institutions', icon: Globe, items: data.institutions || [], file: 'File 4' },
    { title: 'Divisions', icon: Building2, items: data.divisions || [], file: 'File 40.8' },
    { title: 'Clinics', icon: Stethoscope, items: data.clinics || [], file: 'File 44' },
    { title: 'Wards', icon: BedDouble, items: data.wards || [], file: 'File 42' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Site Topology" description="VistA facility hierarchy: institutions, divisions, clinics, and wards." />
        <div className="flex items-center gap-3">
          <VistaSourceBadge source={data ? 'vista' : (error ? 'error' : 'loading')} />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-12 text-muted-foreground">Loading topology from VistA...</div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="border rounded-lg">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {section.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{section.file}</span>
                    <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                      {section.items.length}
                    </span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {section.items.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No entries found</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">IEN</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Station / Abbr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item: TopoNode, idx: number) => (
                          <tr key={item.ien || idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-1.5 font-mono text-xs">{item.ien}</td>
                            <td className="px-4 py-1.5">{item.name}</td>
                            <td className="px-4 py-1.5 text-muted-foreground">
                              {item.stationNumber || item.abbreviation || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
