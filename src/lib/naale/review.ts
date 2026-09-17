import { GRADED_CORRECT_SCORE } from './stats'

/**
 * Picks the questions to re-show at the start of a session.
 *
 * Per the spec: prefer ones the student got WRONG last session; if they got
 * everything right, use the highest-difficulty ones they solved instead.
 *
 * Returns fewer than `count` (including zero) when the previous session
 * doesn't have that many answers — callers must proceed straight to new
 * material rather than treating an empty result as an error.
 */
export interface PreviousAnswer {
  question_id: string
  difficulty: number
  is_correct: boolean
}

/** Working decision (2026-08-12): the spec says "2-3" — picking the upper bound.
 *  See naale-track-first-build/CONTEXT.md §9. */
export const REVIEW_QUESTION_COUNT = 3

export function pickReviewQuestions(previous: PreviousAnswer[], count: number): string[] {
  const wrong = previous
    .filter(a => !a.is_correct)
    .sort((a, b) => b.difficulty - a.difficulty)

  if (wrong.length >= count) return wrong.slice(0, count).map(a => a.question_id)

  // Top up with the hardest correct answers — the spec's fallback for a
  // student who made no mistakes.
  const hardestCorrect = previous
    .filter(a => a.is_correct)
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, count - wrong.length)

  return [...wrong, ...hardestCorrect].map(a => a.question_id)
}

/** Which bank a review question has to be served from. Matches the
 *  `kind` discriminant /next and /review-next put on a served question. */
export type QuestionKind = 'mcq' | 'open' | 'conversation'

/** A previous-session answer tagged with the bank it came from, so a merged
 *  queue can still be read back out of the right table. */
export interface ReviewCandidate extends PreviousAnswer {
  kind: QuestionKind
}

export interface ReviewQueueEntry {
  question_id: string
  kind: QuestionKind
}

/**
 * The session-opener queue across ALL banks (mcq, open, and — naale-debate-
 * review-support — debate) — one pool, capped at `count` in total.
 *
 * One pool rather than one queue per bank, because the spec asks for "2-3 hard
 * exercises from the previous session" — a count of exercises, not a count per
 * exercise type. Running a queue per bank would open a session with up to
 * count × (number of banks) review questions and bury the new material.
 *
 * It also means MCQ and AI-graded questions compete on the same terms: wrong
 * answers first, hardest first, whichever bank they came from. A student whose
 * only mistakes last session were on Story Continuation gets those back, which
 * is the entire behaviour this queue existed to provide and never did — see
 * getSessionReviewQueue().
 */
export function pickReviewQueue(previous: ReviewCandidate[], count: number): ReviewQueueEntry[] {
  const kindById = new Map(previous.map(a => [a.question_id, a.kind]))
  return pickReviewQuestions(previous, count).map(question_id => ({
    question_id,
    // Non-null: every id returned came from `previous`, which is what built
    // the map.
    kind: kindById.get(question_id)!,
  }))
}

/**
 * One previous session's answers, from all banks, as a single candidate pool.
 *
 * Pure so the correct/wrong mapping is testable without a database — which
 * matters mainly for the graded threshold, the one value here that isn't just
 * a stored column read back.
 *
 * That threshold is GRADED_CORRECT_SCORE (4), not 3. This queue used to treat
 * a 3 as correct, "matching the leveling rule's fail bucket" — 1-2 fails, 3 is
 * neutral. But the two questions aren't the same one: leveling asks "should
 * this student move DOWN?", where a neutral band is right, while review asks
 * "should they SEE this again?", where a merely-passable answer is exactly the
 * candidate. Every other reading of a graded answer in the app — stats, coins,
 * the streak milestone, applyGradedAnswer's success branch — puts the floor for
 * "correct" at 4, so this was the one place that disagreed. Finding L3.
 */
export function toReviewCandidates(
  mcq: { question_id: string; difficulty: number; is_correct: boolean }[],
  open: { question_id: string; difficulty: number; score: number }[],
  debate: { question_id: string; difficulty: number; score: number }[],
  // Defaulted to [] (naale-roleplay-debate-parity), same trick question-
  // export.ts's buildQuestionBankWorkbook() uses for its own optional
  // roleplayRows param — keeps every existing 3-argument call site (this
  // file's own tests included) compiling and passing unchanged.
  roleplay: { question_id: string; difficulty: number; score: number }[] = []
): ReviewCandidate[] {
  return [
    ...mcq.map(a => ({
      question_id: a.question_id,
      difficulty: a.difficulty,
      is_correct: a.is_correct,
      kind: 'mcq' as const,
    })),
    ...open.map(a => ({
      question_id: a.question_id,
      difficulty: a.difficulty,
      is_correct: a.score >= GRADED_CORRECT_SCORE,
      kind: 'open' as const,
    })),
    // Same "4-5 counts as correct" threshold as open — debate is also a 1-5
    // graded score, just via a multi-turn exchange instead of one shot.
    ...debate.map(a => ({
      question_id: a.question_id,
      difficulty: a.difficulty,
      is_correct: a.score >= GRADED_CORRECT_SCORE,
      kind: 'conversation' as const,
    })),
    // Role-play shares debate's 'conversation' kind — the two are
    // discriminated by which table a question_id resolves against
    // (review-next/route.ts checks both), not by a separate kind value.
    ...roleplay.map(a => ({
      question_id: a.question_id,
      difficulty: a.difficulty,
      is_correct: a.score >= GRADED_CORRECT_SCORE,
      kind: 'conversation' as const,
    })),
  ]
}
