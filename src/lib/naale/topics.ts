import type { SupabaseClient } from '@supabase/supabase-js'
import { selectAll } from './paginate'

/**
 * Every topic that has content in EITHER bank, sorted.
 *
 * Both stats screens drive their whole per-topic view off this list, so a
 * topic missing here vanishes from the screen entirely — level, exercise count
 * and accuracy together, with no error. That is exactly how the staff view
 * came to omit all three AI-graded topics (audit H1): it built its list from
 * `naale_questions` alone. One shared loader so neither screen can look at
 * half the content again.
 *
 * Paginated because this reads one row per QUESTION to derive seven distinct
 * strings, and the MCQ bank is at 1000 rows — precisely PostgREST's default
 * `max_rows`. A `distinct` view or an RPC would be cheaper still and is worth
 * doing if the bank grows much further; pagination is the migration-free fix.
 */
export async function loadAllTopics(db: SupabaseClient): Promise<string[]> {
  const [mcq, open] = await Promise.all([
    selectAll<{ topic: string }>('naale_questions', (from, to) =>
      db.from('naale_questions').select('topic').range(from, to)),
    selectAll<{ topic: string }>('naale_open_questions', (from, to) =>
      db.from('naale_open_questions').select('topic').range(from, to)),
  ])
  return [...new Set([...mcq, ...open].map(r => r.topic))].sort()
}

/**
 * Topics an admin has explicitly disabled (naale-topic-toggle) — a topic
 * absent from naale_topic_flags, or present with enabled: true, is not in
 * this set. Tiny table by construction (only touched topics get a row), so
 * fetching the whole set is cheap enough to call from every check site
 * rather than querying one topic at a time.
 */
export async function loadDisabledTopics(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db.from('naale_topic_flags').select('topic').eq('enabled', false)
  return new Set((data ?? []).map(r => r.topic))
}

/**
 * Same topics loadAllTopics() finds, minus anything currently disabled —
 * this is the student-facing view: what shows up as a tile, what can be
 * started, what gets rotated into a practice/placement session. Callers that
 * need the FULL list regardless of the toggle (placement/finish's leveling
 * step, staff's view of a student's history) keep using loadAllTopics()
 * directly — this only replaces it where students themselves are the
 * audience.
 */
export async function loadEnabledTopics(db: SupabaseClient): Promise<string[]> {
  const [all, disabled] = await Promise.all([loadAllTopics(db), loadDisabledTopics(db)])
  return all.filter(topic => !disabled.has(topic))
}
