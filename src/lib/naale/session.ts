import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { NaaleSession } from '@/lib/types'

// Pure completion/timing rules live in session-rules.ts, without the
// 'server-only' import above — that import throws unconditionally when
// required outside Next's webpack build (it only "works" via a build-time
// alias Next substitutes), so a plain `tsx --test` run of this file would
// crash before any test body ran. Re-exported here so route files can keep
// importing everything from one place.
export { SESSION_MINUTES, MIN_ANSWERS_FOR_COMPLETION, isSessionCompleted, hasReachedTimer, isExpired, secondsRemaining } from './session-rules'

export type OwnedSessionResult =
  | { ok: false }
  | { ok: true; session: NaaleSession }

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
    .select('id, student_id, kind, started_at, deadline_at, ended_at, answered_count, completed')
    .eq('id', sessionId)
    .maybeSingle()

  if (!data || data.student_id !== studentId) return { ok: false }
  return { ok: true, session: data as NaaleSession }
}
