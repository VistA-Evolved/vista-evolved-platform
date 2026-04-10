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
// Auth (backend: XWB sign-on via XUS AV CODE)
// ────────────────────────────────────────────────

export async function login(username, password, tenantId = 'local-dev') {
  const result = await tenantApi.post('/auth/login', { accessCode: username, verifyCode: password, tenantId });
  if (result.ok && result.token) {
    setSessionToken(result.token);
  }
  return result;
}

export async function getSession() {
  return tenantApi.get('/auth/session');
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

export async function getPermissions(params = {}) {
  return tenantApi.get('/key-inventory', params);
}

export async function getPermissionHolders(keyName) {
  return tenantApi.get(`/key-holders/${encodeURIComponent(keyName)}`);
}

export async function getUserPermissions(duz) {
  return tenantApi.get(`/users/${duz}/keys`);
}

export async function assignPermission(duz, keyData) {
  return tenantApi.post(`/users/${duz}/keys`, keyData);
}

export async function removePermission(duz, keyId) {
  return tenantApi.delete(`/users/${duz}/keys/${keyId}`);
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

export async function getDepartments(params = {}) {
  return tenantApi.get('/services', params);
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

// ────────────────────────────────────────────────
// Sites / Divisions (backend: INSTITUTION #4 + MEDICAL CENTER DIVISION #40.8)
// ────────────────────────────────────────────────

export async function getSites() {
  return tenantApi.get('/divisions');
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

export async function getTopology() {
  return tenantApi.get('/topology');
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

export async function getMailGroups(params = {}) {
  return tenantApi.get('/mail-groups', params);
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

// ────────────────────────────────────────────────
// MailMan Inbox (backend: ^XMB(3.7) / ^XMB(3.9))
// ────────────────────────────────────────────────

export async function getMailManInbox(folder = 'IN', max = 50) {
  return tenantApi.get('/mailman/inbox', { folder, max });
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
