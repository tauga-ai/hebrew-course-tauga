import 'server-only'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { debugMode } from '@/lib/dev-i18n'
import { DEV_SESSION_MINUTES_COOKIE } from '@/lib/naale/dev-fast-session'
import type { NaaleSession } from '@/lib/types'

// Pure completion/timing rules live in session-rules.ts, without the
// 'server-only' import above — that import throws unconditionally when
// required outside Next's webpack build (it only "works" via a build-time
// alias Next substitutes), so a plain `tsx --test` run of this file would
// crash before any test body ran. Re-exported here so route files can keep
// importing everything from one place.
export { SESSION_MINUTES, TOPIC_SESSION_MINUTES, MIN_ANSWERS_FOR_COMPLETION, isSessionCompleted, hasReachedTimer, isExpired, secondsRemaining, isPendingQuestion } from './session-rules'

export type OwnedSessionResult =
  | { ok: false }
  | { ok: true; session: NaaleSession }

/**
 * Dev-only: the QA session-length override minutes, if debugMode is on and a
 * valid one is set, else null ("use the real SESSION_MINUTES / stored
 * deadline"). Shared by session/start (recomputes on resume) and
 * session/status (recomputes on a plain page reload) — a reload is what the
 * client actually calls to restore an in-progress session, so the override
 * must be picked up there too, not only via session/start's resume branch.
 */
export async function readDevSessionMinutesOverride(): Promise<number | null> {
  if (!debugMode) return null
  const raw = (await cookies()).get(DEV_SESSION_MINUTES_COOKIE)?.value
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Loads a session and verifies it belongs to this student. A session_id is
 * client-supplied, so ownership must be re-checked on every request — never
 * trust the id on its own. Returns ok:false for both "doesn't exist" and
 * "belongs to someone else" so callers can't accidentally leak which it was.
 */
export async function loadOwnedSession(sessionId: string, studentId: string): Promise<OwnedSessionResult> {
  const db = createServiceClient()
  const { data } = await db
    .from('naale_sessions')
    .select('id, student_id, kind, topic, pending_question_id, started_at, deadline_at, ended_at, answered_count, completed, translations_used, translated_words')
    .eq('id', sessionId)
    .maybeSingle()

  if (!data || data.student_id !== studentId) return { ok: false }
  return { ok: true, session: data as NaaleSession }
}
