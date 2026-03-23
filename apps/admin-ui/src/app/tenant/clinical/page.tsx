'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { DataTable, Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listDrugs, listLabTests, listTiuDocumentDefs, listRadiologyProcedures,
  listAppointmentTypes, listHealthSummaryTypes, listTitles,
  DrugEntry, LabTest, TiuDocumentDef, RadiologyProcedure,
  AppointmentType, HealthSummaryType, Title
} from '@/lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

type TabKey = 'drugs' | 'labs' | 'tiu' | 'radiology' | 'apptypes' | 'healthsummary' | 'titles';

interface TabDef {
  key: TabKey;
  label: string;
  vistaFile: string;
  description: string;
}

const TABS: TabDef[] = [
  { key: 'drugs', label: 'Drug File', vistaFile: '50', description: 'Drug formulary — VistA File 50' },
  { key: 'labs', label: 'Lab Tests', vistaFile: '60', description: 'Laboratory tests — VistA File 60' },
  { key: 'tiu', label: 'TIU Definitions', vistaFile: '8925.1', description: 'TIU Document Definitions — VistA File 8925.1' },
  { key: 'radiology', label: 'Radiology', vistaFile: '71', description: 'Radiology procedures — VistA File 71' },
  { key: 'apptypes', label: 'Appointment Types', vistaFile: '409.1', description: 'Appointment types — VistA File 409.1' },
  { key: 'healthsummary', label: 'Health Summary Types', vistaFile: '142', description: 'Health Summary types — VistA File 142' },
  { key: 'titles', label: 'Titles', vistaFile: '3.1', description: 'User titles — VistA File 3.1' },
];

export default function ClinicalConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('drugs');
  const [data, setData] = useState<Record<TabKey, unknown[]>>({
    drugs: [], labs: [], tiu: [], radiology: [], apptypes: [], healthsummary: [], titles: [],
  });
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    drugs: false, labs: false, tiu: false, radiology: false, apptypes: false, healthsummary: false, titles: false,
  });
  const [errors, setErrors] = useState<Record<TabKey, string | null>>({
    drugs: null, labs: null, tiu: null, radiology: null, apptypes: null, healthsummary: null, titles: null,
  });
  const [loaded, setLoaded] = useState<Set<TabKey>>(new Set());

  const loaders: Record<TabKey, () => Promise<{ data: unknown[] }>> = useMemo(() => ({
    drugs: listDrugs as () => Promise<{ data: unknown[] }>,
    labs: listLabTests as () => Promise<{ data: unknown[] }>,
    tiu: listTiuDocumentDefs as () => Promise<{ data: unknown[] }>,
    radiology: listRadiologyProcedures as () => Promise<{ data: unknown[] }>,
    apptypes: listAppointmentTypes as () => Promise<{ data: unknown[] }>,
    healthsummary: listHealthSummaryTypes as () => Promise<{ data: unknown[] }>,
    titles: listTitles as () => Promise<{ data: unknown[] }>,
  }), []);

  function loadTab(tab: TabKey) {
    setLoading(l => ({ ...l, [tab]: true }));
    setErrors(e => ({ ...e, [tab]: null }));
    loaders[tab]()
      .then(r => {
        setData(d => ({ ...d, [tab]: r.data || [] }));
        setLoaded(s => new Set(s).add(tab));
      })
      .catch(e => setErrors(err => ({ ...err, [tab]: String(e) })))
      .finally(() => setLoading(l => ({ ...l, [tab]: false })));
  }

  useEffect(() => {
    if (!loaded.has(activeTab)) loadTab(activeTab);
  }, [activeTab]);

  const drugCols: Column<DrugEntry>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Drug Name', sortable: true },
    { key: 'va_class', label: 'VA Class', sortable: true },
    { key: 'ndc', label: 'NDC', className: 'font-mono text-xs' },
    {
      key: 'inactive', label: 'Status',
      render: (r) => r.inactive ? <Badge variant="muted">Inactive</Badge> : <Badge variant="success">Active</Badge>,
    },
  ], []);

  const labCols: Column<LabTest>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Test Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'subscript', label: 'Subscript' },
  ], []);

  const tiuCols: Column<TiuDocumentDef>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Document Definition', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status' },
  ], []);

  const radCols: Column<RadiologyProcedure>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Procedure', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'cpt', label: 'CPT', className: 'font-mono text-xs' },
  ], []);

  const aptCols: Column<AppointmentType>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Appointment Type', sortable: true },
    { key: 'code', label: 'Code' },
    {
      key: 'inactive', label: 'Status',
      render: (r) => r.inactive ? <Badge variant="muted">Inactive</Badge> : <Badge variant="success">Active</Badge>,
    },
  ], []);

  const hsCols: Column<HealthSummaryType>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Health Summary Type', sortable: true },
  ], []);

  const titleCols: Column<Title>[] = useMemo(() => [
    { key: 'ien', label: 'ID', className: 'w-20 font-mono text-xs text-muted-foreground', sortable: true },
    { key: 'name', label: 'Title', sortable: true },
  ], []);

  const colMap: Record<TabKey, Column<never>[]> = {
    drugs: drugCols as Column<never>[],
    labs: labCols as Column<never>[],
    tiu: tiuCols as Column<never>[],
    radiology: radCols as Column<never>[],
    apptypes: aptCols as Column<never>[],
    healthsummary: hsCols as Column<never>[],
    titles: titleCols as Column<never>[],
  };

  const activeDef = TABS.find(t => t.key === activeTab)!;
  const activeData = data[activeTab] as never[];
  const activeLoading = loading[activeTab];
  const activeError = errors[activeTab];

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Clinical Configuration"
        description="Drug formulary, lab tests, TIU document definitions, radiology, and appointment types from VistA"
        badge={<VistaSourceBadge source={loaded.has(activeTab) ? 'vista' : (activeLoading ? undefined : 'pending')} />}
        actions={
          <Button variant="outline" size="sm" onClick={() => loadTab(activeTab)} disabled={activeLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${activeLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
            {loaded.has(tab.key) && data[tab.key].length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {data[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{activeDef.description}</p>

      {activeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{activeError}
        </div>
      )}

      <DataTable
        data={activeData}
        columns={colMap[activeTab]}
        loading={activeLoading}
        searchFields={['name']}
        searchPlaceholder={`Search ${activeDef.label.toLowerCase()}…`}
        pageSize={25}
      />
    </div>
  );
}
