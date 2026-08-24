import type { NaaleTopicStat } from './stats'

/** Noam's spec §4: the completion screen must never break on an AI failure.
 *  Verbatim from Developer_Instructions_Session_Summary_Clean.md. */
export const SESSION_SUMMARY_FALLBACK = 'כל הכבוד על סיום הסשן! המשך לתרגל כדי להשתפר.'
export const SESSION_SUMMARY_FALLBACK_ICON = '🌟'

export interface SessionSummary {
  summary_text: string
  ui_icon: string
}

export interface SessionRanking {
  /** Whole-number success rate for the session, e.g. 85. */
  score_pct: number
  /** Up to 2 topic names, best first. Empty only when every topic scored identically. */
  strong: string[]
  /** Up to 2 topic names, worst first. Empty only when every topic scored identically. */
  weak: string[]
}

/**
 * Ranks one session's topics into the strong/weak lists Noam's prompt takes
 * (spec §2). Pure, and kept out of the server-only AI module so it's
 * unit-testable on its own.
 *
 * Three rules from the spec, each easy to get subtly wrong:
 *
 *  - The ranking is RELATIVE, never absolute. A session where every topic
 *    went badly still has a relative best, and one where everything went well
 *    still has a relative worst. The lists go empty ONLY when there is
 *    genuinely nothing to distinguish — every topic scored the same.
 *
 *  - Only topics the student actually answered take part. `accuracy_pct` is
 *    null for an untouched topic (see NaaleTopicStat), and null must not be
 *    coerced to 0% — that would invent a weakness out of a topic this session
 *    never showed.
 *
 *  - The half-split is what keeps the two lists disjoint. With 2 or 3 topics,
 *    a naive "top 2 and bottom 2" names the same topic as both a strength and
 *    a weakness in the same sentence.
 */
export function rankSessionTopics(topics: NaaleTopicStat[]): SessionRanking {
  const answered = topics.filter(t => t.answered > 0 && t.accuracy_pct !== null)

  const totalAnswered = answered.reduce((n, t) => n + t.answered, 0)
  const totalCorrect = answered.reduce((n, t) => n + t.correct, 0)
  const score_pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const sorted = [...answered].sort((a, b) => b.accuracy_pct! - a.accuracy_pct!)

  // Covers the empty case and the single-topic case too: with nothing to
  // compare against, "all scores identical" is trivially true, which is
  // exactly the spec's empty-lists edge case.
  const allIdentical =
    sorted.length === 0 || sorted[0].accuracy_pct === sorted[sorted.length - 1].accuracy_pct
  if (allIdentical) return { score_pct, strong: [], weak: [] }

  const take = Math.min(2, Math.floor(sorted.length / 2))
  return {
    score_pct,
    strong: sorted.slice(0, take).map(t => t.topic),
    weak: sorted.slice(-take).reverse().map(t => t.topic),
  }
}

/**
 * Mirrors parseGradedResponse() in open-grading-parse.ts. Pure and in this
 * file rather than the server-only AI module, for the same reason: so a test
 * can import it without pulling in GEMINI_API_KEY access.
 */
export function parseSessionSummary(raw: string): SessionSummary {
  const parsed = JSON.parse(raw)
  if (
    typeof parsed?.summary_text !== 'string' ||
    typeof parsed?.ui_icon !== 'string' ||
    !parsed.summary_text.trim()
  ) {
    throw new Error('Malformed session summary response')
  }
  return { summary_text: parsed.summary_text.trim(), ui_icon: parsed.ui_icon.trim() }
}
