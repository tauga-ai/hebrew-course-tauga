export interface ProgressRow {
  question_id: number
  selected_option: number
  is_correct: boolean
}

/**
 * Enriches stored answer rows with `correct_option`/`explanation` looked up
 * server-side (not stored per-row) — shared by the makbatzim and
 * tzav-rishon progress routes, which differ only in the shape of
 * `explanation` (plain segments vs. `{he, ar}`), a passthrough this
 * function never inspects.
 *
 * `reveal` (default true — every existing caller keeps today's immediate-
 * feedback behavior) gates whether correctness is exposed at all. When
 * false — dapar-simulation before the set is complete — a resumed/
 * revisited question must not leak `is_correct`/`correct_option`/
 * `explanation` either, matching the same server-side boundary enforced
 * on submit.
 */
export function enrichProgress<Q extends { correctOption: number; explanation: unknown }>(
  rows: ProgressRow[],
  lookup: (questionId: number) => Q | null | undefined,
  reveal: boolean = true
) {
  return rows.map(row => {
    if (!reveal) {
      return { question_id: row.question_id, selected_option: row.selected_option, is_correct: null, correct_option: null, explanation: null }
    }
    const question = lookup(row.question_id)
    return {
      ...row,
      correct_option: question?.correctOption ?? null,
      explanation: question?.explanation ?? null,
    }
  })
}

/** Attempted count + accuracy for a student's stored rows, out of `total` possible questions. */
export function computeStats(rows: { is_correct: boolean }[], total: number) {
  const attempted = rows.length
  const avg_pct = attempted > 0
    ? (rows.filter(r => r.is_correct).length / attempted) * 100
    : null
  return { attempted, total, avg_pct }
}
