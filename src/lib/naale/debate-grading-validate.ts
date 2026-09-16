/**
 * Pure validation logic split out of debate-grading.ts (which is 'server-only'
 * and therefore can't be imported directly from a plain Node test — same
 * reason open-grading-parse.ts exists separately from open-grading.ts).
 */

/** Heuristic for "Gemini's final-turn feedback text was cut off mid-sentence" —
 *  confirmed live (naale-debate-module QA, 2026-09-16): the JSON envelope can
 *  be perfectly well-formed while the feedback STRING inside it ends
 *  mid-thought, e.g. "...הביע דעה ברורה (" with no closing paren. An
 *  unmatched bracket/paren is the simplest, lowest-false-positive signal — a
 *  genuinely finished sentence essentially never leaves one open, and this
 *  avoids false positives on Hebrew's normal use of ' / " as geresh/gershayim
 *  (which this deliberately does not check). */
export function looksTruncated(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  const opens = (trimmed.match(/[([{]/g) ?? []).length
  const closes = (trimmed.match(/[)\]}]/g) ?? []).length
  return opens !== closes
}
