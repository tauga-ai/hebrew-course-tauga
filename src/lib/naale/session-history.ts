/**
 * Index arithmetic for browsing back through a session's already-answered
 * questions (Noam item 3).
 *
 * `viewIndex === null` means "looking at the live question". Any number is a
 * position in the history array, oldest first, so the newest resolved question
 * is at `length - 1` — i.e. one step back from live.
 *
 * Pure and separate from the page because the page's own state is entangled
 * with prefetching and auto-advance, and this part is worth being sure about:
 * an off-by-one here strands a student on a question they can't leave.
 */

/** Nothing to go back to when the history is empty or we're already at its
 *  oldest entry. */
export function canGoBack(viewIndex: number | null, historyLength: number): boolean {
  if (historyLength === 0) return false
  return viewIndex === null ? true : viewIndex > 0
}

/** One step older. Returns the current index unchanged when there's nowhere
 *  further back, so a caller can assign the result unconditionally. */
export function goBack(viewIndex: number | null, historyLength: number): number | null {
  if (!canGoBack(viewIndex, historyLength)) return viewIndex
  return viewIndex === null ? historyLength - 1 : viewIndex - 1
}

/** One step newer. Stepping past the newest entry returns null — back to the
 *  live question, which is the only way out of history. */
export function goForward(viewIndex: number | null, historyLength: number): number | null {
  if (viewIndex === null) return null
  return viewIndex >= historyLength - 1 ? null : viewIndex + 1
}

/** Only a question that was actually answered belongs in history — an
 *  unanswered one (the student left the session, or the timer ran out mid
 *  question) has no resolved state to show. */
export function isResolved(entry: { result: unknown; openResult: unknown }): boolean {
  return entry.result !== null || entry.openResult !== null
}
