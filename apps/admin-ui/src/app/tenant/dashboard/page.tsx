'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { VistaSourceBadge } from '@/components/shared/vista-source-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboard } from '@/lib/api';
import {
  Activity, Users, Building2, HardDrive, CheckCircle2, AlertCircle,
  Heart, Zap, Key, Shield, Wifi, WifiOff
} from 'lucide-react';

interface DashData {
  userCount?: number;
  activeUserCount?: number;
  facilityCount?: number;
  clinicCount?: number;
  wardCount?: number;
  bedCount?: number;
  roleCount?: number;
  esigActiveCount?: number;
  deviceCount?: number;
  terminalTypeCount?: number;
  hl7InterfaceCount?: number;
  vistaGrounding?: string;
  vistaUrl?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  colorClass: string;
  href?: string;
}

function StatCard({ label, value, sub, icon: Icon, colorClass, href }: StatCardProps) {
  const inner = (
    <Card className={`p-5 flex items-start gap-4 transition-shadow ${href ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className={`rounded-xl p-3 shrink-0 ${colorClass}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [dash, setDash] = useState<DashData | null>(null);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(r => { setDash(r.data as DashData); setSource(r.source); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const connected = dash?.vistaGrounding === 'connected';

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Site Dashboard"
        description={connected ? `Connected to VistA · ${dash?.vistaUrl || ''}` : 'VistA system status'}
        badge={<VistaSourceBadge source={source || (loading ? undefined : 'pending')} />}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* VistA connection banner */}
      {!loading && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {connected
            ? <><CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /><span className="text-sm font-medium text-green-800">VistA Connected — {dash?.vistaUrl}</span></>
            : <><WifiOff className="h-5 w-5 text-red-600 shrink-0" /><span className="text-sm font-medium text-red-800">VistA Unreachable</span></>
          }
          {connected && (
            <Badge variant="success" className="ml-auto">Live</Badge>
          )}
        </div>
      )}
      {loading && <Skeleton className="h-14 rounded-xl" />}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Users" value={dash?.userCount ?? 0} sub={`${dash?.activeUserCount ?? 0} active`} icon={Users} colorClass="bg-blue-600" href="/tenant/users" />
            <StatCard label="Security Keys" value={dash?.roleCount ?? 0} sub="File 19.1" icon={Key} colorClass="bg-indigo-600" href="/tenant/security-keys" />
            <StatCard label="Facilities" value={dash?.facilityCount ?? 0} sub="File 4" icon={Building2} colorClass="bg-amber-600" href="/tenant/facilities" />
            <StatCard label="Clinics" value={dash?.clinicCount ?? 0} sub="File 44" icon={Heart} colorClass="bg-rose-600" href="/tenant/clinics" />
            <StatCard label="Wards / Beds" value={`${dash?.wardCount ?? 0} / ${dash?.bedCount ?? 0}`} sub="File 42" icon={Shield} colorClass="bg-teal-600" href="/tenant/wards" />
            <StatCard label="Devices" value={dash?.deviceCount ?? 0} sub={`${dash?.terminalTypeCount ?? 0} terminal types`} icon={HardDrive} colorClass="bg-slate-600" href="/tenant/devices" />
            <StatCard label="HL7 Interfaces" value={dash?.hl7InterfaceCount ?? 0} sub="Active interfaces" icon={Zap} colorClass="bg-purple-600" href="/tenant/hl7" />
            <StatCard label="E-Sig Active" value={dash?.esigActiveCount ?? 0} sub="Electronic signatures" icon={Activity} colorClass="bg-cyan-600" href="/tenant/users" />
          </>
        )}
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: '/tenant/users', label: 'Manage Users', desc: 'Add, edit, assign security keys', icon: Users, color: 'text-blue-600 bg-blue-50' },
          { href: '/tenant/facilities', label: 'Facilities & Clinics', desc: 'Configure locations and clinic schedule templates', icon: Building2, color: 'text-amber-600 bg-amber-50' },
          { href: '/tenant/security-keys', label: 'Security Keys', desc: 'Review and manage access control keys', icon: Key, color: 'text-indigo-600 bg-indigo-50' },
          { href: '/tenant/devices', label: 'Devices & Printers', desc: 'Terminal types and HL7 interfaces', icon: HardDrive, color: 'text-slate-600 bg-slate-50' },
          { href: '/tenant/system', label: 'System Status', desc: 'Kernel parameters, TaskMan, error processing', icon: Activity, color: 'text-green-600 bg-green-50' },
          { href: '/tenant/hl7', label: 'HL7 Interfaces', desc: 'Monitor active HL7 connections', icon: Wifi, color: 'text-purple-600 bg-purple-50' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-4 rounded-xl border p-4 hover:shadow-md hover:border-border/80 transition-all"
            >
              <div className={`rounded-xl p-3 shrink-0 ${item.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
