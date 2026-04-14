/**
 * Admin Service — Tenant Administration API calls
 *
 * Maps to the tenant-admin server (port 4520) which speaks
 * VistA XWB/DDR protocol to the real VistA backend.
 *
 * Proxy: /api/ta/v1/* → http://127.0.0.1:4520/api/tenant-admin/v1/*
 *
 * IMPORTANT: Every route below has been verified against the actual
 * routes registered in apps/tenant-admin/server.mjs.
 * Method (GET/POST/PUT/DELETE) must match the backend exactly.
 *
 * Spec references:
 *   docs/specs/2.-page-inventory-matrix-+-screen-contracts-v1.md
 *   docs/specs/48.-custom-wrapper-rpc-master-specification.md
 *   docs/specs/41.-wf-11_-admin-_-security-workspace.md
 */

import { tenantApi, setSessionToken } from './api';

// ────────────────────────────────────────────────
// S6.5: Reference data cache (5 min TTL) — divisions, keys catalog, services, titles, mail groups
// ────────────────────────────────────────────────

const _refDataCache = new Map();
const REF_DATA_TTL = 5 * 60 * 1000; // 5 minutes

function cachedGet(key, fetcher) {
  const cached = _refDataCache.get(key);
  if (cached && Date.now() - cached.ts < REF_DATA_TTL) return Promise.resolve(cached.data);
  return fetcher().then((data) => {
    _refDataCache.set(key, { data, ts: Date.now() });
    return data;
  });
}

export function clearRefDataCache() {
  _refDataCache.clear();
}

// ────────────────────────────────────────────────
// Auth (backend: XWB sign-on via XUS AV CODE)
// ────────────────────────────────────────────────

export async function login(username, password, tenantId = 'local-dev') {
  return tenantApi.post('/auth/login', { accessCode: username, verifyCode: password, tenantId });
}

export async function changeExpiredPassword(username, currentPassword, newPassword, tenantId = 'local-dev') {
  return tenantApi.post('/auth/change-expired-password', {
    accessCode: username,
    currentVerifyCode: currentPassword,
    newVerifyCode: newPassword,
    tenantId,
  });
}

export async function getSession() {
  return tenantApi.get('/auth/session');
}

export async function getPublicLoginConfig() {
  return tenantApi.get('/public/login-config');
}

export async function logout() {
  try {
    return await tenantApi.post('/auth/logout');
  } finally {
    setSessionToken(null);
  }
}

// ────────────────────────────────────────────────
// VistA Status
// ────────────────────────────────────────────────

export async function getVistaStatus() {
  return tenantApi.get('/vista-status');
}

export async function getHealthHistory() {
  return tenantApi.get('/health/history');
}

export async function getMyHealthThresholds() {
  return tenantApi.get('/health/thresholds/me');
}

export async function updateMyHealthThresholds(data) {
  return tenantApi.put('/health/thresholds/me', data);
}

// ────────────────────────────────────────────────
// Dashboard (backend: aggregated VistA data)
// ────────────────────────────────────────────────

export async function getDashboard() {
  return tenantApi.get('/dashboard');
}

// ────────────────────────────────────────────────
// Staff (backend: NEW PERSON #200)
// ────────────────────────────────────────────────

export async function getStaff(params = {}) {
  return tenantApi.get('/users', params);
}

export async function getStaffMember(duz) {
  return tenantApi.get(`/users/${duz}`);
}

export async function createStaffMember(data) {
  return tenantApi.post('/users', data);
}

/** S9.23: Check if an access code (username) is already taken */
export async function checkAccessCode(accessCode) {
  const res = await fetch('/api/ta/v1/users/check-access-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accessCode }),
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = null;
  }

  if (!res.ok && res.status !== 400) {
    throw new Error(json?.error || json?.message || text || `HTTP ${res.status}`);
  }

  if (!json || typeof json.available !== 'boolean') {
    throw new Error(json?.error || json?.message || 'Invalid access-code availability response');
  }

  return json;
}

