import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { selectAll } from '@/lib/naale/paginate'

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
 * debugMode/NEXT_PUBLIC_DEBUG_MODE, never client-controlled), which is also
 * what lets the dev-only "show answer hints" toggle work for placement the
 * same way it does for practice.
 */
/** Row shapes for the paginated bank reads — selectAll() needs the element
 *  type up front, unlike an inline query. */
type PlacementBankRow = {
  id: string
  topic: string
  difficulty: number
  prompt: string
  answer_kind: string
  options: string[] | null
  correct_answer: string
}
type PlacementOpenBankRow = { id: string; topic: string; difficulty: number; prompt: string; fields: unknown }

export async function getPlacementQuestions() {
  const db = createServiceClient()
  // Paginated: this reads both banks whole, and the MCQ bank is at the 1000-row
  // ceiling. A trimmed read here would drop a topic out of the placement test
  // entirely, leaving the student unplaced in it.
  const [mcq, open] = await Promise.all([
    selectAll<PlacementBankRow>('naale_questions', (from, to) =>
      db.from('naale_questions')
        .select('id, topic, difficulty, prompt, answer_kind, options, correct_answer')
        .order('difficulty', { ascending: true })
        .order('id', { ascending: true }) // deterministic tie-break
        .range(from, to)),
    selectAll<PlacementOpenBankRow>('naale_open_questions', (from, to) =>
      db.from('naale_open_questions')
        .select('id, topic, difficulty, prompt, fields')
        .order('difficulty', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
  ])

  // A topic name only ever exists in one of the two tables (see the infra
  // ticket's task.md), so tagging `kind` per source and merging by topic
  // can't collide two different question kinds under one key.
  const byTopic = new Map<string, { id: string; topic: string; difficulty: number; kind: 'mcq' | 'open' } & Record<string, unknown>>()
  for (const q of mcq ?? []) if (!byTopic.has(q.topic)) byTopic.set(q.topic, { ...q, kind: 'mcq' })
  for (const q of open ?? []) if (!byTopic.has(q.topic)) byTopic.set(q.topic, { ...q, kind: 'open' })
  return [...byTopic.values()]
}
