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
