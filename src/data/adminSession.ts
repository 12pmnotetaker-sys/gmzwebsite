/**
 * The signed-in staff session, as the browser holds it.
 *
 * Shared between `/admin` (login) and `/admin/leads` (the dashboard) so the
 * storage key, the shape of a session and what counts as expired have one
 * home rather than two copies that can drift.
 *
 * `sessionStorage`, not `localStorage`: this is a staff tool handling client
 * contact details, not a marketing courtesy like the portfolio veil, so a
 * session should not quietly outlive the browser tab.
 *
 * Browser-only. Never imported by `api/admin/leads.ts`: the server verifies
 * every request's token against Supabase itself and never trusts anything
 * read back out of here.
 */

const STORAGE_KEY = 'gmz-admin-session';

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  email: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export function getSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (!session.accessToken || Date.now() >= session.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(session: AdminSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