export async function checkEmail(email, excludeDuz) {
  return tenantApi.post('/users/check-email', { email, excludeDuz });
}

export async function checkEmployeeId(employeeId, excludeDuz) {
  return tenantApi.post('/users/check-employee-id', { employeeId, excludeDuz });
}

/** Backend expects PUT, not PATCH */
export async function updateStaffMember(duz, data) {
  return tenantApi.put(`/users/${duz}`, data);
}

export async function renameStaffMember(duz, data) {
  return tenantApi.put(`/users/${duz}/rename`, data);
}

export async function deactivateStaffMember(duz, data) {
  return tenantApi.post(`/users/${duz}/deactivate`, data);
}

export async function reactivateStaffMember(duz) {
  return tenantApi.post(`/users/${duz}/reactivate`);
}

export async function assignDivision(duz, divisionIen, action = 'ADD') {
  return tenantApi.post(`/users/${duz}/division`, { divisionIen, action });
}

export async function updateUserSecondaryMenus(duz, menus) {
  return tenantApi.put(`/users/${duz}/secondary-menus`, { menus });
}

export async function unlockUser(duz) {
  return tenantApi.post(`/users/${duz}/unlock`);
}

export async function terminateStaffMember(duz) {
  return tenantApi.post(`/users/${duz}/terminate`);
}

export async function cloneStaffMember(data) {
  return tenantApi.post('/users/clone', data);
}

// ────────────────────────────────────────────────
// Staff Credentials (backend: XUS AV CODE)
// ────────────────────────────────────────────────

export async function updateCredentials(duz, data) {
  return tenantApi.put(`/users/${duz}/credentials`, data);
}

// ────────────────────────────────────────────────
// E-Signature (backend: NEW PERSON #200 e-sig fields)
// ────────────────────────────────────────────────

export async function getESignatureStatus(params = {}) {
  return tenantApi.get('/esig-status', params);
}

export async function setESignature(duz, data) {
  return tenantApi.post(`/users/${duz}/esig`, data);
}

// ────────────────────────────────────────────────
// Provider Setup (backend: NEW PERSON #200 provider fields)
// ────────────────────────────────────────────────

export async function setProviderFields(duz, data) {
  return tenantApi.post(`/users/${duz}/provider`, data);
}

// ────────────────────────────────────────────────
// Permissions / Security Keys (backend: SECURITY KEY #19.1)
// ────────────────────────────────────────────────

export async function _getPermissions(params = {}) {
  return tenantApi.get('/key-inventory', params);
}

export function getPermissions(params = {}) {
  const key = `permissions:${JSON.stringify(params ?? {})}`;
  return cachedGet(key, () => _getPermissions(params));
}

export async function getPermissionHolders(keyName) {
  return tenantApi.get(`/key-holders/${encodeURIComponent(keyName)}`);
}

export async function getUserPermissions(duz) {
  return tenantApi.get(`/users/${duz}/keys`);
}

export async function getUserMenuStructure(duz, params = {}) {
  return tenantApi.get(`/users/${duz}/menu-structure`, params);
}

export async function assignPermission(duz, keyData) {
  return tenantApi.post(`/users/${duz}/keys`, keyData);
}

export async function removePermission(duz, keyId) {
  const id = encodeURIComponent(String(keyId ?? '').trim());
  return tenantApi.delete(`/users/${duz}/keys/${id}`);
}

export async function analyzeKeyImpact(data) {
  return tenantApi.post('/key-impact', data);
}

// ────────────────────────────────────────────────
// Role Templates (backend: pre-defined role bundles)
// ────────────────────────────────────────────────

export async function getRoleTemplates() {
  return tenantApi.get('/roles');
}

// ────────────────────────────────────────────────
// Departments / Services (backend: SERVICE/SECTION #49)
// ────────────────────────────────────────────────

export async function _getDepartments(params = {}) {
  return tenantApi.get('/services', params);
}

export function getDepartments(params = {}) {
  const key = `departments:${JSON.stringify(params ?? {})}`;
  return cachedGet(key, () => _getDepartments(params));
}

