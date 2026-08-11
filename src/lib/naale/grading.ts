/**
 * Answer comparison for Naale exercises.
 *
 * Free-text tolerance (typos, spelling variants, niqqud) is still an open
 * product question. The current rule is deliberately conservative — trim,
 * collapse internal whitespace, strip trailing punctuation, case-insensitive —
 * which handles the accidental-space class of false negative without silently
 * accepting wrong answers.
 *
 * Everything tolerance-related belongs HERE, not in the route, so it stays
 * unit-testable and changeable in one place once the decision lands. If
 * tolerance ever needs to be fuzzy/semantic, this is also the seam where an
 * AI-backed check would go — and that would require checkAiRateLimit() in the
 * calling route, which today it does not need.
 */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    // Trailing sentence punctuation only — internal punctuation can be
    // meaningful in a Hebrew answer.
    .replace(/[.,;:!?׃־]+$/u, '')
    .toLocaleLowerCase('he')
}

/**
 * MCQ answers are compared exactly after normalization (the client echoes back
 * one of the option strings it was given, so there's nothing to be lenient
 * about). Free text goes through the same normalization for now — see the note
 * above about where tolerance would be added.
 */
export function isAnswerCorrect(submitted: string, correct: string, answerKind: string): boolean {
  void answerKind
  return normalizeAnswer(submitted) === normalizeAnswer(correct)
}
