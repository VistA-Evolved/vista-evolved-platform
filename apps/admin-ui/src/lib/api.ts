/**
 * API client for both tenant-admin (VistA) and operator (control-plane) backends.
 * All calls use session token from localStorage.
 * Returns real VistA data or throws — no silent mocks.
 *
 * Proxy rewrites (next.config.ts):
 *   /api/ta/v1/*  → http://127.0.0.1:4520/api/tenant-admin/v1/*
 *   /api/op/v1/*  → http://127.0.0.1:4510/api/control-plane/v1/*
 */

const TENANT_BASE = '/api/ta/v1';
const OPERATOR_BASE = '/api/op/v1';

// The tenant-admin API requires a tenantId on login.
// In single-tenant deployments this is always 'default-tenant'.
// Multi-tenant: set via NEXT_PUBLIC_TENANT_ID env var.
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'default-tenant';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ve-admin-token');
}

export function getHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function withTenantId(url: string): string {
  // Append tenantId to tenant-admin API calls (/api/ta/*).
  // The server requires ?tenantId on every request beyond auth.
  if (!url.startsWith('/api/ta/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tenantId=${encodeURIComponent(TENANT_ID)}`;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const finalUrl = withTenantId(url);
  const res = await fetch(finalUrl, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ve-admin-token');
      const already = window.location.pathname.startsWith('/login');
      if (!already) {
        window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname);
      }
    }
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data as T;
}

// ============================================================================
// Auth
// ============================================================================

export interface LoginResult {
  ok: boolean;
  token?: string;
  user?: {
    duz: string;
    name: string;
    facility: string;
    division?: string;
    accessLevel?: string;
  };
  error?: string;
}

export async function login(accessCode: string, verifyCode: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${TENANT_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, verifyCode, tenantId: TENANT_ID }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('ve-admin-token', data.token);
    }
    return data;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${TENANT_BASE}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } finally {
    localStorage.removeItem('ve-admin-token');
  }
}

export async function getSession(): Promise<LoginResult['user'] | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(withTenantId(`${TENANT_BASE}/auth/session`), {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? (data.user || null) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Tenant Admin — Users
// ============================================================================

export interface VistaUser {
  ien: string;
  name: string;
  accessCode?: string;
  title?: string;
  service?: string;
  npi?: string;
  active: boolean;
  securityKeys?: string[];
  division?: string;
  phone?: string;
}

export async function listUsers(search?: string): Promise<{ data: VistaUser[]; total: number }> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`${TENANT_BASE}/users${q}`);
}

export async function getUser(ien: string): Promise<{ data: VistaUser }> {
  return apiFetch(`${TENANT_BASE}/users/${encodeURIComponent(ien)}`);
}

export async function updateUser(ien: string, fields: Partial<VistaUser>): Promise<{ ok: boolean }> {
  return apiFetch(`${TENANT_BASE}/users/${encodeURIComponent(ien)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export async function assignSecurityKey(duz: string, keyName: string): Promise<{ ok: boolean }> {
  return apiFetch(`${TENANT_BASE}/users/${encodeURIComponent(duz)}/keys`, {
    method: 'POST',
    body: JSON.stringify({ keyName }),
  });
}

export async function removeSecurityKey(duz: string, keyId: string): Promise<{ ok: boolean }> {
  return apiFetch(`${TENANT_BASE}/users/${encodeURIComponent(duz)}/keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Tenant Admin — Facilities & Clinics
// ============================================================================

export interface VistaFacility {
  ien: string;
  name: string;
  stationNumber?: string;
  type?: string;
}

export interface VistaClinic {
  ien: string;
  name: string;
  facility?: string;
  provider?: string;
  stopCode?: string;
  active?: boolean;
}

export async function listFacilities(): Promise<{ data: VistaFacility[] }> {
  return apiFetch(`${TENANT_BASE}/facilities`);
}

export async function listClinics(search?: string): Promise<{ data: VistaClinic[] }> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`${TENANT_BASE}/clinics${q}`);
}

export async function createClinic(clinic: Partial<VistaClinic>): Promise<{ ok: boolean; ien?: string }> {
  return apiFetch(`${TENANT_BASE}/clinics`, {
    method: 'POST',
    body: JSON.stringify(clinic),
  });
}

