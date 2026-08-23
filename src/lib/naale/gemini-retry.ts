import { GoogleGenerativeAIAbortError, GoogleGenerativeAIFetchError } from '@google/generative-ai'

/** Transient failures worth retrying: the request timed out, or Gemini
 *  itself returned 429/5xx. A malformed/wrong-shape reply is a parsing
 *  concern, not a transport one, so it's left to the caller's generic catch
 *  rather than retried here. No 'server-only' guard — this is pure error
 *  classification, kept in its own file so it's unit-testable without
 *  pulling in open-grading.ts's API-key access. */
export function isRetryableGeminiError(err: unknown): boolean {
  if (err instanceof GoogleGenerativeAIAbortError) return true
  if (err instanceof GoogleGenerativeAIFetchError) {
    return err.status !== undefined && (err.status === 429 || err.status >= 500)
  }
  return false
}