export async function getDepartmentDetail(ien) {
  return tenantApi.get(`/services/${ien}`);
}

export async function createDepartment(data) {
  return tenantApi.post('/services', data);
}

export async function updateDepartment(ien, data) {
  return tenantApi.put(`/services/${ien}`, data);
}

export async function deleteDepartment(ien) {
  return tenantApi.delete(`/services/${ien}`);
}

// ────────────────────────────────────────────────
// Sites / Divisions (backend: INSTITUTION #4 + MEDICAL CENTER DIVISION #40.8)
// ────────────────────────────────────────────────

export async function _getSites() {
  return tenantApi.get('/divisions');
}

export function getSites() {
  return cachedGet('sites', () => _getSites());
}

export async function getSite(ien) {
  return tenantApi.get(`/divisions/${ien}`);
}

export async function getFacilities(params = {}) {
  return tenantApi.get('/facilities', params);
}

export async function getFacility(facilityId) {
  return tenantApi.get(`/facilities/${facilityId}`);
}

export async function getClinics(params = {}) {
  return tenantApi.get('/clinics', params);
}

export async function getWards(params = {}) {
  return tenantApi.get('/wards', params);
}

/** Ward inpatient census — ZVE ADT CENSUS (optional wardIen filter). */
export async function getWardCensus(wardIen, params = {}) {
  const q = { ...params };
  if (wardIen) q.wardIen = String(wardIen);
  return tenantApi.get('/census', q);
}

export async function getTopology() {
  return tenantApi.get('/topology');
}

// ────────────────────────────────────────────────
// Titles (backend: TITLE #3.1) — S3.13 pointer dropdown
// ────────────────────────────────────────────────

export async function _getTitles(params = {}) {
  return tenantApi.get('/titles', params);
}

export function getTitles(params = {}) {
  const key = `titles:${JSON.stringify(params ?? {})}`;
  return cachedGet(key, () => _getTitles(params));
}

export async function _getProviderClasses(params = {}) {
  return tenantApi.get('/provider-classes', params);
}

export function getProviderClasses(params = {}) {
  const key = `provider-classes:${JSON.stringify(params ?? {})}`;
  return cachedGet(key, () => _getProviderClasses(params));
}

// ────────────────────────────────────────────────
// Site Parameters (backend: KERNEL SYSTEM PARAMETERS #8989.3)
// Backend only exposes /params/kernel — no per-namespace CRUD
// ────────────────────────────────────────────────

export async function getSiteParameters() {
  return tenantApi.get('/params/kernel');
}

/** Backend expects PUT, not PATCH */
export async function updateSiteParameters(data) {
  return tenantApi.put('/params/kernel', data);
}

// ────────────────────────────────────────────────
// Audit Log (backend: multiple audit sources)
// No generic /audit — use specific audit endpoints:
//   /audit/fileman     — FileMan data audit trail
//   /audit/signon-log  — Sign-on/sign-off log
//   /audit/error-log   — Error trap entries
//   /audit/failed-access — Failed login attempts
//   /audit/programmer-mode — Programmer mode usage
// ────────────────────────────────────────────────

export async function getAuditFileMan(params = {}) {
  return tenantApi.get('/audit/fileman', params);
}

export async function getAuditSignonLog(params = {}) {
  return tenantApi.get('/audit/signon-log', params);
}

export async function getAuditErrorLog(params = {}) {
  return tenantApi.get('/audit/error-log', params);
}

export async function getAuditErrorLogEntry(ien) {
  return tenantApi.get(`/audit/error-log/${ien}`);
}

export async function getAuditFailedAccess(params = {}) {
  return tenantApi.get('/audit/failed-access', params);
}

export async function getAuditProgrammerMode(params = {}) {
  return tenantApi.get('/audit/programmer-mode', params);
}

export async function getUserFileAccess(duz) {
  return tenantApi.get(`/users/${duz}/file-access`);
}

export async function getUserAccessAudit(duz) {
  return tenantApi.get(`/users/${duz}/access-audit`);
}

