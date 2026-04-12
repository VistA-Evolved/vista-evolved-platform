/**
 * Shared idle clock for SessionManager, SystemBar, and long forms.
 * Updated whenever SessionManager resets the inactivity timers.
 */
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

let lastActivityAt = Date.now();

export function touchSessionActivity() {
  lastActivityAt = Date.now();
}

/** Milliseconds until auto-logout from inactivity (same basis as SessionManager). */
export function getSessionRemainingMs() {
  return Math.max(0, SESSION_TIMEOUT_MS - (Date.now() - lastActivityAt));
}
