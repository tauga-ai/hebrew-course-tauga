/**
 * Dev-only "custom session length" override for QA — lets someone testing
 * the Naale session-timer paths (expiry, resume, completion) pick any
 * session length in minutes instead of waiting out the real 30. Mirrors
 * dev-hint.ts's external-store + cookie pattern (see that file's doc
 * comment for the hydration-safety reasoning behind the indirection).
 *
 * The cookie alone is never trusted for anything: the actual override only
 * takes effect server-side, in /api/naale/session/start, and only when
 * debugMode is true there. Setting this cookie against a deployment built
 * with NEXT_PUBLIC_DEBUG_MODE off has zero effect — not something a
 * client-supplied cookie can influence.
 */
export const DEV_SESSION_MINUTES_COOKIE = 'naale-dev-session-minutes'

let clientOverrideMinutes: number | null = null
const listeners = new Set<() => void>()

/** null means "no override — use the real SESSION_MINUTES". */
export function getSessionMinutesOverride(): number | null {
  return clientOverrideMinutes
}

export function setSessionMinutesOverride(minutes: number | null) {
  clientOverrideMinutes = minutes
  document.cookie =
    minutes === null
      ? `${DEV_SESSION_MINUTES_COOKIE}=; path=/; max-age=0`
      : `${DEV_SESSION_MINUTES_COOKIE}=${minutes}; path=/; max-age=31536000; SameSite=Lax`
  listeners.forEach(fn => fn())
}

export function subscribeSessionMinutesOverride(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