// ────────────────────────────────────────────────
// Alerts & Notifications (backend: BULLETIN file via /bulletins)
// No /alerts endpoint — VistA stores alerts in BULLETIN file
// ────────────────────────────────────────────────

export async function getAlerts(params = {}) {
  return tenantApi.get('/bulletins', params);
}

export async function getAlert(ien) {
  return tenantApi.get(`/bulletins/${ien}`);
}

export async function updateAlert(ien, data) {
  return tenantApi.put(`/bulletins/${ien}`, data);
}

// ────────────────────────────────────────────────
// System Monitor — TaskMan (backend: TaskMan RPC calls)
// ────────────────────────────────────────────────

export async function getTaskManStatus() {
  return tenantApi.get('/taskman/status');
}

export async function startTaskMan() {
  return tenantApi.post('/taskman/start', {});
}

export async function getTaskManScheduled() {
  return tenantApi.get('/taskman/scheduled');
}

export async function getTaskManTask(ien) {
  return tenantApi.get(`/taskman-tasks/${ien}`);
}

export async function getTaskManTasks(params = {}) {
  return tenantApi.get('/taskman-tasks', params);
}

// ────────────────────────────────────────────────
// System Monitor — Error Trap (backend: ERROR TRAP file)
// ────────────────────────────────────────────────

export async function getErrorTrap(params = {}) {
  return tenantApi.get('/error-trap', params);
}

export async function purgeErrorTrapEntry(ien) {
  return tenantApi.delete(`/error-trap/${ien}`);
}

export async function purgeOldErrors(olderThanDays = 30) {
  return tenantApi.post('/error-trap/purge', { olderThanDays });
}

// ────────────────────────────────────────────────
// System Monitor — HL7 Interfaces
// ────────────────────────────────────────────────

export async function getHL7FilerStatus() {
  return tenantApi.get('/hl7/filer-status');
}

export async function getHL7Interfaces(params = {}) {
  return tenantApi.get('/hl7-interfaces', params);
}

export async function getHL7LinkStatus(ien) {
  return tenantApi.get(`/hl7/link-status/${ien}`);
}

export async function shutdownHL7Interface(ien) {
  return tenantApi.post(`/hl7-interfaces/${ien}/shutdown`);
}

export async function enableHL7Interface(ien) {
  return tenantApi.post(`/hl7-interfaces/${ien}/enable`);
}

// ────────────────────────────────────────────────
// System Reports (backend: per-domain report endpoints)
// No generic /reports — use domain-specific:
// ────────────────────────────────────────────────

export async function getSchedulingReport(params = {}) {
  return tenantApi.get('/reports/scheduling', params);
}

export async function getLabReport(params = {}) {
  return tenantApi.get('/reports/lab', params);
}

export async function getRadiologyReport(params = {}) {
  return tenantApi.get('/reports/radiology', params);
}

export async function getBillingReport(params = {}) {
  return tenantApi.get('/reports/billing', params);
}

export async function getNursingReport(params = {}) {
  return tenantApi.get('/reports/nursing', params);
}

// ────────────────────────────────────────────────
// Master Configuration
// Backend exposes /params/kernel for Kernel system parameters.
// ────────────────────────────────────────────────
// Capacity / System Info
// ────────────────────────────────────────────────

export async function getCapacity() {
  return tenantApi.get('/capacity');
}

// ────────────────────────────────────────────────
// DDR Probe (admin diagnostic)
// ────────────────────────────────────────────────

export async function ddrProbe(params = {}) {
  return tenantApi.get('/vista/ddr-probe', params);
}

// ────────────────────────────────────────────────
// Devices (backend: DEVICE file)
// ────────────────────────────────────────────────

export async function getDevices(params = {}) {
  return tenantApi.get('/devices', params);
}

// ────────────────────────────────────────────────
// Mail Groups (backend: MAIL GROUP file)
// ────────────────────────────────────────────────

export async function _getMailGroups(params = {}) {
  return tenantApi.get('/mail-groups', params);
}

