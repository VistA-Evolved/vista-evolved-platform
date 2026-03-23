export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group?: string;
  badge?: string;
  description?: string;
}

/**
 * Tenant nav — mirrors the VistA SITE ADMINISTRATION terminal menu structure.
 *
 * VistA Terminal hierarchy:
 *   EVE (System Manager's Menu)
 *     → Kernel Management Menu
 *         → Package file, TaskMan, Error Processing, Terminal Types, Menu Options
 *     → User Management
 *         → Users, Security Keys, E-Signature
 *     → Site Parameters
 *         → Facilities, Clinics, Wards, Divisions, Treating Specialties, Room-Beds
 *     → Device Management
 *         → Devices, Terminal Types
 *     → Clinical Coordinator
 *         → Drug File, Lab Tests, TIU Definitions, Radiology, Appointment Types
 *     → HL7 / Interoperability
 *         → HL7 Interfaces, Site Topology
 *     → Communications (MailMan)
 *         → Mail Groups, Bulletins
 *     → Billing/Finance
 *         → Insurance Companies, Billing Parameters
 *     → Audit
 *         → FileMan Audit, E-Sig Status
 */
export const tenantNavItems: NavItem[] = [
  // ── Overview ─────────────────────────────────────────────────────────────
  { href: '/tenant/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'Overview' },

  // ── Users & Access ────────────────────────────────────────────────────────
  { href: '/tenant/users', label: 'Users', icon: 'Users', group: 'Users & Access', description: 'VistA New Person File 200' },
  { href: '/tenant/security-keys', label: 'Security Keys', icon: 'Key', group: 'Users & Access', description: 'VistA Security Key File 19.1' },
  { href: '/tenant/esig', label: 'E-Signature Status', icon: 'ShieldCheck', group: 'Users & Access', description: 'Electronic signature status per user' },

  // ── Locations ─────────────────────────────────────────────────────────────
  { href: '/tenant/facilities', label: 'Facilities', icon: 'Building2', group: 'Locations', description: 'Institution File 4' },
  { href: '/tenant/divisions', label: 'Divisions', icon: 'GitBranch', group: 'Locations', description: 'Medical Center Division File 40.8' },
  { href: '/tenant/clinics', label: 'Clinics', icon: 'Heart', group: 'Locations', description: 'Hospital Location File 44' },
  { href: '/tenant/wards', label: 'Wards', icon: 'Layers', group: 'Locations', description: 'Ward Location File 42' },
  { href: '/tenant/room-beds', label: 'Rooms & Beds', icon: 'BedDouble', group: 'Locations', description: 'Room-Bed File 405.4' },
  { href: '/tenant/treating-specialties', label: 'Treating Specialties', icon: 'Stethoscope', group: 'Locations', description: 'Treating Specialty File 45.7' },

  // ── Clinical Configuration ────────────────────────────────────────────────
  { href: '/tenant/clinical', label: 'Clinical Config', icon: 'FileText', group: 'Clinical', description: 'Drug formulary, Lab, TIU, Radiology, Appt Types' },

  // ── System / Kernel ────────────────────────────────────────────────────────
  { href: '/tenant/devices', label: 'Devices', icon: 'HardDrive', group: 'Kernel & System', description: 'Device File 3.5' },
  { href: '/tenant/terminal-types', label: 'Terminal Types', icon: 'Monitor', group: 'Kernel & System', description: 'Terminal Type File 3.2' },
  { href: '/tenant/menu-options', label: 'Menu Options', icon: 'ListOrdered', group: 'Kernel & System', description: 'Option File 19' },
  { href: '/tenant/packages', label: 'Packages', icon: 'Archive', group: 'Kernel & System', description: 'Package File 9.4' },
  { href: '/tenant/taskman', label: 'TaskMan', icon: 'Clock', group: 'Kernel & System', description: 'Scheduled background tasks' },
  { href: '/tenant/error-trap', label: 'Error Processing', icon: 'AlertTriangle', group: 'Kernel & System', description: 'VistA error trap (^XTER)' },
  { href: '/tenant/system', label: 'System Status', icon: 'Activity', group: 'Kernel & System', description: 'VistA runtime and connection health' },

  // ── Interoperability ───────────────────────────────────────────────────────
  { href: '/tenant/hl7', label: 'HL7 Interfaces', icon: 'Zap', group: 'Interoperability', description: 'HL7 Logical Link File 870' },
  { href: '/tenant/topology', label: 'Site Topology', icon: 'Globe', group: 'Interoperability', description: 'Facility hierarchy overview' },

  // ── Communications ─────────────────────────────────────────────────────────
  { href: '/tenant/bulletins', label: 'Bulletins', icon: 'Bell', group: 'Communications', description: 'System bulletins and alert mail groups' },
  { href: '/tenant/mail-groups', label: 'Mail Groups', icon: 'Mail', group: 'Communications', description: 'MailMan Mail Group File 3.8' },

  // ── Billing & Finance ──────────────────────────────────────────────────────
  { href: '/tenant/billing', label: 'Billing Parameters', icon: 'CreditCard', group: 'Billing', description: 'IB parameters and insurance setup' },
  { href: '/tenant/insurance', label: 'Insurance Companies', icon: 'Building2', group: 'Billing', description: 'Insurance Company File 36' },

  // ── Audit ──────────────────────────────────────────────────────────────────
  { href: '/tenant/audit', label: 'FileMan Audit', icon: 'ShieldAlert', group: 'Audit', description: 'FileMan audit trail File 1.1' },
];

export const operatorNavItems: NavItem[] = [
  // ── Overview ────────────────────────────────────────────────────────────────
  { href: '/operator/dashboard', label: 'Operations Center', icon: 'Home', group: 'Overview' },

  // ── Tenants ─────────────────────────────────────────────────────────────────
  { href: '/operator/tenants', label: 'Tenant Registry', icon: 'Building2', group: 'Tenants', description: 'All provisioned VistA Evolved tenants' },
  { href: '/operator/bootstrap', label: 'New Bootstrap', icon: 'Globe', group: 'Tenants', description: 'Step-by-step wizard to create a new tenant' },
  { href: '/operator/provisioning', label: 'Provisioning Jobs', icon: 'Server', group: 'Tenants', description: 'M-routine installation and deployment jobs' },

  // ── Commercial ─────────────────────────────────────────────────────────────
  { href: '/operator/billing', label: 'Billing & Entitlements', icon: 'CreditCard', group: 'Commercial', description: 'Lago usage-based billing and subscriptions' },
  { href: '/operator/usage', label: 'Usage & Metering', icon: 'BarChart3', group: 'Commercial', description: 'Tenant usage metrics and billing events' },

  // ── Readiness ──────────────────────────────────────────────────────────────
  { href: '/operator/markets', label: 'Markets Registry', icon: 'Globe', group: 'Readiness', description: 'Legal markets and payer readiness by country' },
  { href: '/operator/packs', label: 'Pack Catalog', icon: 'Archive', group: 'Readiness', description: 'Feature packs and module entitlements' },

  // ── Operations ─────────────────────────────────────────────────────────────
  { href: '/operator/monitoring', label: 'Monitoring', icon: 'Activity', group: 'Operations', description: 'Platform health, SLA indicators, alerts' },
  { href: '/operator/support', label: 'Support Console', icon: 'Wrench', group: 'Operations', description: 'Open alerts and IT support escalation' },
  { href: '/operator/audit', label: 'Audit Trail', icon: 'ShieldCheck', group: 'Operations', description: 'Immutable audit log of platform events' },

  // ── Platform ───────────────────────────────────────────────────────────────
  { href: '/operator/system', label: 'System Config', icon: 'Settings', group: 'Platform', description: 'Feature flags and deployment SKU' },
  { href: '/operator/runbooks', label: 'Runbooks', icon: 'BookOpen', group: 'Platform', description: 'Operational procedures and checklists' },
];
