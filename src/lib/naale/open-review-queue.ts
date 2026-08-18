import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { pickReviewQuestions, REVIEW_QUESTION_COUNT, type PreviousAnswer } from './review'

/**
 * Working decision: a graded answer counts as "wrong" (review-worthy) only
 * at score 1-2, matching the leveling rule's fail bucket — a neutral score
 * of 3 is left alone, same as it doesn't hurt the student's level either.
 *
 * Mirrors getReviewQuestionIds() (review-queue.ts) exactly, reusing
 * pickReviewQuestions() unchanged — only the source table and the
 * correct/wrong mapping differ. Kept as a fully separate queue rather than
 * merged into the MCQ one, since the two read from different tables entirely.
 */
export async function getOpenReviewQuestionIds(studentId: string, excludeSessionId?: string): Promise<string[]> {
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

  const { data: answers } = await db
    .from('naale_open_answers')
    .select('question_id, difficulty, score')
    .eq('session_id', previousSessionId)
    .eq('is_review', false)

  if (!answers || answers.length === 0) return []

  const previous: PreviousAnswer[] = answers.map(a => ({
    question_id: a.question_id,
    difficulty: a.difficulty,
    is_correct: a.score >= 3,
  }))

  return pickReviewQuestions(previous, REVIEW_QUESTION_COUNT)
}