export function getMailGroups(params = {}) {
  const key = `mailGroups:${JSON.stringify(params ?? {})}`;
  return cachedGet(key, () => _getMailGroups(params));
}

// ────────────────────────────────────────────────
// Packages (backend: PACKAGE file)
// ────────────────────────────────────────────────

export async function getPackages(params = {}) {
  return tenantApi.get('/packages', params);
}

// ────────────────────────────────────────────────
// Workspace Visibility per Division (backend: ^XTMP("ZVE-WKSP"))
// ────────────────────────────────────────────────

export async function getSiteWorkspaces(divisionIen) {
  const params = divisionIen ? { divisionIen } : {};
  return tenantApi.get('/workspaces', params);
}

export async function updateSiteWorkspace(divisionIen, workspace, enabled) {
  return tenantApi.put('/workspaces', { divisionIen, workspace, enabled });
}

// ────────────────────────────────────────────────
// Division CRUD (backend: File #40.8)
// ────────────────────────────────────────────────

export async function updateSite(ien, data) {
  return tenantApi.put(`/divisions/${ien}`, data);
}

export async function createSite(data) {
  return tenantApi.post('/divisions', data);
}

export async function deleteSite(ien) {
  return tenantApi.delete(`/divisions/${ien}`);
}

// ────────────────────────────────────────────────
// Package-specific Parameters (backend: per-package VistA files)
// ────────────────────────────────────────────────

export async function getPackageParams(packageId) {
  return tenantApi.get(`/params/${packageId}`);
}

export async function updatePackageParams(packageId, data) {
  return tenantApi.put(`/params/${packageId}`, data);
}

// ────────────────────────────────────────────────
// Custom Role Persistence (backend: ^XTMP("ZVE-ROLES"))
// ────────────────────────────────────────────────

export async function getCustomRoles() {
  return tenantApi.get('/roles/custom');
}

export async function createCustomRole(data) {
  return tenantApi.post('/roles/custom', data);
}

export async function updateCustomRole(roleId, data) {
  return tenantApi.put(`/roles/custom/${roleId}`, data);
}

export async function deleteCustomRole(roleId) {
  return tenantApi.delete(`/roles/custom/${roleId}`);
}

// ────────────────────────────────────────────────
// E-Signature SET (backend: ZVE ESIG MANAGE with SET action)
// ────────────────────────────────────────────────

export async function setESignatureCode(duz, data) {
  return tenantApi.post(`/users/${duz}/esig/set`, data);
}

// ────────────────────────────────────────────────
// System Reports (aggregation endpoints)
// ────────────────────────────────────────────────

export async function getAdminReport(reportType, params = {}) {
  return tenantApi.get(`/reports/admin/${reportType}`, params);
}

export async function getAdminReportSchedules() {
  return tenantApi.get('/reports/admin/schedules');
}

export async function createAdminReportSchedule(data) {
  return tenantApi.post('/reports/admin/schedules', data);
}

export async function runAdminReportScheduleNow(scheduleId) {
  return tenantApi.post(`/reports/admin/schedules/${scheduleId}/run-now`);
}

export async function deleteAdminReportSchedule(scheduleId) {
  return tenantApi.delete(`/reports/admin/schedules/${scheduleId}`);
}

// ────────────────────────────────────────────────
// MailMan Inbox (backend: ^XMB(3.7) / ^XMB(3.9))
// ────────────────────────────────────────────────

export async function getMailManInbox(folder = 'IN', max = 50) {
  return tenantApi.get('/mailman/inbox', { folder, max });
}

export async function getMailManBaskets() {
  return tenantApi.get('/mailman/baskets');
}

export async function getMailManMessage(ien) {
  return tenantApi.get(`/mailman/message/${ien}`);
}

export async function sendMailManMessage(to, subject, body) {
  return tenantApi.post('/mailman/send', { to, subject, body });
}

export async function deleteMailManMessage(ien) {
  return tenantApi.delete(`/mailman/message/${ien}`);
}

