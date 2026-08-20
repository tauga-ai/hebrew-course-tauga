/**
 * How many DIFFERENT words a student may translate in one session.
 *
 * Raised from 30 to 150 when the trigger moved from press-and-hold to hover
 * (Noam, 2026-08-20: *"let's raise it for now to 150 or 200 words"*) — hover
 * makes a lookup effectively free, so the old ceiling would have been hit in
 * minutes. Note the cap counts distinct words: re-checking a word already
 * translated this session never costs anything, so 150 is generous rather
 * than restrictive for a single 30-minute sitting.
 *
 * Deliberately NOT hardcoded at the call site. Noam has floated making the
 * limit adaptive to the student's level later (generous at level 1, none at
 * level 5) — when that lands it becomes an argument to sessionTranslationCap()
 * rather than a change everywhere the cap is read.
 */
export const DEFAULT_SESSION_TRANSLATION_CAP = 150

/** Env var name, so the number can be tuned without a code change. */
export const TRANSLATION_CAP_ENV = 'NAALE_TRANSLATION_CAP'

/**
 * The cap in force right now. Server-side only — the client never decides
 * this, same principle as grading and the session deadline.
 *
 * A malformed override falls back to the default rather than throwing: a typo
 * in an env var should not take the whole translate route down, and the
 * default is always a safe number.
 */
export function sessionTranslationCap(): number {
  const raw = process.env[TRANSLATION_CAP_ENV]
  if (raw === undefined || raw.trim() === '') return DEFAULT_SESSION_TRANSLATION_CAP
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.warn(`${TRANSLATION_CAP_ENV}=${JSON.stringify(raw)} is not a non-negative integer — falling back to ${DEFAULT_SESSION_TRANSLATION_CAP}`)
    return DEFAULT_SESSION_TRANSLATION_CAP
  }
  return parsed
}
