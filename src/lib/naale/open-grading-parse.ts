export interface GradedResult { score: number; feedback: string }

/**
 * Parses and validates a raw Gemini response for gradeOpenAnswer(). Split out
 * from open-grading.ts (which is 'server-only') so it's unit-testable
 * without pulling in API-key access — same reasoning as gemini-retry.ts.
 * Throws a message that already says which check failed, so a caller's log
 * line doesn't need two separate call sites to tell the two apart.
 */
export function parseGradedResponse(rawText: string): GradedResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Malformed grading response: not valid JSON')
  }
  const graded = parsed as { score?: unknown; feedback?: unknown }
  if (typeof graded.score !== 'number' || graded.score < 1 || graded.score > 5 || typeof graded.feedback !== 'string') {
    throw new Error('Malformed grading response: wrong shape')
  }
  return { score: graded.score, feedback: graded.feedback }
}