// ────────────────────────────────────────────────
// Two-Person Integrity (backend: ^XTMP("ZVE2P"))
// ────────────────────────────────────────────────

export async function submit2PChange(data) {
  return tenantApi.post('/config/2p', data);
}

export async function get2PRequests(status = 'PENDING') {
  return tenantApi.get('/config/2p', { status });
}

export async function approve2PRequest(id) {
  return tenantApi.post(`/config/2p/${id}/approve`);
}

export async function reject2PRequest(id) {
  return tenantApi.post(`/config/2p/${id}/reject`);
}

// ────────────────────────────────────────────────
// Alert Creation (backend: XQALERT API)
// ────────────────────────────────────────────────

export async function createAlert(data) {
  return tenantApi.post('/alerts', data);
}

// ────────────────────────────────────────────────
// Clinics (backend: HOSPITAL LOCATION #44)
// ────────────────────────────────────────────────

export async function getClinicDetail(ien) {
  return tenantApi.get(`/clinics/${ien}`);
}

export async function createClinic(data) {
  return tenantApi.post('/clinics', data);
}

export async function updateClinicField(ien, field, value) {
  return tenantApi.put(`/clinics/${ien}/fields`, { field, value });
}

export async function inactivateClinic(ien) {
  return tenantApi.post(`/clinics/${ien}/inactivate`);
}

export async function reactivateClinic(ien) {
  return tenantApi.post(`/clinics/${ien}/reactivate`);
}

export async function getClinicAvailability(ien) {
  return tenantApi.get(`/clinics/${ien}/availability`);
}

export async function setClinicAvailability(ien, data) {
  return tenantApi.post(`/clinics/${ien}/availability`, data);
}

export async function getStopCodes() {
  return tenantApi.get('/stop-codes');
}

// ────────────────────────────────────────────────
// Wards (backend: WARD LOCATION #42)
// ────────────────────────────────────────────────

export async function getWardDetail(ien) {
  return tenantApi.get(`/wards/${ien}`);
}

export async function createWard(data) {
  return tenantApi.post('/wards', data);
}

export async function updateWardField(ien, field, value) {
  return tenantApi.put(`/wards/${ien}/fields`, { [field]: value });
}

export async function getRoomBeds(params = {}) {
  return tenantApi.get('/room-beds', params);
}

// ────────────────────────────────────────────────
// Devices (backend: DEVICE #3.5)
// ────────────────────────────────────────────────

export async function getDeviceDetail(ien) {
  return tenantApi.get(`/devices/${ien}`);
}

export async function createDevice(data) {
  return tenantApi.post('/devices', data);
}

export async function updateDeviceField(ien, field, value) {
  return tenantApi.put(`/devices/${ien}/fields`, { field, value });
}

export async function deleteDevice(ien) {
  return tenantApi.delete(`/devices/${ien}`);
}

export async function testPrintDevice(ien) {
  return tenantApi.post(`/devices/${ien}/test-print`);
}

// ────────────────────────────────────────────────
// Mail Groups (backend: MAIL GROUP #3.8)
// ────────────────────────────────────────────────

export async function getMailGroupDetail(ien) {
  return tenantApi.get(`/mail-groups/${ien}`);
}

export async function createMailGroup(data) {
  return tenantApi.post('/mail-groups', data);
}

export async function updateMailGroup(ien, data) {
  return tenantApi.put(`/mail-groups/${ien}`, data);
}

export async function getMailGroupMembers(ien) {
  return tenantApi.get(`/mail-groups/${ien}/members`);
}

export async function addMailGroupMember(ien, userDuz) {
  return tenantApi.post(`/mail-groups/${ien}/members`, { userDuz });
}

export async function removeMailGroupMember(ien, duz) {
  return tenantApi.delete(`/mail-groups/${ien}/members/${duz}`);
}

// Legacy alias: this route currently reads File 200.03 secondary menu options.
export async function getCprsTabAccess(duz) {
  return tenantApi.get(`/users/${duz}/cprs-tabs`);
}