// ============================================================================
// Tenant Admin — Wards
// ============================================================================

export interface VistaWard {
  ien: string;
  name: string;
  service?: string;
  authorized?: number;
  occupied?: number;
}

export async function listWards(): Promise<{ data: VistaWard[] }> {
  return apiFetch(`${TENANT_BASE}/wards`);
}

// ============================================================================
// Tenant Admin — Security Keys
// ============================================================================

export interface SecurityKey {
  ien: string;
  name: string;
  description?: string;
}

export async function listSecurityKeys(): Promise<{ data: SecurityKey[] }> {
  // Server exposes security keys at /roles (File 19.1 — Security Key file)
  return apiFetch(`${TENANT_BASE}/roles`);
}

export async function listKeyInventory(): Promise<{ data: SecurityKey[] }> {
  return apiFetch(`${TENANT_BASE}/key-inventory`);
}

// ============================================================================
// Tenant Admin — Devices
// ============================================================================

export interface VistaDevice {
  ien: string;
  name: string;
  type?: string;
  location?: string;
  subtype?: string;
}

export async function listDevices(): Promise<{ data: VistaDevice[] }> {
  return apiFetch(`${TENANT_BASE}/devices`);
}

// ============================================================================
// Tenant Admin — System
// ============================================================================

export async function getDashboard(): Promise<{ ok: boolean; source: string; data: Record<string, unknown> }> {
  return apiFetch(`${TENANT_BASE}/dashboard`);
}

export async function getSystemStatus(): Promise<{ ok: boolean; source: string; data: Record<string, unknown> }> {
  return apiFetch(`${TENANT_BASE}/params/kernel`);
}

export async function getVistaStatus(): Promise<{ ok: boolean; source?: string; data?: Record<string, unknown> }> {
  return apiFetch(`${TENANT_BASE}/vista-status`);
}

// ============================================================================
// Operator — Tenants
// ============================================================================

export interface Tenant {
  tenantId: string;
  displayName: string;
  status: string;
  legalMarketId?: string;
  launchTier?: string;
  createdAt?: string;
  activePacks?: string[];
}

export async function listTenants(): Promise<{ items: Tenant[]; pagination: { totalItems: number } }> {
  const data = await apiFetch<{ items: Tenant[]; pagination: { totalItems: number }; _source: string }>(`${OPERATOR_BASE}/tenants`);
  return data;
}

export async function getBillingStatus(): Promise<{ billing: { configured: boolean; provider: string; model: string } }> {
  return apiFetch(`${OPERATOR_BASE}/billing/status`);
}

// ============================================================================
// Tenant Admin — Interoperability
// ============================================================================

export interface HL7Interface {
  ien: string;
  name: string;
  type?: string;
  active?: boolean;
  domain?: string;
  facility?: string;
}

export async function listHL7Interfaces(): Promise<{ data: HL7Interface[] }> {
  return apiFetch(`${TENANT_BASE}/hl7-interfaces`);
}

// ============================================================================
// Tenant Admin — Clinical Configuration
// ============================================================================

export interface DrugEntry {
  ien: string;
  name: string;
  ndc?: string;
  va_class?: string;
  inactive?: boolean;
}

export interface LabTest {
  ien: string;
  name: string;
  type?: string;
  subscript?: string;
}

export interface TiuDocumentDef {
  ien: string;
  name: string;
  type?: string;
  status?: string;
}

export interface RadiologyProcedure {
  ien: string;
  name: string;
  type?: string;
  cpt?: string;
}

export interface AppointmentType {
  ien: string;
  name: string;
  code?: string;
  inactive?: boolean;
}

export interface HealthSummaryType {
  ien: string;
  name: string;
}

export interface Title {
  ien: string;
  name: string;
}

export async function listDrugs(): Promise<{ data: DrugEntry[] }> {
  return apiFetch(`${TENANT_BASE}/drug-file`);
}

export async function listLabTests(): Promise<{ data: LabTest[] }> {
  return apiFetch(`${TENANT_BASE}/lab-tests`);
}

export async function listTiuDocumentDefs(): Promise<{ data: TiuDocumentDef[] }> {
  return apiFetch(`${TENANT_BASE}/tiu-document-defs`);
}

