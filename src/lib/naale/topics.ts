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
