/**
 * Local Operator Context — LOCAL REVIEW RUNTIME ONLY
 *
 * Extracts a simulated operator role from the X-Local-Role request header.
 * This is NOT real authentication. It exists solely to demonstrate and enforce
 * role-based access semantics in the local control-plane review runtime.
 *
 * Default role: platform-operator (preserves current developer usability).
 * Recognized roles derived from docs/reference/permissions-matrix.md.
 * Only platform-operator may access control-plane surfaces.
 */

const RECOGNIZED_ROLES = [
  'platform-operator',
  'tenant-admin',
  'clinician',
  'ancillary-staff',
  'revenue-cycle',
  'analyst',
  'it-integration',
];

const DEFAULT_ROLE = 'platform-operator';
const ALLOWED_ROLE = 'platform-operator';

/**
 * Resolve the local operator context from the request.
 * Returns { role, recognized, allowed, reason?, validRoles? }
 */
export function resolveLocalOperatorContext(request) {
  const raw = request.headers['x-local-role'];
  const headerRole = raw ? String(raw).trim().toLowerCase() : '';

  // No header → default to platform-operator (preserves dev usability)
  if (!headerRole) {
    return { role: DEFAULT_ROLE, recognized: true, allowed: true };
  }

  // Unrecognized role → 400
  if (!RECOGNIZED_ROLES.includes(headerRole)) {
    return {
      role: headerRole,
      recognized: false,
      allowed: false,
      reason: `Unrecognized role: ${headerRole}`,
      validRoles: RECOGNIZED_ROLES,
    };
  }

  // Recognized but not platform-operator → 403
  if (headerRole !== ALLOWED_ROLE) {
    return {
      role: headerRole,
      recognized: true,
      allowed: false,
      reason: `Role ${headerRole} does not have control-plane access`,
    };
  }

  // platform-operator → allowed
  return { role: headerRole, recognized: true, allowed: true };
}

export { RECOGNIZED_ROLES, DEFAULT_ROLE, ALLOWED_ROLE };
