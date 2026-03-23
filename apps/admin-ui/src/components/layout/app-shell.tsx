'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/nav-items';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Menu as MenuIcon, X, ChevronRight, LogOut, Activity, ExternalLink, Bell, Shield,
  LayoutDashboard, Users, Key, Building2, Heart, Layers, FileText,
  AlertTriangle, CreditCard, HardDrive, Zap, Home, Globe, Server,
  BarChart3, Archive, Wrench, ShieldCheck, Settings, BookOpen,
  BedDouble, Stethoscope, GitBranch, Monitor, ListOrdered, Mail, ShieldAlert, Clock,
} from 'lucide-react';
import { logout, getSession, type LoginResult } from '@/lib/api';
import { LocaleSwitcher } from '@/components/shared/locale-switcher';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Users, Key, Building2, Heart, Layers, FileText,
  AlertTriangle, CreditCard, HardDrive, Zap, Home, Globe, Server,
  BarChart3, Archive, Wrench, ShieldCheck, Settings, BookOpen,
  BedDouble, Stethoscope, GitBranch, Monitor, ListOrdered, Mail, ShieldAlert, Clock,
  Activity, Bell, Shield,
};

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  variant: 'tenant' | 'operator';
  title: string;
}

export function AppShell({ children, navItems, variant, title }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<LoginResult['user'] | null>(null);

  useEffect(() => {
    getSession().then(setUser);
  }, []);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const groups: Record<string, NavItem[]> = {};
  for (const item of navItems) {
    const g = item.group || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }

  const sidebarBg = variant === 'tenant' ? 'bg-slate-900' : 'bg-[#1a2856]';
  const accentColor = variant === 'tenant' ? 'bg-blue-600' : 'bg-indigo-600';

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-60 flex-col transition-transform duration-200 lg:static lg:translate-x-0',
            sidebarBg,
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className={cn('flex h-14 items-center justify-between px-4', accentColor)}>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-white" />
              <div>
                <p className="text-xs font-bold text-white leading-tight">VistA Evolved</p>
                <p className="text-[10px] text-white/70 leading-tight">{title}</p>
              </div>
            </div>
            <Button
              variant="ghost" size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 pt-3 pb-1">
            {variant === 'tenant' ? (
              <Link
                href="/operator/dashboard"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Switch to Platform Operations
              </Link>
            ) : (
              <Link
                href="/tenant/dashboard"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Switch to Site Administration
              </Link>
            )}
          </div>

          <Separator className="mx-3 my-1 bg-white/10" />

          <ScrollArea className="flex-1 px-2 py-2">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group}
                </p>
                <nav className="space-y-0.5">
                  {items.map(item => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = ICONS[item.icon] || Activity;
                    return (
                      <Tooltip key={item.href} delayDuration={300}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                              active
                                ? 'bg-white/15 text-white font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-white/8'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                            {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
                          </Link>
                        </TooltipTrigger>
                        {item.description && (
                          <TooltipContent side="right" className="text-xs max-w-48">
                            {item.description}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </nav>
              </div>
            ))}
          </ScrollArea>

          <div className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                    {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 text-left truncate">
                    <p className="text-xs font-medium text-white truncate">{user?.name || 'Loading…'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.facility || ''}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">DUZ: {user?.duz || '—'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/tenant/system"><Activity className="mr-2 h-4 w-4" />System Status</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4 gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
              <Breadcrumb pathname={pathname} navItems={navItems} />
            </div>
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Breadcrumb({ pathname, navItems }: { pathname: string; navItems: NavItem[] }) {
  const current = navItems.find(n => pathname === n.href || pathname.startsWith(n.href + '/'));
  if (!current) return null;
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="hidden sm:inline">{current.group}</span>
      <ChevronRight className="h-4 w-4 hidden sm:inline" />
      <span className="font-medium text-foreground">{current.label}</span>
    </nav>
  );
}
