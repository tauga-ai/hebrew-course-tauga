/**
 * Dev-only "show topic/difficulty badge" toggle for QA — lets someone
 * testing a Naale practice session see which topic and difficulty the
 * current question is without cross-referencing the DB. Mirrors
 * dev-hint.ts's external-store + cookie pattern (see that file's doc comment
 * for the hydration-safety reasoning behind the indirection).
 *
 * Unlike dev-hint.ts, there's no separate server-side gate to worry about:
 * topic and difficulty are already present in every /session/next response
 * regardless of debugMode (only correct_answer is conditionally stripped) —
 * this toggle only controls client-side DISPLAY of data the browser already
 * has.
 */
export const DEV_QUESTION_BADGE_COOKIE = 'dev-question-badge'

let clientBadgeOverride: boolean | null = null
const listeners = new Set<() => void>()

export function getShowQuestionBadge(): boolean {
  return clientBadgeOverride ?? false
}

export function setShowQuestionBadge(show: boolean) {
  clientBadgeOverride = show
  document.cookie = `${DEV_QUESTION_BADGE_COOKIE}=${show ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`
  listeners.forEach(fn => fn())
}

export function subscribeShowQuestionBadge(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
