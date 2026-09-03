export type RecyclingAnswer = { question_id: string; session_id: string; answered_at: string }

/**
 * Picks which previously-answered question to re-serve once a topic session's question bank is
 * fully exhausted — the one that has gone the longest without being seen again, per spec
 * ("ordered oldest-seen-first, last_answered_timestamp ASC" — Developer_Instructions_5Min_
 * Sessions_V2.docx). Grouped per question (its most recent answer across ALL sessions), not per
 * raw answer row — naale-topic-recycling-stuck-question found live that sorting raw rows lets a
 * question's first-ever answer permanently anchor it as "oldest" forever, even after it's been
 * recycled and re-answered many times since.
 *
 * Excludes any question already answered in the CURRENT session, so a topic session can't
 * immediately re-serve something it just recycled a moment ago within the same session (that
 * would violate naale_answers/naale_open_answers' one-row-per-session-question uniqueness on the
 * second submit — see session/next/route.ts's own AnsweredRow comment).
 *
 * Returns null when there's nothing eligible to recycle (no answers at all, or every answered
 * question was already answered in this exact session).
 */
export function pickRecycledQuestionId(
  answers: RecyclingAnswer[],
  currentSessionId: string,
): string | null {
  const lastSeenByQuestion = new Map<string, string>()
  const answeredThisSession = new Set<string>()

  for (const a of answers) {
    if (a.session_id === currentSessionId) answeredThisSession.add(a.question_id)
    const existing = lastSeenByQuestion.get(a.question_id)
    if (!existing || a.answered_at > existing) lastSeenByQuestion.set(a.question_id, a.answered_at)
  }

  const eligible = [...lastSeenByQuestion.entries()].filter(([id]) => !answeredThisSession.has(id))
  if (eligible.length === 0) return null

  eligible.sort((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime())
  return eligible[0][0]
}