export async function listRadiologyProcedures(): Promise<{ data: RadiologyProcedure[] }> {
  return apiFetch(`${TENANT_BASE}/radiology-procedures`);
}

export async function listAppointmentTypes(): Promise<{ data: AppointmentType[] }> {
  return apiFetch(`${TENANT_BASE}/appointment-types`);
}

export async function listHealthSummaryTypes(): Promise<{ data: HealthSummaryType[] }> {
  return apiFetch(`${TENANT_BASE}/health-summary-types`);
}

export async function listTitles(): Promise<{ data: Title[] }> {
  return apiFetch(`${TENANT_BASE}/titles`);
}

// ============================================================================
// Tenant Admin — Kernel & System
// ============================================================================

export interface VistAPackage {
  ien: string;
  name: string;
  version?: string;
  prefix?: string;
  developer?: string;
}

export interface TaskManTask {
  ien: string;
  name: string;
  routine?: string;
  rescheduling?: string;
  status?: string;
}

export interface TerminalType {
  ien: string;
  name: string;
  form_feed?: string;
  right_margin?: number;
}

export interface MenuOption {
  ien: string;
  name: string;
  type?: string;
  description?: string;
}

export interface ErrorTrapEntry {
  ien: string;
  error?: string;
  routine?: string;
  date?: string;
}

export async function listPackages(): Promise<{ data: VistAPackage[] }> {
  return apiFetch(`${TENANT_BASE}/packages`);
}

export async function listTaskManTasks(): Promise<{ data: TaskManTask[] }> {
  return apiFetch(`${TENANT_BASE}/taskman-tasks`);
}

export async function listTerminalTypes(): Promise<{ data: TerminalType[] }> {
  return apiFetch(`${TENANT_BASE}/terminal-types`);
}

export async function listMenuOptions(): Promise<{ data: MenuOption[] }> {
  return apiFetch(`${TENANT_BASE}/menu-options`);
}

export async function listErrorTrap(): Promise<{ data: ErrorTrapEntry[] }> {
  return apiFetch(`${TENANT_BASE}/error-trap`);
}

// ============================================================================
// Tenant Admin — Locations & Topology
// ============================================================================

export interface VistADivision {
  ien: string;
  name: string;
  station?: string;
  facility?: string;
}

export interface TreatingSpecialty {
  ien: string;
  name: string;
  service?: string;
}

export interface RoomBed {
  ien: string;
  name: string;
  room?: string;
  ward?: string;
  status?: string;
}

export async function listDivisions(): Promise<{ data: VistADivision[] }> {
  return apiFetch(`${TENANT_BASE}/divisions`);
}

export async function listTreatingSpecialties(): Promise<{ data: TreatingSpecialty[] }> {
  return apiFetch(`${TENANT_BASE}/treating-specialties`);
}

export async function listRoomBeds(): Promise<{ data: RoomBed[] }> {
  return apiFetch(`${TENANT_BASE}/room-beds`);
}

export async function getSiteTopology(): Promise<{ data: unknown }> {
  return apiFetch(`${TENANT_BASE}/topology`);
}

// ============================================================================
// Tenant Admin — Communications & Billing
// ============================================================================

export interface MailGroup {
  ien: string;
  name: string;
  description?: string;
  members?: number;
}

export interface InsuranceCompany {
  ien: string;
  name: string;
  city?: string;
  state?: string;
  phone?: string;
}

export async function listMailGroups(): Promise<{ data: MailGroup[] }> {
  return apiFetch(`${TENANT_BASE}/mail-groups`);
}

export async function listInsuranceCompanies(): Promise<{ data: InsuranceCompany[] }> {
  return apiFetch(`${TENANT_BASE}/insurance-companies`);
}

// ============================================================================
// Tenant Admin — Users (extended)
// ============================================================================

export interface EsigStatus {
  ien: string;
  name: string;
  hasEsig?: boolean;
  esigDate?: string;
  providerStatus?: string;
}

export async function listEsigStatus(): Promise<{ data: EsigStatus[] }> {
  return apiFetch(`${TENANT_BASE}/esig-status`);
}

export async function getFileManAudit(search?: string): Promise<{ data: unknown[]; total?: number }> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`${TENANT_BASE}/audit/fileman${q}`);
}
