import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * One placement question per topic.
 *
 * Currently the lowest-difficulty question per topic, deterministically chosen
 * (see ticket 11's task.md Section 3.3). The spec assigns explicit
 * placement-question selection to the product owner; once the source workbook
 * carries an is_placement flag, this is the single function that changes —
 * nothing else in the placement flow depends on how the question was chosen.
 *
 * correct_answer IS selected here, same as the practice /next route's bank
 * query — stripping it for production happens at the route level (gated on
 * NODE_ENV, never client-controlled), which is also what lets the dev-only
 * "show answer hints" toggle work for placement the same way it does for
 * practice.
 */
export async function getPlacementQuestions() {
  const db = createServiceClient()
  const { data } = await db
    .from('naale_questions')
    .select('id, topic, difficulty, prompt, answer_kind, options, correct_answer')
    .order('difficulty', { ascending: true })
    .order('id', { ascending: true }) // deterministic tie-break

  const byTopic = new Map<string, NonNullable<typeof data>[number]>()
  for (const q of data ?? []) {
    if (!byTopic.has(q.topic)) byTopic.set(q.topic, q)
  }
  return [...byTopic.values()]
}
