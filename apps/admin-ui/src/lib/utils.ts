import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function fmtDateShort(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function fmtFilemanDate(fmDate?: string | null): string {
  if (!fmDate) return '—';
  // VistA FileMan date: YYYMMDD where YYY = year - 1700
  const s = String(fmDate).replace(/\D/g, '');
  if (s.length < 7) return fmDate;
  const year = 1700 + parseInt(s.substring(0, 3), 10);
  const month = parseInt(s.substring(3, 5), 10) - 1;
  const day = parseInt(s.substring(5, 7), 10);
  try {
    return new Date(year, month, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return fmDate;
  }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function truncate(s: string, len = 60): string {
  return s.length > len ? s.slice(0, len) + '…' : s;
}

export function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (['active', 'healthy', 'verified', 'running', 'pass'].includes(s)) return 'text-green-700 bg-green-50 border-green-200';
  if (['inactive', 'disabled', 'retired', 'stopped'].includes(s)) return 'text-gray-600 bg-gray-50 border-gray-200';
  if (['warning', 'pending', 'draft', 'unverified'].includes(s)) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  if (['error', 'failed', 'suspended', 'danger', 'critical'].includes(s)) return 'text-red-700 bg-red-50 border-red-200';
  if (['info', 'processing', 'in-progress', 'running'].includes(s)) return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
}
