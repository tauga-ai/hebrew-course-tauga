import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { pickReviewQuestions, REVIEW_QUESTION_COUNT, type PreviousAnswer } from './review'

/**
 * The question ids to re-serve at the start of this student's session, or []
 * if there's nothing to review yet (no prior practice session, or that
 * session has no non-review answers).
 *
 * "Previous session" means the most recent ENDED session with kind='practice'
 * — placement never counts (ticket 11: it's calibration, not practice), per
 * ticket 15's task.md Phase 0 working decision.
 *
 * Recomputed on every call rather than stored — cheap at this data volume
 * (task.md Section 3.1), and it means an interrupted review leaves no stale
 * queue to reconcile.
 */
export async function getReviewQuestionIds(studentId: string, excludeSessionId?: string): Promise<string[]> {
  const db = createServiceClient()

  let query = db
    .from('naale_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('kind', 'practice')
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)

  if (excludeSessionId) query = query.neq('id', excludeSessionId)

  const { data: previousSessions } = await query
  const previousSessionId = previousSessions?.[0]?.id
  if (!previousSessionId) return []

  // is_review excluded here too: a review question shouldn't itself become a
  // candidate for the NEXT session's review — only fresh material from last
  // time is eligible.
  const { data: answers } = await db
    .from('naale_answers')
    .select('question_id, difficulty, is_correct')
    .eq('session_id', previousSessionId)
    .eq('is_review', false)

  if (!answers || answers.length === 0) return []

  const previous: PreviousAnswer[] = answers.map(a => ({
    question_id: a.question_id,
    difficulty: a.difficulty,
    is_correct: a.is_correct,
  }))

  return pickReviewQuestions(previous, REVIEW_QUESTION_COUNT)
}
