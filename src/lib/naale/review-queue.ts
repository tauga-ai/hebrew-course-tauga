import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { pickReviewQueue, toReviewCandidates, REVIEW_QUESTION_COUNT, type ReviewQueueEntry } from './review'

/**
 * The questions to re-serve at the start of this student's session, or [] if
 * there's nothing to review yet (no prior practice session, or that session
 * has no non-review answers).
 *
 * Reads BOTH banks. It used to read only naale_answers, which meant the three
 * AI-graded topics — Story Continuation, WhatsApp, Text Summary — could never
 * resurface in the session opener no matter how badly a student did on them.
 * A separate getOpenReviewQuestionIds() had been written for them and was
 * never wired to the serving route; folding it in here rather than reviving it
 * alongside is deliberate, because two independent queues of
 * REVIEW_QUESTION_COUNT would open a session with up to twice the review the
 * spec asks for. See pickReviewQueue() for the one-pool reasoning.
 *
 * "Previous session" means the most recent ENDED session with kind='practice'
 * — placement never counts (ticket 11: it's calibration, not practice), per
 * ticket 15's task.md Phase 0 working decision.
 *
 * Recomputed on every call rather than stored — cheap at this data volume
 * (task.md Section 3.1), and it means an interrupted review leaves no stale
 * queue to reconcile. Both the serving route and the two answer routes call
 * this same function, so what gets served and what counts as a sanctioned
 * review answer cannot disagree.
 */
export async function getSessionReviewQueue(
  studentId: string,
  excludeSessionId?: string
): Promise<ReviewQueueEntry[]> {
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

  // is_review excluded from both: a review question shouldn't itself become a
  // candidate for the NEXT session's review — only fresh material from last
  // time is eligible.
  const [{ data: mcqAnswers }, { data: openAnswers }] = await Promise.all([
    db
      .from('naale_answers')
      .select('question_id, difficulty, is_correct')
      .eq('session_id', previousSessionId)
      .eq('is_review', false),
    db
      .from('naale_open_answers')
      .select('question_id, difficulty, score')
      .eq('session_id', previousSessionId)
      .eq('is_review', false),
  ])

  // Correct/wrong mapping (including the graded threshold, finding L3) lives
  // in toReviewCandidates() so it can be tested without a database.
  const candidates = toReviewCandidates(mcqAnswers ?? [], openAnswers ?? [])

  if (candidates.length === 0) return []

  return pickReviewQueue(candidates, REVIEW_QUESTION_COUNT)
}
