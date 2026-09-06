/**
 * naale-session-feedback-popup: whether a just-ended session should be gated
 * behind the 2-question feedback form before its score/stats recap shows.
 *
 * "Second full 30-minute session" reads as the student's second COMPLETED
 * 'practice' session specifically — not 'placement' (a one-time calibration
 * quiz whose own done screen has no score at all, so there's nothing to
 * gate) and not 'topic' (a 5-minute single-topic session, already excluded
 * by every other "counts as a full session" convention in this codebase —
 * see countsAsTrackedSession() in rewards.ts). See task.md §1 for the full
 * reasoning.
 *
 * Pure and DB-agnostic: callers pass in whatever sessions they already
 * fetched (session/end already loads every session this student has ever
 * had, for the streak calc) rather than this function querying anything
 * itself.
 */
export function isFeedbackDue(
  allSessions: { kind: string; completed: boolean }[],
  thisSession: { kind: string; completed: boolean },
  alreadyHasFeedback: boolean
): boolean {
  if (thisSession.kind !== 'practice' || !thisSession.completed || alreadyHasFeedback) return false
  const completedPracticeCount = allSessions.filter(s => s.kind === 'practice' && s.completed).length
  return completedPracticeCount === 2
}
