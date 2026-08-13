/**
 * Dev-only "show answer hints" toggle for QA — lets someone testing the
 * Naale session UI see the correct answer inline without reading Hebrew.
 * Mirrors dev-i18n.ts's external-store + cookie pattern (see that file's doc
 * comment for the hydration-safety reasoning behind the indirection).
 *
 * This toggle only controls whether an ALREADY-dev-only field gets
 * *displayed* — it never controls whether the field gets *sent*. The actual
 * security gate lives server-side in /api/naale/session/next, keyed on
 * debugMode (NEXT_PUBLIC_DEBUG_MODE) alone: a build with that flag off never
 * includes correct_answer regardless of this toggle's (client-controlled,
 * therefore untrusted) state.
 */
export const DEV_HINT_COOKIE = 'dev-hint'

let clientHintOverride: boolean | null = null
const listeners = new Set<() => void>()

export function getShowHint(): boolean {
  return clientHintOverride ?? false
}

export function setShowHint(show: boolean) {
  clientHintOverride = show
  document.cookie = `${DEV_HINT_COOKIE}=${show ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`
  listeners.forEach(fn => fn())
}

export function subscribeShowHint(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
